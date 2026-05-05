import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import type { ViteDevServer } from 'vite';

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, 'src');

let server: ViteDevServer | null = null;
let projectRoot = '';
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
      `      projectRoot: ${JSON.stringify(path.dirname(root))},`,
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
    projectRoot = await mkdtemp(path.join(os.tmpdir(), 'agent-snap-vite-e2e-'));
    appRoot = path.join(projectRoot, 'playground');
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
    if (projectRoot) {
      await rm(projectRoot, { recursive: true, force: true });
      projectRoot = '';
      appRoot = '';
    }
  });

  test('injects Agent Snap and saves copied snapshots to the configured project root', async function ({
    browserName,
    context,
    page,
  }) {
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    }

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

    const snapshotsDir = path.join(projectRoot, 'agent-snapshots');
    await expect
      .poll(async function readSnapshotPath() {
        const files = await readdir(snapshotsDir).catch(function handleMissingDir() {
          return [];
        });
        const markdownFile = files.find(function findMarkdownFile(file) {
          return file.endsWith('.md');
        });
        return markdownFile ? path.join(snapshotsDir, markdownFile) : '';
      })
      .not.toBe('');

    const snapshotFile = (await readdir(snapshotsDir)).find(function findMarkdownFile(file) {
      return file.endsWith('.md');
    });
    expect(snapshotFile).toBe('agent-snap-annotation-1-screenshot.md');
    const snapshotPath = path.join(snapshotsDir, snapshotFile as string);
    const snapshot = await readFile(snapshotPath, 'utf8');
    expect(snapshot).toContain('Persist this snap locally');
    expect(snapshot).toContain('Plugin fixture');
    expect(snapshot).toContain('button');
    expect(snapshot).toContain('**Coords:**');
    expect(snapshot).toContain('agent-snap-annotation-1-screenshot');
    expect(snapshot).toContain('Images are saved on disk');
    expect(snapshot).toContain('"imageOutputMode": "file"');
    expect(snapshot).toContain('"assetDirectory": "./agent-snapshots"');
    expect(snapshot).not.toContain('"data":');
    expect(snapshot).not.toContain('"actions":');
    expect(snapshot).not.toContain('"outputPath":');

    const manifestMatch = snapshot.match(/```agent-snap-assets\s*([\s\S]*?)\s*```/);
    expect(manifestMatch).toBeTruthy();
    const manifest = JSON.parse(manifestMatch?.[1] || '{}') as {
      assets?: Array<{ path?: string }>;
    };
    const screenshotPathFromManifest = manifest.assets?.[0]?.path;
    expect(screenshotPathFromManifest).toMatch(
      /^\.\/agent-snapshots\/agent-snap-annotation-1-screenshot\.jpg$/,
    );
    const screenshotPath = path.join(projectRoot, screenshotPathFromManifest || '');
    const screenshot = await readFile(screenshotPath);
    expect(screenshot.byteLength).toBeGreaterThan(100);
    expect(screenshot[0]).toBe(0xff);
    expect(screenshot[1]).toBe(0xd8);

    if (browserName === 'chromium') {
      const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardContent).toBe(snapshot);
      expect(clipboardContent).toContain('Images are saved on disk');
      expect(clipboardContent).not.toContain('"data":');
    }
  });
});
