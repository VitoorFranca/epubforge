#!/usr/bin/env node
import { Command } from 'commander';
import { resolve, join } from 'path';
import { existsSync, statSync } from 'fs';
import { Logger } from '../utils/logger.js';
import { slugify } from '../utils/slugify.js';
import { withTempDir } from '../utils/tempDir.js';
import { PlaywrightCrawler } from '../crawler/PlaywrightCrawler.js';
import { ReadabilityParser } from '../readability/ReadabilityParser.js';
import { HtmlCleaner } from '../html/HtmlCleaner.js';
import { HtmlNormalizer } from '../html/HtmlNormalizer.js';
import { ImageDownloader } from '../html/ImageDownloader.js';
import { MetadataExtractor } from '../metadata/MetadataExtractor.js';
import { ArticleExtractor } from '../extractor/ArticleExtractor.js';
import { MediumImporter } from '../extractor/MediumImporter.js';
import { EpubBuilder } from '../epub/EpubBuilder.js';
import type { CliOptions } from '../types/index.js';

const program = new Command();

program
  .name('epubforge')
  .description('Transform web content into high-quality EPUB files for e-readers')
  .version('0.1.0')
  .argument('<url>', 'URL of the article or page to convert')
  .option('-t, --title <title>', 'Override the book title')
  .option('-a, --author <author>', 'Override the author name')
  .option('-o, --output <file>', 'Output file path (default: <title>.epub)')
  .option('-c, --cover <file>', 'Path to a cover image')
  .option('--keep-images', 'Download and embed images', true)
  .option('--no-keep-images', 'Skip image downloading')
  .option('--dark-theme', 'Apply dark theme to the EPUB', false)
  .option('-l, --language <lang>', 'Override the book language (e.g. en, pt, fr)')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (url: string, opts: Record<string, unknown>) => {
    const options: CliOptions = {
      url,
      title: opts['title'] as string | undefined,
      author: opts['author'] as string | undefined,
      output: opts['output'] as string | undefined,
      cover: opts['cover'] as string | undefined,
      keepImages: opts['keepImages'] as boolean,
      darkTheme: opts['darkTheme'] as boolean,
      verbose: opts['verbose'] as boolean,
      language: opts['language'] as string | undefined,
    };

    await run(options);
  });

program.parse();

async function run(options: CliOptions): Promise<void> {
  const logger = new Logger(options.verbose);

  try {
    await checkPandoc(logger);

    logger.info(`Forging EPUB from: ${options.url}`);

    await withTempDir(async (tempDir) => {
      const metaExtractor = new MetadataExtractor(logger);
      const mediumImporter = new MediumImporter(logger);
      const isMedium = mediumImporter.canHandle(options.url);

      let crawlHtml: string;
      let finalUrl: string;
      let parsed;

      if (isMedium) {
        // Medium path: stealth browser fetches SSR HTML, blocks JS to avoid redirect,
        // then exposes both the raw HTML (for metadata) and the extracted article.
        logger.step(1, 6, 'Fetching Medium article (stealth mode)...');
        logger.step(3, 6, 'Parsing article content...');
        logger.debug('Using MediumImporter (stealth + JS-blocked SSR)');
        const mediumResult = await mediumImporter.importWithRawHtml(options.url);
        crawlHtml = mediumResult.html;
        finalUrl = options.url;
        parsed = mediumResult.article;
      } else {
        // Standard path: single Playwright crawl reused for metadata + extraction
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

      // Step 2: Extract metadata (from whichever HTML we fetched)
      logger.step(2, 6, 'Extracting metadata...');
      const metadata = metaExtractor.extract(crawlHtml, finalUrl, parsed.title);

      if (options.title) metadata.title = options.title;
      if (options.author) metadata.author = options.author;
      if (options.language) metadata.language = options.language;

      // Step 4: Download images
      let content = parsed.content;
      let images: import('../types/index.js').LocalImage[] = [];

      if (options.keepImages) {
        logger.step(4, 6, 'Downloading images...');
        const downloader = new ImageDownloader(logger);
        const processed = await downloader.download(content, tempDir);
        content = processed.html;
        images = processed.images;
        logger.info(`  ${images.length} image(s) downloaded`);
      } else {
        logger.step(4, 6, 'Skipping images (--no-keep-images)');
      }

      // Step 5: Handle cover
      let coverImagePath: string | undefined;

      if (options.cover) {
        const resolved = resolve(options.cover);
        if (existsSync(resolved)) {
          coverImagePath = resolved;
          logger.info(`  Using cover: ${resolved}`);
        } else {
          logger.warn(`Cover image not found: ${options.cover}`);
        }
      } else if (metadata.coverUrl && options.keepImages) {
        logger.step(4, 6, 'Downloading cover image...');
        const downloader = new ImageDownloader(logger);
        const cover = await downloader.downloadCover(metadata.coverUrl, tempDir);
        if (cover) {
          coverImagePath = cover.localPath;
        }
      }

      // Step 6: Build EPUB
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
        darkTheme: options.darkTheme,
      });

      logger.step(6, 6, 'Done!');
      logger.success(`Saved: ${result.outputPath} (${formatBytes(result.sizeBytes)})`);
      logger.info(`  Title: ${result.title}`);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(message);
    process.exit(1);
  }
}

function resolveOutputPath(output: string | undefined, title: string): string {
  const filename = `${slugify(title) || 'article'}.epub`;
  if (!output) return resolve(filename);

  const resolved = resolve(output);
  // If the path is an existing directory, write <title>.epub inside it
  if (existsSync(resolved) && statSync(resolved).isDirectory()) {
    return join(resolved, filename);
  }
  // If it looks like a directory name (no extension, doesn't exist yet), treat as dir
  if (!output.endsWith('.epub') && !output.includes('.')) {
    return join(resolved, filename);
  }
  return resolved;
}

async function checkPandoc(logger: Logger): Promise<void> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    await execAsync('pandoc --version');
  } catch {
    logger.error(
      'Pandoc is not installed or not in PATH.\n' +
        '  Install it from https://pandoc.org/installing.html\n' +
        '  macOS: brew install pandoc\n' +
        '  Ubuntu: sudo apt install pandoc',
    );
    process.exit(1);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
