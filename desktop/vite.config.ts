import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import desktopPkg from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  define: {
    __DESKTOP_VERSION__: JSON.stringify(desktopPkg.version),
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
