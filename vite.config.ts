import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { existsSync } from 'fs';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const apiUrl = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE_URL?.replace(/\/$/, '');
    if (mode === 'android-debug') {
      if (apiUrl !== 'http://127.0.0.1:3000') {
        throw new Error('Android debug build requires the ADB-reversed local API URL.');
      }
    } else if (apiUrl !== 'https://vda-api.mdtlabs.org') {
      throw new Error('Android production build requires the deployed VDA API URL.');
    }
  }
  return {
    define: { __VDA_FCM_CONFIGURED__: JSON.stringify(existsSync(path.resolve(__dirname, 'android/app/google-services.json'))) },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
