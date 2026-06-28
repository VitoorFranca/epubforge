import { JSDOM } from 'jsdom';
import type { Logger } from '../utils/logger.js';

export class HtmlNormalizer {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  normalize(html: string, baseUrl: string): string {
    this.logger.debug('Normalizing HTML');
    const dom = new JSDOM(html, { url: baseUrl });
    const doc = dom.window.document;

    this.resolveRelativeUrls(doc, baseUrl);
    this.normalizeHeadings(doc);
    this.normalizeCodeBlocks(doc);
    this.normalizeTables(doc);
    this.removeExcessiveLineBreaks(doc);
    this.wrapOrphanedText(doc);

    return doc.body?.innerHTML ?? html;
  }

  private resolveRelativeUrls(doc: Document, baseUrl: string): void {
    doc.querySelectorAll('a[href]').forEach((el) => {
      const href = el.getAttribute('href');
      if (href && !href.startsWith('#')) {
        try {
          el.setAttribute('href', new URL(href, baseUrl).toString());
        } catch {
          // Leave as is if URL parsing fails
        }
      }
    });

    doc.querySelectorAll('img[src]').forEach((el) => {
      const src = el.getAttribute('src');
      if (src && !src.startsWith('data:')) {
        try {
          el.setAttribute('src', new URL(src, baseUrl).toString());
        } catch {
          // Leave as is
        }
      }
    });
  }

  private normalizeHeadings(doc: Document): void {
    // Ensure heading hierarchy starts at h2 if there's an h1 already as title
    const h1s = doc.querySelectorAll('h1');
    if (h1s.length > 1) {
      // Promote all headings down one level if multiple h1s exist
      const headingMap: Record<string, string> = {
        H1: 'h2',
        H2: 'h3',
        H3: 'h4',
        H4: 'h5',
        H5: 'h6',
        H6: 'h6',
      };
      doc.querySelectorAll('h1, h2, h3, h4, h5').forEach((el) => {
        const newTag = headingMap[el.tagName];
        if (newTag) {
          const newEl = doc.createElement(newTag);
          newEl.innerHTML = el.innerHTML;
          el.replaceWith(newEl);
        }
      });
    }
  }

  private normalizeCodeBlocks(doc: Document): void {
    doc.querySelectorAll('pre code, pre').forEach((el) => {
      // Detect language from class (e.g. language-js, lang-python)
      const cls = el.getAttribute('class') ?? '';
      const langMatch = cls.match(/(?:language|lang)-(\w+)/);
      if (langMatch && el.tagName === 'CODE') {
        el.setAttribute('class', `language-${langMatch[1]}`);
      }

      // Preserve whitespace by removing extraneous HTML inside pre
      if (el.tagName === 'PRE') {
        const text = el.textContent ?? '';
        const code = el.querySelector('code');
        if (!code) {
          const codeEl = doc.createElement('code');
          codeEl.textContent = text;
          el.innerHTML = '';
          el.appendChild(codeEl);
        }
      }
    });
  }

  private normalizeTables(doc: Document): void {
    doc.querySelectorAll('table').forEach((table) => {
      const wrapper = doc.createElement('div');
      wrapper.setAttribute('class', 'table-wrapper');
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }

  private removeExcessiveLineBreaks(doc: Document): void {
    doc.querySelectorAll('br + br').forEach((el) => el.remove());
  }

  private wrapOrphanedText(doc: Document): void {
    // Wrap direct text nodes in body that are not inside block elements
    const body = doc.body;
    if (!body) return;

    const blockTags = new Set([
      'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE',
      'FIGURE', 'FIGCAPTION', 'ARTICLE', 'SECTION',
    ]);

    Array.from(body.childNodes).forEach((node) => {
      if (
        node.nodeType === 3 &&
        node.textContent?.trim()
      ) {
        const p = doc.createElement('p');
        p.textContent = node.textContent;
        body.replaceChild(p, node);
      } else if (
        node.nodeType === 1 &&
        !blockTags.has((node as Element).tagName)
      ) {
        const p = doc.createElement('p');
        p.appendChild(node.cloneNode(true));
        body.replaceChild(p, node);
      }
    });
  }
}
