#!/usr/bin/env node
import { Command } from 'commander';
import { generateEpub } from '@epubforge/core';

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
    try {
      await checkPandoc();
      const result = await generateEpub({
        url,
        output: opts['output'] as string | undefined,
        title: opts['title'] as string | undefined,
        author: opts['author'] as string | undefined,
        language: opts['language'] as string | undefined,
        cover: opts['cover'] as string | undefined,
        keepImages: opts['keepImages'] as boolean,
        darkTheme: opts['darkTheme'] as boolean,
        verbose: opts['verbose'] as boolean,
      });
      process.stdout.write(`✓ Saved: ${result.outputPath} (${formatBytes(result.sizeBytes)})\n`);
      process.stdout.write(`  Title: ${result.title}\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`✗ ${message}\n`);
      process.exit(1);
    }
  });

program.parse();

async function checkPandoc(): Promise<void> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  try {
    await execAsync('pandoc --version');
  } catch {
    process.stderr.write(
      '✗ Pandoc is not installed or not in PATH.\n' +
        '  Install it from https://pandoc.org/installing.html\n' +
        '  macOS: brew install pandoc\n' +
        '  Ubuntu: sudo apt install pandoc\n',
    );
    process.exit(1);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
