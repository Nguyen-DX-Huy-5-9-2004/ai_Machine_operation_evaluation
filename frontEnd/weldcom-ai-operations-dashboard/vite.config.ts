import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const isMock = mode === 'mock';
  const outDir = isMock ? 'dist-mock' : mode === 'api' ? 'dist-api' : 'dist';
  const providerEntry = isMock ? './src/providers/mockProviderEntry.ts' : './src/providers/apiProviderEntry.ts';
  console.log(`DATA_MODE=${mode} OUTPUT=${outDir}`);
  return {
    plugins: [react()],
    resolve: { alias: { '@data-provider': fileURLToPath(new URL(providerEntry, import.meta.url)) } },
    build: { outDir, emptyOutDir: true },
    server: {
      port: isMock ? 5174 : 5173,
      strictPort: true,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000',
          changeOrigin: true
        }
      }
    },
    preview: { host: '127.0.0.1', port: isMock ? 4174 : 4173, strictPort: true }
  };
});
