import { useState } from 'react';
import type { Settings } from '../types';
import { GeneralTab } from './settings/GeneralTab';
import { UrlRulesTab } from './settings/UrlRulesTab';
import { AboutTab } from './settings/AboutTab';
import './SettingsModal.css';

type Tab = 'general' | 'rules' | 'about';

interface Props {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onUpdate, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('general');

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Configurações</span>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${activeTab === 'general' ? 'modal-tab--active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            Geral
          </button>
          <button
            className={`modal-tab ${activeTab === 'rules' ? 'modal-tab--active' : ''}`}
            onClick={() => setActiveTab('rules')}
          >
            Regras de URL
          </button>
          <button
            className={`modal-tab ${activeTab === 'about' ? 'modal-tab--active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            Sobre
          </button>
        </div>

        <div className="modal-content">
          {activeTab === 'general' && (
            <GeneralTab settings={settings} onUpdate={onUpdate} />
          )}
          {activeTab === 'rules' && (
            <UrlRulesTab settings={settings} onUpdate={onUpdate} />
          )}
          {activeTab === 'about' && <AboutTab />}
        </div>
      </div>
    </div>
  );
}
