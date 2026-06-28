import { describe, it, expect, beforeEach } from 'vitest';
import { HtmlCleaner } from './HtmlCleaner.js';
import { Logger } from '../utils/logger.js';

describe('HtmlCleaner', () => {
  let cleaner: HtmlCleaner;

  beforeEach(() => {
    cleaner = new HtmlCleaner(new Logger(false));
  });

  it('removes script tags', () => {
    const html = '<p>Hello</p><script>alert("xss")</script>';
    const result = cleaner.clean(html);
    expect(result).not.toContain('<script>');
    expect(result).toContain('Hello');
  });

  it('removes style tags', () => {
    const html = '<p>World</p><style>body{color:red}</style>';
    const result = cleaner.clean(html);
    expect(result).not.toContain('<style>');
    expect(result).toContain('World');
  });

  it('removes iframes', () => {
    const html = '<p>Content</p><iframe src="ads.html"></iframe>';
    const result = cleaner.clean(html);
    expect(result).not.toContain('<iframe');
  });

  it('strips disallowed attributes', () => {
    const html = '<p class="fancy" data-track="1" style="color:red">Text</p>';
    const result = cleaner.clean(html);
    expect(result).not.toContain('class=');
    expect(result).not.toContain('data-track=');
    expect(result).not.toContain('style=');
    expect(result).toContain('Text');
  });

  it('preserves allowed anchor attributes', () => {
    const html = '<a href="https://example.com" title="Link">Click</a>';
    const result = cleaner.clean(html);
    expect(result).toContain('href=');
    expect(result).toContain('title=');
  });

  it('removes javascript: hrefs', () => {
    const html = '<a href="javascript:void(0)">Click</a>';
    const result = cleaner.clean(html);
    expect(result).not.toContain('javascript:');
  });

  it('preserves image src and alt', () => {
    const html = '<img src="https://example.com/img.jpg" alt="photo">';
    const result = cleaner.clean(html);
    expect(result).toContain('src=');
    expect(result).toContain('alt=');
  });
});
