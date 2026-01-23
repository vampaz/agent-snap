import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

function uiAnnotatorCssAsString(): Plugin {
  const cssPath = path.resolve(__dirname, '..', 'src', 'styles', 'ui-annotator.css');
  return {
    name: 'ui-annotator-css-as-string',
    enforce: 'pre',
    resolveId(source) {
      const normalized = source.replace(/\\/g, '/');
      if (normalized === '@/styles/ui-annotator.css') {
        return `${cssPath}?raw`;
      }
      if (normalized.endsWith('/src/styles/ui-annotator.css')) {
        return `${cssPath}?raw`;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [uiAnnotatorCssAsString()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '..', 'src'),
    },
  },
});
