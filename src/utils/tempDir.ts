import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export async function createTempDir(prefix = 'epubforge-'): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function cleanupTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

export async function withTempDir<T>(
  fn: (dir: string) => Promise<T>,
  prefix = 'epubforge-',
): Promise<T> {
  const dir = await createTempDir(prefix);
  try {
    return await fn(dir);
  } finally {
    await cleanupTempDir(dir);
  }
}
