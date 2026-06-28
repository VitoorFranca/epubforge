import { JSDOM } from 'jsdom';
import type { ArticleMetadata } from '../types/index.js';
import type { Logger } from '../utils/logger.js';

export class MetadataExtractor {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  extract(html: string, url: string, articleTitle?: string): ArticleMetadata {
    this.logger.debug('Extracting metadata');
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    const title = this.extractTitle(doc, articleTitle);
    const author = this.extractAuthor(doc);
    const date = this.extractDate(doc);
    const language = this.extractLanguage(doc);
    const description = this.extractDescription(doc);
    const coverUrl = this.extractCoverUrl(doc, url);
    const publisher = this.extractPublisher(doc, url);

    this.logger.debug(`Metadata: title="${title}", author="${author ?? 'unknown'}"`);

    return { title, author, date, language, description, coverUrl, publisher, url };
  }

  private extractTitle(doc: Document, fallback?: string): string {
    return (
      this.getMeta(doc, 'og:title') ||
      this.getMeta(doc, 'twitter:title') ||
      doc.querySelector('h1')?.textContent?.trim() ||
      doc.title?.trim() ||
      fallback ||
      'Untitled'
    );
  }

  private extractAuthor(doc: Document): string | undefined {
    return (
      this.getMeta(doc, 'author') ??
      this.getMeta(doc, 'article:author') ??
      this.getMeta(doc, 'twitter:creator') ??
      doc.querySelector('[rel="author"]')?.textContent?.trim() ??
      doc.querySelector('.author, .byline, [itemprop="author"]')?.textContent?.trim() ??
      undefined
    );
  }

  private extractDate(doc: Document): string | undefined {
    const raw =
      this.getMeta(doc, 'article:published_time') ??
      this.getMeta(doc, 'date') ??
      this.getMeta(doc, 'DC.date') ??
      doc.querySelector('time[datetime]')?.getAttribute('datetime') ??
      undefined;

    if (!raw) return undefined;

    const parsed = new Date(raw);
    if (isNaN(parsed.getTime())) return undefined;

    return parsed.toISOString().split('T')[0];
  }

  private extractLanguage(doc: Document): string | undefined {
    return (
      doc.documentElement.getAttribute('lang') ??
      doc.documentElement.getAttribute('xml:lang') ??
      this.getMeta(doc, 'language') ??
      this.getMeta(doc, 'og:locale')?.replace('_', '-') ??
      undefined
    );
  }

  private extractDescription(doc: Document): string | undefined {
    return (
      this.getMeta(doc, 'description') ??
      this.getMeta(doc, 'og:description') ??
      this.getMeta(doc, 'twitter:description') ??
      undefined
    );
  }

  private extractCoverUrl(doc: Document, baseUrl: string): string | undefined {
    const ogImage = this.getMeta(doc, 'og:image');
    if (ogImage) {
      return this.resolveUrl(ogImage, baseUrl);
    }

    const twitterImage = this.getMeta(doc, 'twitter:image');
    if (twitterImage) {
      return this.resolveUrl(twitterImage, baseUrl);
    }

    return undefined;
  }

  private extractPublisher(doc: Document, baseUrl: string): string | undefined {
    return (
      this.getMeta(doc, 'og:site_name') ??
      new URL(baseUrl).hostname.replace('www.', '') ??
      undefined
    );
  }

  private getMeta(doc: Document, name: string): string | undefined {
    const byName = doc.querySelector(
      `meta[name="${name}"], meta[property="${name}"]`,
    );
    return byName?.getAttribute('content')?.trim() ?? undefined;
  }

  private resolveUrl(url: string, base: string): string {
    try {
      return new URL(url, base).toString();
    } catch {
      return url;
    }
  }
}
