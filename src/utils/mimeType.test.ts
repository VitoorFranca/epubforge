import { describe, it, expect } from 'vitest';
import { getMimeType, getExtensionForMime } from './mimeType.js';

describe('getMimeType', () => {
  it('returns correct mime for jpg', () => {
    expect(getMimeType('https://example.com/photo.jpg')).toBe('image/jpeg');
  });

  it('returns correct mime for png', () => {
    expect(getMimeType('https://example.com/image.png')).toBe('image/png');
  });

  it('handles query strings', () => {
    expect(getMimeType('https://example.com/img.webp?v=1')).toBe('image/webp');
  });

  it('defaults to image/jpeg for unknown extension', () => {
    expect(getMimeType('https://example.com/image.xyz')).toBe('image/jpeg');
  });
});

describe('getExtensionForMime', () => {
  it('returns jpg for image/jpeg', () => {
    expect(getExtensionForMime('image/jpeg')).toBe('jpg');
  });

  it('returns png for image/png', () => {
    expect(getExtensionForMime('image/png')).toBe('png');
  });
});
