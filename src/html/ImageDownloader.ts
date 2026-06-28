import { writeFile } from 'fs/promises';
import { join } from 'path';
import { JSDOM } from 'jsdom';
import type { LocalImage, ProcessedHtml } from '../types/index.js';
import { getMimeType } from '../utils/mimeType.js';
import type { Logger } from '../utils/logger.js';

export class ImageDownloader {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async download(html: string, tempDir: string): Promise<ProcessedHtml> {
    this.logger.debug('Downloading images');
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const images: LocalImage[] = [];

    const imgElements = Array.from(doc.querySelectorAll('img[src]'));
    this.logger.debug(`Found ${imgElements.length} image(s)`);

    for (let i = 0; i < imgElements.length; i++) {
      const img = imgElements[i];
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:')) continue;

      const result = await this.downloadSingleImage(src, i, tempDir);
      if (result) {
        img.setAttribute('src', result.localPath);
        images.push(result);
      } else {
        img.remove();
      }
    }

    return {
      html: doc.body?.innerHTML ?? html,
      images,
    };
  }

  async downloadCover(url: string, tempDir: string): Promise<LocalImage | null> {
    return this.downloadSingleImage(url, 0, tempDir, 'cover');
  }

  private async downloadSingleImage(
    src: string,
    index: number,
    tempDir: string,
    prefix = 'img',
  ): Promise<LocalImage | null> {
    try {
      const mimeType = getMimeType(src);
      const ext = mimeType.split('/')[1].replace('jpeg', 'jpg');
      const filename = `${prefix}-${index}.${ext}`;
      const localPath = join(tempDir, filename);

      const response = await fetch(src, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
          Referer: new URL(src).origin,
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        this.logger.warn(`Skipping image (HTTP ${response.status}): ${src}`);
        return null;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(localPath, buffer);
      this.logger.debug(`Downloaded: ${filename} (${buffer.length} bytes)`);

      return { originalSrc: src, localPath, filename, mimeType };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to download image: ${src} — ${message}`);
      return null;
    }
  }
}
