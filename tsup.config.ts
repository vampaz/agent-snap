import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  esbuildOptions(options) {
    options.loader = {
      ...options.loader,
      '.css': 'text',
    };
  },
});
