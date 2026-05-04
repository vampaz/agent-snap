import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import type { ViteDevServer } from 'vite';

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, 'src');

let server: ViteDevServer | null = null;
let appRoot = '';
let appUrl = '';

async function createFixtureApp(root: string): Promise<void> {
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(
    path.join(root, 'index.html'),
    [
      '<!doctype html>',
      '<html>',
      '  <head>',
      '    <meta charset="UTF-8" />',
      '    <title>Agent Snap Vite Plugin Fixture</title>',
      '  </head>',
      '  <body>',
      '    <main>',
      '      <h1>Plugin fixture</h1>',
      '      <button data-testid="target-button">Save changes</button>',
      '    </main>',
      '    <script type="module" src="/src/main.ts"></script>',
      '  </body>',
      '</html>',
    ].join('\n'),
    'utf8',
  );
  await writeFile(path.join(root, 'src', 'main.ts'), "import './style.css';\n", 'utf8');
  await writeFile(
    path.join(root, 'src', 'style.css'),
    [
      'body {',
      '  min-height: 100vh;',
      '  margin: 0;',
      '  display: grid;',
      '  place-items: center;',
      '  font-family: Arial, sans-serif;',
      '}',
      'main {',
      '  display: grid;',
      '  gap: 16px;',
      '}',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    path.join(root, 'vite.config.ts'),
    [
      `import agentSnap from ${JSON.stringify(path.join(srcRoot, 'vite.ts'))};`,
      '',
      'export default {',
      '  plugins: [',
      '    agentSnap({',
      '      settings: {',
      "        outputDetail: 'detailed',",
      '      },',
      '    }),',
      '  ],',
      '  resolve: {',
      '    alias: {',
      `      '@': ${JSON.stringify(srcRoot)},`,
      `      'agent-snap': ${JSON.stringify(path.join(srcRoot, 'index.ts'))},`,
      '    },',
      '  },',
      '};',
    ].join('\n'),
    'utf8',
  );
}

test.describe('Agent Snap Vite plugin', function () {
  test.beforeAll(async function () {
    const { createServer, loadConfigFromFile, mergeConfig } = await import('vite');
    appRoot = await mkdtemp(path.join(os.tmpdir(), 'agent-snap-vite-e2e-'));
    await createFixtureApp(appRoot);
    const loadedConfig = await loadConfigFromFile(
      {
        command: 'serve',
        mode: 'development',
      },
      path.join(appRoot, 'vite.config.ts'),
    );

    if (!loadedConfig) {
      throw new Error('Could not load Vite fixture config.');
    }

    server = await createServer(
      mergeConfig(loadedConfig.config, {
        root: appRoot,
        logLevel: 'silent',
        server: {
          host: '127.0.0.1',
          port: 0,
        },
      }),
    );

    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === 'string') {
      throw new Error('Could not resolve Vite fixture server address.');
    }
    appUrl = `http://127.0.0.1:${address.port}`;
  });

  test.afterAll(async function () {
    if (server) {
      await server.close();
      server = null;
    }
    if (appRoot) {
      await rm(appRoot, { recursive: true, force: true });
      appRoot = '';
    }
  });

  test('injects Agent Snap and saves copied snapshots to the Vite project root', async function ({
    page,
  }) {
    await page.goto(appUrl);

    await expect(page.getByTestId('toolbar')).toBeVisible();
    await page.getByTestId('as-toggle').click({ force: true });
    await expect(page.getByTestId('toolbar-container')).toHaveClass(/as-expanded/);

    await page.getByTestId('target-button').click({ force: true });
    await page.getByTestId('popup-textarea').fill('Persist this snap locally');
    await page.getByTestId('popup-submit').click();

    const copyButton = page.getByTestId('toolbar-copy-button');
    await expect(copyButton).toBeEnabled();
    await copyButton.click();

    const snapshotPath = path.join(appRoot, 'agent-snapshots', 'latest.md');
    await expect
      .poll(async function readSnapshot() {
        return readFile(snapshotPath, 'utf8').catch(function handleMissingFile() {
          return '';
        });
      })
      .toContain('Persist this snap locally');

    const snapshot = await readFile(snapshotPath, 'utf8');
    expect(snapshot).toContain('Plugin fixture');
    expect(snapshot).toContain('button');
    expect(snapshot).toContain('**Coords:**');
    expect(snapshot).toContain('agent-snap-annotation-1-screenshot');

    const screenshotPath = path.join(
      appRoot,
      'agent-snapshots',
      'agent-snap-downloads',
      'agent-snap-annotation-1-screenshot.jpg',
    );
    const screenshot = await readFile(screenshotPath);
    expect(screenshot.byteLength).toBeGreaterThan(100);
    expect(screenshot[0]).toBe(0xff);
    expect(screenshot[1]).toBe(0xd8);
  });
});
