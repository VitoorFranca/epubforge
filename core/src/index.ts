import { resolve, join } from 'path';
import { existsSync, statSync } from 'fs';
import { Logger } from './utils/logger.js';
import { slugify } from './utils/slugify.js';
import { withTempDir } from './utils/tempDir.js';
import { PlaywrightCrawler } from './crawler/PlaywrightCrawler.js';
import { ReadabilityParser } from './readability/ReadabilityParser.js';
import { HtmlCleaner } from './html/HtmlCleaner.js';
import { HtmlNormalizer } from './html/HtmlNormalizer.js';
import { ImageDownloader } from './html/ImageDownloader.js';
import { MetadataExtractor } from './metadata/MetadataExtractor.js';
import { ArticleExtractor } from './extractor/ArticleExtractor.js';
import { MediumImporter } from './extractor/MediumImporter.js';
import { EpubBuilder } from './epub/EpubBuilder.js';
import type { LocalImage, EpubBuildResult } from './types/index.js';

export type { EpubBuildResult } from './types/index.js';

export interface GenerateEpubOptions {
  url: string;
  output?: string;
  title?: string;
  author?: string;
  language?: string;
  cover?: string;
  keepImages?: boolean;
  darkTheme?: boolean;
  verbose?: boolean;
}

export async function generateEpub(options: GenerateEpubOptions): Promise<EpubBuildResult> {
  const logger = new Logger(options.verbose ?? false);
  const keepImages = options.keepImages ?? true;

  logger.info(`Forging EPUB from: ${options.url}`);

  return withTempDir(async (tempDir) => {
    const metaExtractor = new MetadataExtractor(logger);
    const mediumImporter = new MediumImporter(logger);
    const isMedium = mediumImporter.canHandle(options.url);

    let crawlHtml: string;
    let finalUrl: string;
    let parsed;

    if (isMedium) {
      logger.step(1, 6, 'Fetching Medium article (stealth mode)...');
      logger.step(3, 6, 'Parsing article content...');
      logger.debug('Using MediumImporter (stealth + JS-blocked SSR)');
      const mediumResult = await mediumImporter.importWithRawHtml(options.url);
      crawlHtml = mediumResult.html;
      finalUrl = options.url;
      parsed = mediumResult.article;
    } else {
      logger.step(1, 6, 'Fetching page...');
      const crawler = new PlaywrightCrawler(logger, { verbose: options.verbose });
      const crawlResult = await crawler.fetch(options.url);
      crawlHtml = crawlResult.html;
      finalUrl = crawlResult.finalUrl;

      logger.step(3, 6, 'Parsing article content...');
      const parser = new ReadabilityParser(logger);
      const cleaner = new HtmlCleaner(logger);
      const normalizer = new HtmlNormalizer(logger);
      const extractor = new ArticleExtractor(crawler, parser, cleaner, normalizer, logger);
      parsed = extractor.extractFromCrawlResult(crawlResult);
    }

    logger.step(2, 6, 'Extracting metadata...');
    const metadata = metaExtractor.extract(crawlHtml, finalUrl, parsed.title);

    if (options.title) metadata.title = options.title;
    if (options.author) metadata.author = options.author;
    if (options.language) metadata.language = options.language;

    let content = parsed.content;
    let images: LocalImage[] = [];

    if (keepImages) {
      logger.step(4, 6, 'Downloading images...');
      const downloader = new ImageDownloader(logger);
      const processed = await downloader.download(content, tempDir);
      content = processed.html;
      images = processed.images;
      logger.info(`  ${images.length} image(s) downloaded`);
    } else {
      logger.step(4, 6, 'Skipping images (--no-keep-images)');
    }

    let coverImagePath: string | undefined;
    if (options.cover) {
      const resolved = resolve(options.cover);
      if (existsSync(resolved)) {
        coverImagePath = resolved;
        logger.info(`  Using cover: ${resolved}`);
      } else {
        logger.warn(`Cover image not found: ${options.cover}`);
      }
    } else if (metadata.coverUrl && keepImages) {
      logger.step(4, 6, 'Downloading cover image...');
      const downloader = new ImageDownloader(logger);
      const cover = await downloader.downloadCover(metadata.coverUrl, tempDir);
      if (cover) {
        coverImagePath = cover.localPath;
      }
    }

    logger.step(5, 6, 'Generating EPUB...');

    const outputPath = resolveOutputPath(options.output, metadata.title);

    const builder = new EpubBuilder(logger);
    const result = await builder.build({
      metadata,
      content,
      images,
      outputPath,
      cssPath: join(tempDir, 'styles.css'),
      coverImagePath,
      darkTheme: options.darkTheme ?? false,
    });

    logger.step(6, 6, 'Done!');
    return result;
  });
}

function resolveOutputPath(output: string | undefined, title: string): string {
  const filename = `${slugify(title) || 'article'}.epub`;
  if (!output) return resolve(filename);

  const resolved = resolve(output);
  if (existsSync(resolved) && statSync(resolved).isDirectory()) {
    return join(resolved, filename);
  }
  if (!output.endsWith('.epub') && !output.includes('.')) {
    return join(resolved, filename);
  }
  return resolved;
}
