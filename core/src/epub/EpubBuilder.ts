import { writeFile, copyFile, readFile, mkdir } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { stat } from 'fs/promises';
import type { EpubOptions, EpubBuildResult } from '../types/index.js';
import type { Logger } from '../utils/logger.js';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLED_CSS = resolve(__dirname, 'assets', 'styles.css');

export class EpubBuilder {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async build(options: EpubOptions): Promise<EpubBuildResult> {
    const { metadata, content, images, outputPath, darkTheme } = options;

    const workDir = join(outputPath, '..', '.epubforge-work');
    await mkdir(workDir, { recursive: true });

    try {
      const cssPath = await this.prepareCss(workDir, darkTheme);
      const htmlPath = await this.writeHtml(workDir, content, metadata.title, cssPath);

      if (metadata.coverUrl && options.coverImagePath) {
        await this.prepareCoverImage(options.coverImagePath, workDir);
      }

      const pandocArgs = this.buildPandocArgs({
        htmlPath,
        outputPath,
        cssPath,
        metadata,
        coverImagePath: options.coverImagePath ? join(workDir, 'cover.jpg') : undefined,
        images,
        workDir,
      });

      this.logger.debug(`Running pandoc: ${pandocArgs.slice(0, 4).join(' ')} ...`);
      await this.runPandoc(pandocArgs);

      const { size } = await stat(outputPath);
      return { outputPath, title: metadata.title, sizeBytes: size };
    } finally {
      // workDir is inside the outputPath's parent — cleaned up by caller's tempDir
    }
  }

  private async prepareCss(workDir: string, darkTheme?: boolean): Promise<string> {
    let css = await readFile(BUNDLED_CSS, 'utf-8');

    if (darkTheme) {
      css = css.replace('/* Dark theme override placeholder */', '');
      css += '\nbody { background-color: #1a1a1a !important; color: #e0e0e0 !important; }';
    }

    const cssPath = join(workDir, 'styles.css');
    await writeFile(cssPath, css, 'utf-8');
    return cssPath;
  }

  private async writeHtml(
    workDir: string,
    content: string,
    title: string,
    cssPath: string,
  ): Promise<string> {
    const htmlPath = join(workDir, 'content.html');
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${this.escapeHtml(title)}</title>
  <link rel="stylesheet" href="${cssPath}">
</head>
<body>
${content}
</body>
</html>`;
    await writeFile(htmlPath, html, 'utf-8');
    return htmlPath;
  }

  private async prepareCoverImage(coverImagePath: string, workDir: string): Promise<void> {
    try {
      await copyFile(coverImagePath, join(workDir, 'cover.jpg'));
    } catch {
      // Cover image is optional
    }
  }

  private buildPandocArgs(params: {
    htmlPath: string;
    outputPath: string;
    cssPath: string;
    metadata: EpubOptions['metadata'];
    coverImagePath?: string;
    images: EpubOptions['images'];
    workDir: string;
  }): string[] {
    const { htmlPath, outputPath, cssPath, metadata, coverImagePath } = params;

    const args = [
      'pandoc',
      htmlPath,
      '-o', outputPath,
      '--to', 'epub3',
      '--css', cssPath,
      '--toc',
      '--toc-depth=3',
      '--split-level=2',
      `--metadata=title:${this.shellEscape(metadata.title)}`,
      `--metadata=lang:${metadata.language ?? 'en'}`,
    ];

    // Skip author if it looks like a raw username handle (e.g. "@" or "@user")
    const author = metadata.author;
    const isValidAuthor = author && author.length > 1 && !author.match(/^@\w*$/);
    if (isValidAuthor) {
      args.push(`--metadata=author:${this.shellEscape(author)}`);
    }

    if (metadata.date) {
      args.push(`--metadata=date:${metadata.date}`);
    }

    if (metadata.description) {
      args.push(`--metadata=description:${this.shellEscape(metadata.description)}`);
    }

    if (metadata.publisher) {
      args.push(`--metadata=publisher:${this.shellEscape(metadata.publisher)}`);
    }

    if (coverImagePath) {
      args.push(`--epub-cover-image=${coverImagePath}`);
    }

    return args;
  }

  private async runPandoc(args: string[]): Promise<void> {
    const command = args.join(' ');
    try {
      await execAsync(command, { maxBuffer: 50 * 1024 * 1024 });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Pandoc failed: ${message}`);
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private shellEscape(text: string): string {
    return `"${text.replace(/"/g, '\\"')}"`;
  }
}
