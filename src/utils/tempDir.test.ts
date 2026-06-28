import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { createTempDir, cleanupTempDir, withTempDir } from './tempDir.js';

describe('tempDir', () => {
  it('creates a temp directory', async () => {
    const dir = await createTempDir();
    expect(existsSync(dir)).toBe(true);
    await cleanupTempDir(dir);
  });

  it('removes directory after cleanup', async () => {
    const dir = await createTempDir();
    await cleanupTempDir(dir);
    expect(existsSync(dir)).toBe(false);
  });

  it('withTempDir provides a valid dir and cleans up', async () => {
    let capturedDir = '';
    await withTempDir(async (dir) => {
      capturedDir = dir;
      expect(existsSync(dir)).toBe(true);
    });
    expect(existsSync(capturedDir)).toBe(false);
  });

  it('withTempDir cleans up even when fn throws', async () => {
    let capturedDir = '';
    await expect(
      withTempDir(async (dir) => {
        capturedDir = dir;
        throw new Error('test error');
      }),
    ).rejects.toThrow('test error');
    expect(existsSync(capturedDir)).toBe(false);
  });
});
