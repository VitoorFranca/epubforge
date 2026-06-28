import { JSDOM } from 'jsdom';
import type { Logger } from '../utils/logger.js';

const REMOVE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'nav',
  'header',
  'footer',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[role="complementary"]',
  '.ad, .ads, .advert, .advertisement',
  '.cookie, .cookie-banner, .cookie-notice',
  '.newsletter, .subscribe, .subscription',
  '.social, .social-share, .share-buttons',
  '.popup, .modal, .overlay',
  '.sidebar, .widget',
  '.related, .recommended',
  '.comments, #comments',
  '[data-ad], [data-ads]',
  '[aria-hidden="true"]',
  '.hidden, [hidden]',
];

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'title'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan', 'scope'],
  ol: ['start', 'type'],
  li: ['value'],
  code: ['class'],
  pre: ['class'],
  blockquote: ['cite'],
  time: ['datetime'],
  abbr: ['title'],
  dfn: ['title'],
};

export class HtmlCleaner {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  clean(html: string): string {
    this.logger.debug('Cleaning HTML');
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    this.removeUnwantedElements(doc);
    this.removeAllAttributes(doc);
    this.removeEmptyElements(doc);

    return doc.body?.innerHTML ?? html;
  }

  private removeUnwantedElements(doc: Document): void {
    for (const selector of REMOVE_SELECTORS) {
      doc.querySelectorAll(selector).forEach((el) => el.remove());
    }
  }

  private removeAllAttributes(doc: Document): void {
    const allElements = doc.querySelectorAll('*');
    allElements.forEach((el) => {
      const tag = el.tagName.toLowerCase();
      const allowed = ALLOWED_ATTRIBUTES[tag] ?? [];
      const attrs = Array.from(el.attributes).map((a) => a.name);

      for (const attr of attrs) {
        if (!allowed.includes(attr)) {
          el.removeAttribute(attr);
        }
      }

      // Remove javascript: hrefs
      if (tag === 'a') {
        const href = el.getAttribute('href');
        if (href?.startsWith('javascript:')) {
          el.removeAttribute('href');
        }
      }
    });
  }

  private removeEmptyElements(doc: Document): void {
    const PRESERVE = new Set(['img', 'br', 'hr', 'td', 'th', 'li', 'tr']);
    doc.querySelectorAll('*').forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (!PRESERVE.has(tag) && !el.textContent?.trim() && !el.querySelector('img')) {
        el.remove();
      }
    });
  }
}
