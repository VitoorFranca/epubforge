import { useState } from 'react';
import type { Settings, UrlRule } from '../../types';
import './UrlRulesTab.css';

interface Props {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
}

const EMPTY_FORM = { name: '', domain: '', prefix: '' };

export function UrlRulesTab({ settings, onUpdate }: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  function handleAdd() {
    const name = form.name.trim();
    const domain = form.domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const prefix = form.prefix.trim();

    if (!name || !domain || !prefix) {
      setError('Todos os campos são obrigatórios.');
      return;
    }
    if (!prefix.startsWith('http')) {
      setError('O prefixo deve começar com http:// ou https://');
      return;
    }

    const newRule: UrlRule = { id: crypto.randomUUID(), name, domain, prefix };
    onUpdate({ urlRules: [...settings.urlRules, newRule] });
    setForm(EMPTY_FORM);
    setError('');
  }

  function handleRemove(id: string) {
    onUpdate({ urlRules: settings.urlRules.filter((r) => r.id !== id) });
  }

  return (
    <div className="rules-tab">
      {settings.urlRules.length > 0 ? (
        <ul className="rules-list">
          {settings.urlRules.map((rule) => (
            <li key={rule.id} className="rule-item">
              <div className="rule-info">
                <span className="rule-name">{rule.name}</span>
                <span className="rule-detail">
                  {rule.domain} → {rule.prefix}
                </span>
              </div>
              <button className="rule-remove" onClick={() => handleRemove(rule.id)} title="Remover regra">
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rules-empty">Nenhuma regra configurada.</p>
      )}

      <div className="rule-form">
        <h3 className="rule-form-title">Adicionar regra</h3>
        <div className="rule-form-fields">
          <div className="field">
            <label className="field-label">Nome</label>
            <input
              className="field-input"
              placeholder="Medium"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field-label">Domínio</label>
            <input
              className="field-input"
              placeholder="medium.com"
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field-label">Substituir por (prefixo)</label>
            <input
              className="field-input"
              placeholder="https://freedium.cfd/"
              value={form.prefix}
              onChange={(e) => setForm({ ...form, prefix: e.target.value })}
            />
          </div>
        </div>
        {error && <p className="rule-error">{error}</p>}
        <button className="btn-add" onClick={handleAdd}>
          Adicionar
        </button>
      </div>
    </div>
  );
}
