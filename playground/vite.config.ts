import path from 'node:path';
import { defineConfig, type Plugin, type PluginOption } from 'vite';

async function loadCaddyTls(): Promise<PluginOption | null> {
  try {
    const module = await import('vite-plugin-caddy-multiple-tls');
    if (typeof module.default === 'function') {
      const plugin = module.default();
      return plugin || null;
    }
    return null;
  } catch {
    return null;
  }
}

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

export default defineConfig(async () => {
  const caddyTls = await loadCaddyTls();
  const plugins: PluginOption[] = [agentSnapCssAsString()];

  if (caddyTls) {
    plugins.push(caddyTls);
  }

  return {
    base: process.env.VITE_BASE || '/agent-snap/',
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '..', 'src'),
      },
    },
  };
});
