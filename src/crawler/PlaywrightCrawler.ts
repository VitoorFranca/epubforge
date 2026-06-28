import { chromium, type Browser, type Page } from 'playwright';
import type { CrawlResult, CrawlerOptions } from '../types/index.js';
import type { Logger } from '../utils/logger.js';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export class PlaywrightCrawler {
  private options: Required<CrawlerOptions>;
  private logger: Logger;

  constructor(logger: Logger, options: CrawlerOptions = {}) {
    this.logger = logger;
    this.options = {
      timeout: options.timeout ?? 30000,
      waitUntil: options.waitUntil ?? 'networkidle',
      userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
      verbose: options.verbose ?? false,
    };
  }

  async fetch(url: string): Promise<CrawlResult> {
    this.logger.debug(`Launching browser for ${url}`);
    const browser = await chromium.launch({ headless: true });
    try {
      return await this.fetchWithBrowser(browser, url);
    } finally {
      await browser.close();
      this.logger.debug('Browser closed');
    }
  }

  private async fetchWithBrowser(browser: Browser, url: string): Promise<CrawlResult> {
    const context = await browser.newContext({
      userAgent: this.options.userAgent,
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
    });

    const page = await context.newPage();
    await this.blockUnnecessaryResources(page);

    this.logger.debug(`Navigating to ${url}`);
    const response = await this.navigateWithFallback(page, url);

    if (!response) {
      throw new Error(`Failed to load page: ${url}`);
    }

    const status = response.status();
    if (status >= 400) {
      throw new Error(`HTTP ${status} when fetching ${url}`);
    }

    const finalUrl = page.url();
    this.logger.debug(`Page loaded (final URL: ${finalUrl})`);

    await this.waitForContent(page);

    const html = await page.content();
    await context.close();

    return { url, html, finalUrl };
  }

  private async navigateWithFallback(
    page: Page,
    url: string,
  ): Promise<Awaited<ReturnType<Page['goto']>>> {
    // Try networkidle first; many sites (Medium, etc.) keep requests alive forever,
    // so fall back to load + a short wait to let JS render.
    try {
      return await page.goto(url, {
        waitUntil: this.options.waitUntil,
        timeout: this.options.timeout,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('Timeout') || this.options.waitUntil !== 'networkidle') {
        throw err;
      }
      this.logger.debug('networkidle timed out — retrying with load');
      const response = await page.goto(url, {
        waitUntil: 'load',
        timeout: this.options.timeout,
      });
      // Give JS frameworks a moment to render after load
      await page.waitForTimeout(2000);
      return response;
    }
  }

  private async blockUnnecessaryResources(page: Page): Promise<void> {
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      const blockedTypes = ['media', 'font', 'websocket', 'manifest'];
      if (blockedTypes.includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });
  }

  private async waitForContent(page: Page): Promise<void> {
    await page
      .waitForSelector('article, main, [role="main"], .content, .post', {
        timeout: 5000,
      })
      .catch(() => {
        // Content might not have these elements — proceed anyway
      });
  }
}
