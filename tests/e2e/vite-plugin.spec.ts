import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
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
      '    <header class="fixture-header">',
      '      <div data-testid="decorative-background" class="fixture-background"></div>',
      '      <h1 class="fixture-title">Plugin fixture</h1>',
      '      <div class="fixture-chip" aria-label="visible chip"></div>',
      '    </header>',
      '    <main>',
      '      <h1>Plugin fixture</h1>',
      '      <button data-testid="target-button">Save changes</button>',
      '    </main>',
      '    <section class="demo-section" data-testid="demo-section">',
      '      <div class="demo-card terminal-card">',
      '        <div class="card-chrome">',
      '          <span class="card-dot"></span>',
      '          <span class="card-dot"></span>',
      '          <span class="card-dot"></span>',
      '        </div>',
      '        <div class="terminal-body">',
      '          <p><span class="terminal-prompt">&gt;</span> <span class="terminal-command">snap</span> Annotate the hero section</p>',
      '          <p><span class="terminal-status"></span> Selecting <strong>header.hero</strong></p>',
      '          <p class="terminal-done">Done!</p>',
      '        </div>',
      '      </div>',
      '      <div class="demo-card preview-card">',
      '        <div class="card-chrome">',
      '          <span class="card-title">output.md</span>',
      '          <span class="card-tab">Standard</span>',
      '        </div>',
      '        <div class="code-preview">',
      '          <p class="code-comment"># Annotation Report</p>',
      '          <p><span class="code-heading">## Element: header.hero</span></p>',
      '          <p><span class="code-key">selector:</span> <span class="code-str">"header.hero"</span></p>',
      '          <p><span class="code-key">message:</span> <span class="code-str">"Review hero layout"</span></p>',
      '          <span class="preview-proof"></span>',
      '        </div>',
      '      </div>',
      '    </section>',
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
      '  font-family: Arial, sans-serif;',
      '}',
      '.fixture-header {',
      '  position: relative;',
      '  min-height: 180px;',
      '  overflow: hidden;',
      '}',
      '.fixture-background {',
      '  position: absolute;',
      '  inset: 0;',
      '  background: linear-gradient(180deg, rgb(239, 246, 255), rgb(255, 255, 255));',
      '}',
      '.fixture-title {',
      '  position: absolute;',
      '  left: 48px;',
      '  top: 24px;',
      '  margin: 0;',
      '  color: rgb(15, 23, 42);',
      '}',
      '.fixture-chip {',
      '  position: absolute;',
      '  left: 96px;',
      '  top: 92px;',
      '  width: 80px;',
      '  height: 48px;',
      '  background: rgb(0, 180, 0);',
      '}',
      'main {',
      '  display: grid;',
      '  gap: 16px;',
      '  padding: 48px;',
      '}',
      '[data-testid="target-button"] {',
      '  min-height: 44px;',
      '  border: 0;',
      '  border-radius: 6px;',
      '  background: rgb(20, 100, 220);',
      '  color: rgb(255, 255, 255);',
      '}',
      '.demo-section {',
      '  display: grid;',
      '  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);',
      '  gap: 16px;',
      '  width: 952px;',
      '  margin: 0 auto 48px;',
      '}',
      '.demo-card {',
      '  min-height: 320px;',
      '  background: rgb(26, 26, 26);',
      '  border: 1px solid rgb(40, 40, 40);',
      '  border-radius: 12px;',
      '  overflow: hidden;',
      '}',
      '.card-chrome {',
      '  height: 52px;',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  padding: 0 16px;',
      '  border-bottom: 1px solid rgb(40, 40, 40);',
      '}',
      '.card-dot {',
      '  width: 10px;',
      '  height: 10px;',
      '  border-radius: 999px;',
      '  background: rgb(80, 80, 80);',
      '}',
      '.terminal-body, .code-preview {',
      '  position: relative;',
      '  padding: 20px 16px;',
      '  font-family: monospace;',
      '  color: rgb(136, 136, 136);',
      '}',
      '.terminal-prompt, .code-key {',
      '  color: rgb(88, 166, 255);',
      '}',
      '.terminal-command, .card-tab {',
      '  color: rgb(236, 107, 45);',
      '}',
      '.terminal-status {',
      '  display: inline-block;',
      '  width: 8px;',
      '  height: 8px;',
      '  border-radius: 999px;',
      '  background: rgb(136, 136, 136);',
      '}',
      '.terminal-done, .code-str {',
      '  color: rgb(63, 185, 80);',
      '}',
      '.card-title {',
      '  color: rgb(136, 136, 136);',
      '}',
      '.card-tab {',
      '  margin-left: auto;',
      '  padding: 6px 12px;',
      '  border-radius: 4px;',
      '  background: rgba(236, 107, 45, 0.15);',
      '}',
      '.code-comment {',
      '  color: rgb(85, 85, 85);',
      '}',
      '.code-heading {',
      '  color: rgb(232, 232, 232);',
      '}',
      '.preview-proof {',
      '  position: absolute;',
      '  right: 24px;',
      '  bottom: 24px;',
      '  width: 72px;',
      '  height: 44px;',
      '  background: rgb(0, 180, 0);',
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

async function decodeImageSample(
  page: Page,
  filePath: string,
  sample: {
    x: number;
    y: number;
    cssWidth: number;
    cssHeight: number;
  },
): Promise<{
  width: number;
  height: number;
  pixel: number[];
}> {
  const image = await readFile(filePath);
  const mime = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const src = `data:${mime};base64,${image.toString('base64')}`;
  return page.evaluate(
    async function decode(payload) {
      const imageElement = new Image();
      const loaded = new Promise<void>(function waitForImage(resolve, reject) {
        imageElement.onload = function handleLoad() {
          resolve();
        };
        imageElement.onerror = function handleError() {
          reject(new Error('Unable to load screenshot data URL'));
        };
      });
      imageElement.src = payload.src;
      await loaded;

      const canvas = document.createElement('canvas');
      canvas.width = imageElement.naturalWidth;
      canvas.height = imageElement.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas context unavailable');
      }

      context.drawImage(imageElement, 0, 0);
      const x = Math.round(
        (payload.sample.x / payload.sample.cssWidth) * imageElement.naturalWidth,
      );
      const y = Math.round(
        (payload.sample.y / payload.sample.cssHeight) * imageElement.naturalHeight,
      );
      return {
        width: imageElement.naturalWidth,
        height: imageElement.naturalHeight,
        pixel: Array.from(context.getImageData(x, y, 1, 1).data),
      };
    },
    {
      src: src,
      sample: sample,
    },
  );
}

function expectPixelSimilar(actual: number[], expected: number[]): void {
  expect(actual[0]).toBeGreaterThanOrEqual(expected[0] - 35);
  expect(actual[0]).toBeLessThanOrEqual(expected[0] + 35);
  expect(actual[1]).toBeGreaterThanOrEqual(expected[1] - 35);
  expect(actual[1]).toBeLessThanOrEqual(expected[1] + 35);
  expect(actual[2]).toBeGreaterThanOrEqual(expected[2] - 35);
  expect(actual[2]).toBeLessThanOrEqual(expected[2] + 35);
  expect(actual[3]).toBe(255);
}

async function expectSavedScreenshotMatchesBrowserArea(
  page: Page,
  options: {
    name: string;
    selector: string;
    clickPosition: { x: number; y: number };
    samplePoints: Array<{ x: number; y: number }>;
  },
): Promise<void> {
  const snapshotsDir = path.join(projectRoot, 'agent-snapshots');
  await rm(snapshotsDir, { recursive: true, force: true });
  await page.goto(appUrl);
  await page.evaluate(function clearStorage() {
    localStorage.clear();
  });
  await page.reload();

  const target = page.locator(options.selector);
  await expect(target).toBeVisible();
  const bounds = await target.boundingBox();
  if (!bounds) {
    throw new Error(`Could not measure ${options.selector}.`);
  }

  const referencePath = path.join(projectRoot, `${options.name}-native.png`);
  await target.screenshot({ path: referencePath });

  await expect(page.getByTestId('toolbar')).toBeVisible();
  await page.getByTestId('as-toggle').click({ force: true });
  await expect(page.getByTestId('toolbar-container')).toHaveClass(/as-expanded/);

  await target.click({
    force: true,
    position: options.clickPosition,
  });
  await page.getByTestId('popup-textarea').fill(`${options.name} screenshot`);
  await page.getByTestId('popup-submit').click();

  const copyButton = page.getByTestId('toolbar-copy-button');
  await expect(copyButton).toBeEnabled();
  await copyButton.click();

  await expect
    .poll(async function readScreenshotPath() {
      const files = await readdir(snapshotsDir).catch(function handleMissingDir() {
        return [];
      });
      return files.find(function findScreenshot(file) {
        return file.endsWith('.jpg');
      });
    })
    .toBe('agent-snap-annotation-1-screenshot.jpg');

  const screenshotPath = path.join(snapshotsDir, 'agent-snap-annotation-1-screenshot.jpg');
  for (const point of options.samplePoints) {
    const reference = await decodeImageSample(page, referencePath, {
      ...point,
      cssWidth: bounds.width,
      cssHeight: bounds.height,
    });
    const actual = await decodeImageSample(page, screenshotPath, {
      ...point,
      cssWidth: bounds.width,
      cssHeight: bounds.height,
    });

    expect(Math.abs(actual.width - reference.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(actual.height - reference.height)).toBeLessThanOrEqual(2);
    expectPixelSimilar(actual.pixel, reference.pixel);
  }
}

test.describe('Agent Snap Vite plugin', function () {
  test.describe.configure({ mode: 'serial' });

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

  test.beforeEach(async function () {
    await rm(path.join(projectRoot, 'agent-snapshots'), { recursive: true, force: true });
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

  test('saves selected DOM areas like the browser-rendered areas', async function ({ page }) {
    const cases = [
      {
        name: 'decorative-background',
        selector: '[data-testid="decorative-background"]',
        clickPosition: { x: 10, y: 20 },
        samplePoints: [
          { x: 104, y: 104 },
          { x: 120, y: 116 },
          { x: 152, y: 128 },
        ],
      },
      {
        name: 'demo-section',
        selector: '[data-testid="demo-section"]',
        clickPosition: { x: 430, y: 20 },
        samplePoints: [
          { x: 25, y: 18 },
          { x: 25, y: 82 },
          { x: 470, y: 18 },
          { x: 920, y: 276 },
        ],
      },
      {
        name: 'target-button',
        selector: '[data-testid="target-button"]',
        clickPosition: { x: 12, y: 12 },
        samplePoints: [
          { x: 8, y: 8 },
          { x: 60, y: 22 },
          { x: 180, y: 36 },
        ],
      },
    ];

    for (const item of cases) {
      await expectSavedScreenshotMatchesBrowserArea(page, item);
    }
  });
});
