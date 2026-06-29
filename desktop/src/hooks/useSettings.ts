import { useState, useEffect, useRef } from 'react';
import { load, Store } from '@tauri-apps/plugin-store';
import type { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

const STORE_KEY = 'settings';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isReady, setIsReady] = useState(false);
  const storeRef = useRef<Store | null>(null);

  useEffect(() => {
    let cancelled = false;
    load('settings.json', { defaults: { [STORE_KEY]: DEFAULT_SETTINGS } }).then(async (store) => {
      if (cancelled) return;
      storeRef.current = store;
      const saved = await store.get<Settings>(STORE_KEY);
      if (!cancelled) {
        setSettings(saved ? { ...DEFAULT_SETTINGS, ...saved } : DEFAULT_SETTINGS);
        setIsReady(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  async function updateSettings(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    if (storeRef.current) {
      await storeRef.current.set(STORE_KEY, next);
    }
  }

  return { settings, updateSettings, isReady };
}
