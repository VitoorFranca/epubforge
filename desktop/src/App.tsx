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
      // Step 1: Fetch HTML in Rust (bypasses CORS, handles redirects)
      const { html, finalUrl } = await invoke<FetchResult>('fetch_url', { url: effectiveUrl });

      // Step 2: Extract article content with Readability (runs in browser DOM)
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Set base so relative URLs in images/links resolve correctly
      const base = doc.createElement('base');
      base.href = finalUrl;
      doc.head.prepend(base);

      const reader = new Readability(doc);
      const article = reader.parse();

      if (!article || !article.content) {
        throw new Error(
          'Não foi possível extrair o conteúdo desta página. Tente uma URL diferente ou verifique se a página está acessível.',
        );
      }

      // Step 3: Build EPUB in Rust (epub-builder crate, no Pandoc needed)
      const result = await invoke<GenerateResult>('build_epub', {
        article: {
          title: article.title || new URL(finalUrl).hostname,
          content: article.content,
          excerpt: article.excerpt,
          byline: article.byline,
          lang: article.lang,
          siteName: article.siteName,
          publishedTime: article.publishedTime,
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
