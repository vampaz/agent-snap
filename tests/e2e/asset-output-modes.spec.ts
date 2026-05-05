import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
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
      '    <title>Agent Snap Asset Modes Fixture</title>',
      '  </head>',
      '  <body>',
      '    <main>',
      '      <h1>Asset mode fixture</h1>',
      '      <button data-testid="target-button">Annotate me</button>',
      '    </main>',
      '    <script type="module" src="/src/main.ts"></script>',
      '  </body>',
      '</html>',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    path.join(root, 'src', 'main.ts'),
    [
      "import { createAgentSnap } from 'agent-snap';",
      '',
      'const params = new URLSearchParams(window.location.search);',
      "const uploadScreenshots = params.get('upload') === 'true';",
      "const captureScreenshots = params.get('capture') !== 'false';",
      '',
      'createAgentSnap({',
      '  settings: {',
      "    outputDetail: 'standard',",
      '    uploadScreenshots: uploadScreenshots,',
      '    captureScreenshots: captureScreenshots,',
      '  },',
      '});',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    path.join(root, 'vite.config.ts'),
    [
      'export default {',
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

async function copyAnnotation(page: Page, query: string, comment: string): Promise<string> {
  await page.goto(`${appUrl}/${query}`);
  await expect(page.getByTestId('toolbar')).toBeVisible();
  await page.getByTestId('as-toggle').click({ force: true });
  await expect(page.getByTestId('toolbar-container')).toHaveClass(/as-expanded/);

  await page.getByTestId('target-button').click({ force: true });
  await page.getByTestId('popup-textarea').fill(comment);
  await page.getByTestId('popup-submit').click();

  const copyButton = page.getByTestId('toolbar-copy-button');
  await expect(copyButton).toBeEnabled();
  await copyButton.click();

  await expect
    .poll(async function readClipboard() {
      return page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    })
    .toContain(comment);

  return page.evaluate(() => navigator.clipboard.readText());
}

test.describe('Agent Snap asset output modes', function () {
  test.skip(function skipNonChromium({ browserName }) {
    return browserName !== 'chromium';
  }, 'Clipboard assertions require Chromium permissions.');

  test.beforeAll(async function () {
    const { createServer, loadConfigFromFile, mergeConfig } = await import('vite');
    appRoot = await mkdtemp(path.join(os.tmpdir(), 'agent-snap-assets-e2e-'));
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

  test.beforeEach(async function ({ context }) {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('instructs agents to decode base64 when uploads are disabled outside plugin mode', async function ({
    page,
  }) {
    const clipboardContent = await copyAnnotation(page, '?upload=false', 'Base64 local screenshot');

    expect(clipboardContent).toContain('"imageOutputMode": "base64"');
    expect(clipboardContent).toContain('"data":');
    expect(clipboardContent).toContain('"strategy": "base64"');
    expect(clipboardContent).toContain('Decode each base64 asset.data');
    expect(clipboardContent).toContain('**Screenshot:** ref: agent-snap-annotation-1-screenshot');
    expect(clipboardContent).not.toContain('Download each asset URL');
    expect(clipboardContent).not.toContain('Images are saved on disk');
  });

  test('instructs agents to download URLs when uploads are enabled outside plugin mode', async function ({
    page,
  }) {
    await page.route(
      'https://agent-snap.conekto.eu/api/public/upload',
      async function upload(route) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            downloadUrl: 'https://cdn.example.test/agent-snap-annotation-1-screenshot.jpg',
            viewerUrl: 'https://cdn.example.test/view/agent-snap-annotation-1-screenshot',
            dailyLimit: null,
          }),
        });
      },
    );

    const clipboardContent = await copyAnnotation(page, '?upload=true', 'Uploaded screenshot');

    expect(clipboardContent).toContain('"imageOutputMode": "url"');
    expect(clipboardContent).toContain(
      '"url": "https://cdn.example.test/agent-snap-annotation-1-screenshot.jpg"',
    );
    expect(clipboardContent).toContain('"strategy": "url"');
    expect(clipboardContent).toContain('Download each asset URL');
    expect(clipboardContent).toContain('**Screenshot:** ref: agent-snap-annotation-1-screenshot');
    expect(clipboardContent).not.toContain('"data":');
    expect(clipboardContent).not.toContain('Decode each base64 asset.data');
    expect(clipboardContent).not.toContain('Images are saved on disk');
  });

  test('omits image instructions when the user does not include screenshots', async function ({
    page,
  }) {
    const clipboardContent = await copyAnnotation(page, '?capture=false', 'No screenshot here');

    expect(clipboardContent).toContain('No screenshot here');
    expect(clipboardContent).not.toContain('```agent-snap-assets');
    expect(clipboardContent).not.toContain('**Agent Tips:**');
    expect(clipboardContent).not.toContain('**Screenshot:**');
    expect(clipboardContent).not.toContain('agent-snap-annotation-1-screenshot');
  });
});
