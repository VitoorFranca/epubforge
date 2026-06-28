const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
};

export function getMimeType(url: string): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  return MIME_MAP[ext] ?? 'image/jpeg';
}

export function getExtensionForMime(mime: string): string {
  const entries = Object.entries(MIME_MAP);
  return entries.find(([, v]) => v === mime)?.[0] ?? 'jpg';
}
