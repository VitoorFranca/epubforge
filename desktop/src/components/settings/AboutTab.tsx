import { invoke } from '@tauri-apps/api/core';
import './AboutTab.css';

declare const __DESKTOP_VERSION__: string;

const REPO_URL = 'https://github.com/vitorfranca/epubforge';

export function AboutTab() {
  function openRepo() {
    invoke('open_path', { path: REPO_URL });
  }

  return (
    <div className="about-tab">
      <table className="about-table">
        <tbody>
          <tr>
            <td className="about-key">EpubForge Desktop</td>
            <td className="about-value">v{__DESKTOP_VERSION__}</td>
          </tr>
          <tr>
            <td className="about-key">Repositório</td>
            <td className="about-value">
              <button className="about-link" onClick={openRepo}>
                github.com/vitorfranca/epubforge
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
