import { describe, it, expect, beforeEach } from 'vitest';
import { MetadataExtractor } from './MetadataExtractor.js';
import { Logger } from '../utils/logger.js';

const BASE_URL = 'https://example.com/article';

function makeHtml(head: string, body = '<p>Content</p>'): string {
  return `<html><head>${head}</head><body>${body}</body></html>`;
}

describe('MetadataExtractor', () => {
  let extractor: MetadataExtractor;

  beforeEach(() => {
    extractor = new MetadataExtractor(new Logger(false));
  });

  it('extracts OG title', () => {
    const html = makeHtml('<meta property="og:title" content="My Article">');
    const meta = extractor.extract(html, BASE_URL);
    expect(meta.title).toBe('My Article');
  });

  it('extracts meta author', () => {
    const html = makeHtml('<meta name="author" content="Jane Doe">');
    const meta = extractor.extract(html, BASE_URL);
    expect(meta.author).toBe('Jane Doe');
  });

  it('extracts article published_time as date', () => {
    const html = makeHtml(
      '<meta property="article:published_time" content="2024-03-15T10:00:00Z">',
    );
    const meta = extractor.extract(html, BASE_URL);
    expect(meta.date).toBe('2024-03-15');
  });

  it('extracts lang from html element', () => {
    const html = '<html lang="pt-BR"><head></head><body></body></html>';
    const meta = extractor.extract(html, BASE_URL);
    expect(meta.language).toBe('pt-BR');
  });

  it('extracts OG description', () => {
    const html = makeHtml('<meta property="og:description" content="An interesting read">');
    const meta = extractor.extract(html, BASE_URL);
    expect(meta.description).toBe('An interesting read');
  });

  it('extracts OG image as coverUrl', () => {
    const html = makeHtml('<meta property="og:image" content="https://example.com/cover.jpg">');
    const meta = extractor.extract(html, BASE_URL);
    expect(meta.coverUrl).toBe('https://example.com/cover.jpg');
  });

  it('falls back to h1 for title when no OG tags', () => {
    const html = makeHtml('', '<h1>Article Heading</h1><p>Content</p>');
    const meta = extractor.extract(html, BASE_URL);
    expect(meta.title).toBe('Article Heading');
  });

  it('defaults to Untitled when no title found', () => {
    const html = makeHtml('');
    const meta = extractor.extract(html, BASE_URL);
    expect(meta.title).toBe('Untitled');
  });

  it('stores the url', () => {
    const html = makeHtml('');
    const meta = extractor.extract(html, BASE_URL);
    expect(meta.url).toBe(BASE_URL);
  });
});
