import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import caddyTls from 'vite-plugin-caddy-multiple-tls';

function agentSnapCssAsString(): Plugin {
  const cssPath = path.resolve(__dirname, '..', 'src', 'styles', 'agent-snap.css');
  return {
    name: 'agent-snap-css-as-string',
    enforce: 'pre',
    resolveId(source) {
      const normalized = source.replace(/\\/g, '/');
      if (normalized === '@/styles/agent-snap.css') {
        return `${cssPath}?raw`;
      }
      if (normalized.endsWith('/src/styles/agent-snap.css')) {
        return `${cssPath}?raw`;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [agentSnapCssAsString(), caddyTls()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '..', 'src'),
    },
  },
});
