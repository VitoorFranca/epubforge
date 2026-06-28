import { describe, it, expect } from 'vitest';
import { slugify } from './slugify.js';

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('removes accents', () => {
    expect(slugify('Café São Paulo')).toBe('cafe-sao-paulo');
  });

  it('strips special characters', () => {
    expect(slugify('My Article! (2024)')).toBe('my-article-2024');
  });

  it('collapses multiple hyphens', () => {
    expect(slugify('Hello   World')).toBe('hello-world');
  });

  it('truncates at 80 characters', () => {
    const long = 'a'.repeat(100);
    expect(slugify(long).length).toBeLessThanOrEqual(80);
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });
});
