import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save, message } from '@tauri-apps/plugin-dialog';
import { UrlInput } from './components/UrlInput';
import { GenerateButton } from './components/GenerateButton';
import { StatusCard } from './components/StatusCard';
import type { Status, GenerateResult } from './types';
import './App.css';

export default function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const isGenerating = status.kind === 'generating';

  async function handleGenerate() {
    if (!url.trim() || isGenerating) return;

    const outputPath = await save({
      title: 'Salvar EPUB',
      filters: [{ name: 'EPUB', extensions: ['epub'] }],
      defaultPath: 'article.epub',
    });

    if (!outputPath) return;

    setStatus({ kind: 'generating' });

    try {
      const result = await invoke<GenerateResult>('generate_epub', {
        url: url.trim(),
        outputPath,
      });
      setStatus({ kind: 'done', title: result.title, outputPath: result.outputPath });
    } catch (err) {
      const errorMessage = typeof err === 'string' ? err : String(err);
      await message(errorMessage, {
        title: 'Não foi possível gerar o EPUB',
        kind: 'error',
      });
      setStatus({ kind: 'idle' });
    }
  }

  return (
    <div className="app">
      <h1 className="app-title">EpubForge</h1>
      <p className="app-subtitle">Transforme páginas da web em EPUB.</p>
      <UrlInput value={url} onChange={setUrl} disabled={isGenerating} />
      <GenerateButton onClick={handleGenerate} disabled={!url.trim() || isGenerating} />
      <StatusCard status={status} />
    </div>
  );
}
