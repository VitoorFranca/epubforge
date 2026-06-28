import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import type { ParsedArticle } from '../types/index.js';
import type { Logger } from '../utils/logger.js';

export class ReadabilityParser {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  parse(html: string, url: string): ParsedArticle {
    this.logger.debug('Parsing article with Readability');

    const dom = new JSDOM(html, { url });
    // keepClasses: true so code block language classes (e.g. "highlight typescript")
    // survive into HtmlCleaner, which then strips everything except allowed attributes.
    const reader = new Readability(dom.window.document, {
      keepClasses: true,
      disableJSONLD: false,
    });

    const article = reader.parse();

    if (!article) {
      throw new Error(
        'Readability could not extract article content. The page may not contain a readable article.',
      );
    }

    this.logger.debug(
      `Extracted article: "${article.title}" (${article.length} chars)`,
    );

    return {
      content: article.content,
      title: article.title,
      excerpt: article.excerpt ?? undefined,
      byline: article.byline ?? undefined,
      length: article.length,
    };
  }
}
