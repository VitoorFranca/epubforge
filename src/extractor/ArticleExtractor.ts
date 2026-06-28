import type { ParsedArticle, ImportOptions, CrawlResult } from '../types/index.js';
import type { Importer } from './types.js';
import type { PlaywrightCrawler } from '../crawler/PlaywrightCrawler.js';
import type { ReadabilityParser } from '../readability/ReadabilityParser.js';
import type { HtmlCleaner } from '../html/HtmlCleaner.js';
import type { HtmlNormalizer } from '../html/HtmlNormalizer.js';
import type { Logger } from '../utils/logger.js';

export class ArticleExtractor implements Importer {
  constructor(
    private crawler: PlaywrightCrawler,
    private parser: ReadabilityParser,
    private cleaner: HtmlCleaner,
    private normalizer: HtmlNormalizer,
    private logger: Logger,
  ) {}

  canHandle(source: string): boolean {
    try {
      const url = new URL(source);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  async import(source: string, _options?: ImportOptions): Promise<ParsedArticle> {
    this.logger.debug(`ArticleExtractor importing: ${source}`);
    const crawlResult = await this.crawler.fetch(source);
    return this.extractFromCrawlResult(crawlResult);
  }

  extractFromCrawlResult(crawlResult: CrawlResult): ParsedArticle {
    const parsed = this.parser.parse(crawlResult.html, crawlResult.finalUrl);
    const cleaned = this.cleaner.clean(parsed.content);
    const normalized = this.normalizer.normalize(cleaned, crawlResult.finalUrl);
    return { ...parsed, content: normalized };
  }
}
