import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save, message } from '@tauri-apps/plugin-dialog';
import { Readability } from '@mozilla/readability';
import { UrlInput } from './components/UrlInput';
import { GenerateButton } from './components/GenerateButton';
import { StatusCard } from './components/StatusCard';
import { SettingsButton } from './components/SettingsButton';
import { SettingsModal } from './components/SettingsModal';
import { useSettings } from './hooks/useSettings';
import type { Status, GenerateResult, UrlRule } from './types';
import './App.css';

interface FetchResult {
  html: string;
  finalUrl: string;
}

interface ImageRef {
  url: string;
  name: string;
}

function applyUrlRules(url: string, rules: UrlRule[]): string {
  for (const rule of rules) {
    try {
      const hostname = new URL(url).hostname;
      if (hostname === rule.domain || hostname.endsWith('.' + rule.domain)) {
        return rule.prefix + url;
      }
    } catch { /* invalid URL — skip rule */ }
  }
  return url;
}

/**
 * Processes Readability article content:
 * 1. Resolves all img src to absolute URLs
 * 2. Assigns local names (images/img-N.ext) and collects the download list
 * 3. Removes <source> and responsive attributes not meaningful in EPUB
 * 4. Serializes to valid XHTML via XMLSerializer (self-closes void elements)
 */
function processContent(
  html: string,
  baseUrl: string,
): { xhtml: string; images: ImageRef[] } {
  const container = document.createElement('div');
  container.innerHTML = html;

  const images: ImageRef[] = [];
  let idx = 0;

  container.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) return; // keep data URIs as-is

    try {
      const absUrl = new URL(src, baseUrl).href;
      const urlPath = absUrl.split('?')[0].split('#')[0];
      const rawExt = urlPath.split('.').pop()?.toLowerCase() ?? '';
      const ext = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(rawExt)
        ? rawExt === 'jpeg' ? 'jpg' : rawExt
        : 'jpg';
      const name = `images/img-${idx++}.${ext}`;

      images.push({ url: absUrl, name });
      img.setAttribute('src', name);
    } catch {
      img.removeAttribute('src');
    }

    // These attributes aren't meaningful in EPUB readers
    img.removeAttribute('srcset');
    img.removeAttribute('loading');
    img.removeAttribute('decoding');
    img.removeAttribute('sizes');
  });

  // <source> inside <picture>/<video>/<audio> references URLs we're not embedding
  container.querySelectorAll('source').forEach((s) => s.remove());

  // Serialize the DOM back to valid XHTML — XMLSerializer self-closes void
  // elements like <img>, <br>, <hr>, <source>, fixing the EPUB validator errors
  const serializer = new XMLSerializer();
  const xhtml = Array.from(container.childNodes)
    .map((node) => serializer.serializeToString(node))
    .join('');

  return { xhtml, images };
}

export default function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [showSettings, setShowSettings] = useState(false);
  const { settings, updateSettings, isReady } = useSettings();
  const isGenerating = status.kind === 'generating';

  async function handleGenerate() {
    if (!url.trim() || isGenerating) return;

    const effectiveUrl = applyUrlRules(url.trim(), settings.urlRules);

    let outputPath: string;
    if (settings.defaultFolder) {
      const slug =
        effectiveUrl.split('/').filter(Boolean).pop()?.replace(/[^a-z0-9]+/gi, '-').toLowerCase() ??
        'article';
      outputPath = `${settings.defaultFolder}/${slug}.epub`;
    } else {
      const selected = await save({
        title: 'Salvar EPUB',
        filters: [{ name: 'EPUB', extensions: ['epub'] }],
        defaultPath: 'article.epub',
      });
      if (!selected) return;
      outputPath = selected;
    }

    setStatus({ kind: 'generating' });

    try {
      // Step 1: Rust fetches the HTML (bypasses CORS, follows redirects)
      const { html, finalUrl } = await invoke<FetchResult>('fetch_url', { url: effectiveUrl });

      // Step 2: Readability extracts the article content from the DOM
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const base = doc.createElement('base');
      base.href = finalUrl;
      doc.head.prepend(base);

      const reader = new Readability(doc);
      const article = reader.parse();

      if (!article?.content) {
        throw new Error(
          'Não foi possível extrair o conteúdo desta página. ' +
          'Verifique se a URL está correta e acessível.',
        );
      }

      // Step 3: Convert HTML→XHTML and collect image download list
      const { xhtml, images } = processContent(article.content, finalUrl);

      // Step 4: Rust builds the EPUB (epub-builder crate, downloads images)
      const result = await invoke<GenerateResult>('build_epub', {
        article: {
          title: article.title || new URL(finalUrl).hostname,
          content: xhtml,
          excerpt: article.excerpt,
          byline: article.byline,
          lang: article.lang,
          siteName: article.siteName,
          publishedTime: article.publishedTime,
          images,
        },
        outputPath,
      });

      setStatus({ kind: 'done', title: result.title, outputPath: result.outputPath });

      if (settings.autoOpenEpub) await invoke('open_path', { path: result.outputPath });
      if (settings.autoOpenFolder) {
        const folder = result.outputPath.split('/').slice(0, -1).join('/');
        await invoke('open_path', { path: folder });
      }
    } catch (err) {
      const errorMessage = typeof err === 'string' ? err : String(err);
      await message(errorMessage, { title: 'Não foi possível gerar o EPUB', kind: 'error' });
      setStatus({ kind: 'idle' });
    }
  }

  return (
    <div className="app">
      {isReady && <SettingsButton onClick={() => setShowSettings(true)} />}

      <h1 className="app-title">EpubForge</h1>
      <p className="app-subtitle">Transforme páginas da web em EPUB.</p>
      <UrlInput value={url} onChange={setUrl} disabled={isGenerating} />
      <GenerateButton onClick={handleGenerate} disabled={!url.trim() || isGenerating} />
      <StatusCard status={status} />

      {showSettings && isReady && (
        <SettingsModal
          settings={settings}
          onUpdate={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
