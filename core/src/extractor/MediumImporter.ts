import { chromium } from 'playwright';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import type { ParsedArticle, ImportOptions } from '../types/index.js';
import type { Importer } from './types.js';
import type { Logger } from '../utils/logger.js';

const MEDIUM_DOMAINS = [
  'medium.com',
  'towardsdatascience.com',
  'betterprogramming.pub',
  'javascript.plainenglish.io',
  'levelup.gitconnected.com',
];

// Freedium is an open source proxy that bypasses Medium's paywall via
// TLS fingerprint impersonation. When the user explicitly passes a
// Freedium URL, we treat it as a plain article (no special handling needed).
export const FREEDIUM_DOMAINS = ['freedium.cfd', 'freedium-mirror.cfd'];

const STEALTH_INIT_SCRIPT = `
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {}, app: {} };
`;

export class MediumImporter implements Importer {
  constructor(private logger: Logger) {}

  canHandle(source: string): boolean {
    try {
      const host = new URL(source).hostname.replace('www.', '');
      return (
        MEDIUM_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`)) ||
        // personal medium subdomains: username.medium.com
        host.endsWith('.medium.com')
      );
    } catch {
      return false;
    }
  }

  async import(source: string, options?: ImportOptions): Promise<ParsedArticle> {
    const result = await this.importWithRawHtml(source, options);
    return result.article;
  }

  async importWithRawHtml(
    source: string,
    _options?: ImportOptions,
  ): Promise<{ article: ParsedArticle; html: string }> {
    this.logger.debug(`MediumImporter: fetching ${source}`);

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'en-US',
        viewport: { width: 1280, height: 800 },
      });

      // Stealth: remove webdriver flag so Cloudflare doesn't detect headless browser
      await context.addInitScript(STEALTH_INIT_SCRIPT);

      const page = await context.newPage();

      // Block JavaScript to freeze the page at SSR state before Medium's
      // client-side code can detect the missing auth token and redirect to homepage
      await page.route('**/*', (route) => {
        if (route.request().resourceType() === 'script') {
          route.abort();
        } else {
          route.continue();
        }
      });

      await page.goto(source, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      await this.checkPaywall(page, source);

      const html = await page.content();
      const finalUrl = page.url();
      await context.close();

      const article = this.parseHtml(html, finalUrl);
      return { article, html };
    } finally {
      await browser.close();
    }
  }

  private async checkPaywall(page: import('playwright').Page, url: string): Promise<void> {
    const isMemberOnly = await page.evaluate(() => {
      return (
        document.body.innerHTML.includes('Member-only story') ||
        !!document.querySelector('[data-testid="paywall"]') ||
        document.body.innerHTML.includes('member-only')
      );
    });

    if (isMemberOnly) {
      throw new Error(
        `This Medium article is member-only (paywalled).\n` +
          `  EpubForge can only convert free Medium articles.\n` +
          `\n` +
          `  To convert paywalled articles, use Freedium (open source proxy):\n` +
          `  epubforge https://freedium-mirror.cfd/${url}`,
      );
    }
  }

  private parseHtml(html: string, url: string): ParsedArticle {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document, { keepClasses: false });
    const article = reader.parse();

    if (!article || article.length < 100) {
      throw new Error(
        `Could not extract article content from Medium page. ` +
          `The page may be paywalled or Cloudflare may have blocked the request.`,
      );
    }

    return {
      content: article.content,
      title: article.title,
      excerpt: article.excerpt ?? undefined,
      byline: article.byline ?? undefined,
      length: article.length,
    };
  }
}
