import { describe, it, expect, beforeEach } from 'vitest';
import { ReadabilityParser } from './ReadabilityParser.js';
import { Logger } from '../utils/logger.js';

const SAMPLE_HTML = `
<html>
  <head><title>Test Article</title></head>
  <body>
    <nav>Navigation Menu</nav>
    <article>
      <h1>My Test Article</h1>
      <p>First paragraph of the article with enough content for Readability to pick up.</p>
      <p>Second paragraph with more text to ensure the content threshold is met by Readability.</p>
      <p>Third paragraph with even more text to make sure Readability considers this an article worth extracting.</p>
    </article>
    <footer>Footer content</footer>
  </body>
</html>
`;

describe('ReadabilityParser', () => {
  let parser: ReadabilityParser;

  beforeEach(() => {
    parser = new ReadabilityParser(new Logger(false));
  });

  it('extracts article content', () => {
    const result = parser.parse(SAMPLE_HTML, 'https://example.com/article');
    expect(result.content).toContain('First paragraph');
  });

  it('extracts article title', () => {
    const result = parser.parse(SAMPLE_HTML, 'https://example.com/article');
    expect(result.title).toBeTruthy();
  });

  it('returns content length', () => {
    const result = parser.parse(SAMPLE_HTML, 'https://example.com/article');
    expect(result.length).toBeGreaterThan(0);
  });

  it('throws when content cannot be extracted', () => {
    // Truly empty body gives Readability nothing to work with
    const emptyHtml = '<html><head></head><body></body></html>';
    expect(() => parser.parse(emptyHtml, 'https://example.com')).toThrow();
  });
});
