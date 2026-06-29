import { open } from '@tauri-apps/plugin-dialog';
import type { Settings } from '../../types';
import './GeneralTab.css';

interface Props {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
}

export function GeneralTab({ settings, onUpdate }: Props) {
  async function handleChooseFolder() {
    const selected = await open({ directory: true, title: 'Escolher pasta padrão' });
    if (typeof selected === 'string') {
      onUpdate({ defaultFolder: selected });
    }
  }

  return (
    <div className="general-tab">
      <section className="setting-section">
        <h3 className="setting-label">Pasta padrão</h3>
        <p className="setting-description">
          Se configurada, os EPUBs são salvos automaticamente aqui sem perguntar.
        </p>
        <div className="folder-row">
          <span className={`folder-path ${!settings.defaultFolder ? 'folder-path--empty' : ''}`}>
            {settings.defaultFolder ?? 'Nenhuma pasta configurada'}
          </span>
          <button className="btn-secondary" onClick={handleChooseFolder}>
            Escolher pasta
          </button>
          {settings.defaultFolder && (
            <button className="btn-ghost" onClick={() => onUpdate({ defaultFolder: null })}>
              Limpar
            </button>
          )}
        </div>
      </section>

      <section className="setting-section">
        <h3 className="setting-label">Após a geração</h3>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={settings.autoOpenEpub}
            onChange={(e) => onUpdate({ autoOpenEpub: e.target.checked })}
          />
          <span>Abrir EPUB automaticamente</span>
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={settings.autoOpenFolder}
            onChange={(e) => onUpdate({ autoOpenFolder: e.target.checked })}
          />
          <span>Abrir pasta automaticamente</span>
        </label>
      </section>
    </div>
  );
}
