import { expect, test, chromium, type Page } from '@playwright/test';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

declare const chrome: {
  scripting: {
    executeScript: (options: { target: { tabId: number }; files: string[] }) => Promise<unknown>;
  };
  tabs: {
    query: (queryInfo: Record<string, never>) => Promise<Array<{ id?: number; url?: string }>>;
    sendMessage: (tabId: number, message: { type: string }) => Promise<unknown>;
  };
};

async function createExtensionFixture(rootDir: string): Promise<string> {
  const sourcePath = path.resolve('extension');
  const extensionPath = path.join(rootDir, 'extension');
  await cp(sourcePath, extensionPath, { recursive: true });

  const manifestPath = path.join(extensionPath, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    host_permissions?: string[];
  };
  manifest.host_permissions = ['<all_urls>'];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return extensionPath;
}

async function decodeImage(
  page: Page,
  src: string,
): Promise<{
  width: number;
  height: number;
  left: number[];
  right: number[];
  center: number[];
}> {
  return page.evaluate(async function decode(srcValue) {
    const image = new Image();
    const loaded = new Promise<void>(function waitForImage(resolve, reject) {
      image.onload = function handleLoad() {
        resolve();
      };
      image.onerror = function handleError() {
        reject(new Error('Unable to load screenshot data URL'));
      };
    });
    image.src = srcValue;
    await loaded;

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context unavailable');
    }

    context.drawImage(image, 0, 0);
    function sample(x: number, y: number): number[] {
      return Array.from(context.getImageData(x, y, 1, 1).data);
    }

    const centerY = Math.floor(image.naturalHeight / 2);
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      left: sample(10, centerY),
      right: sample(image.naturalWidth - 10, centerY),
      center: sample(Math.floor(image.naturalWidth / 2), centerY),
    };
  }, src);
}

function expectColor(
  pixel: number[],
  expected: { red: number; green: number; blue: number },
): void {
  expect(pixel[0]).toBeGreaterThanOrEqual(expected.red - 3);
  expect(pixel[0]).toBeLessThanOrEqual(expected.red + 3);
  expect(pixel[1]).toBeGreaterThanOrEqual(expected.green - 3);
  expect(pixel[1]).toBeLessThanOrEqual(expected.green + 3);
  expect(pixel[2]).toBeGreaterThanOrEqual(expected.blue - 3);
  expect(pixel[2]).toBeLessThanOrEqual(expected.blue + 3);
  expect(pixel[3]).toBe(255);
}

test.describe('Agent Snap extension screenshots', function () {
  test('captures the selected area from native tab pixels', async function ({
    browserName,
  }, testInfo) {
    test.skip(browserName !== 'chromium', 'Chrome extension APIs are Chromium-only in e2e.');

    const tempRoot = await mkdtemp(path.join(tmpdir(), 'agent-snap-extension-'));
    const extensionPath = await createExtensionFixture(tempRoot);
    const userDataDir = path.join(tempRoot, 'profile');
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      viewport: { width: 900, height: 700 },
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });

    try {
      const serviceWorker =
        context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
      const page = context.pages()[0] || (await context.newPage());
      const baseUrl = String(testInfo.project.use.baseURL || 'http://localhost:5174');
      await page.goto(`${baseUrl}/privacy.html`);

      await page.evaluate(function setupFixture() {
        document.body.innerHTML = '';
        document.body.style.margin = '0';
        document.body.style.background = 'rgb(255, 255, 255)';

        const target = document.createElement('div');
        target.id = 'native-capture-target';
        target.style.position = 'fixed';
        target.style.left = '120px';
        target.style.top = '96px';
        target.style.width = '180px';
        target.style.height = '120px';
        target.style.background =
          'linear-gradient(90deg, rgb(255, 0, 0) 0 50%, rgb(0, 255, 0) 50% 100%)';
        target.style.boxShadow = 'none';
        document.body.appendChild(target);
      });

      await serviceWorker.evaluate(async function injectAgentSnap() {
        const tabs = await chrome.tabs.query({});
        const tab =
          tabs.find(function findActive(item) {
            return item.url?.startsWith('http://localhost:5174/privacy.html');
          }) ||
          tabs.find(function findLocalhost(item) {
            return item.url?.startsWith('http://localhost:5174/');
          }) ||
          tabs[0];
        if (!tab?.id) {
          throw new Error('Unable to find test tab');
        }

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['config.js', 'content-script.js'],
        });
        await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_AGENT_SNAP' });
      });

      await page.getByTestId('as-toggle').click({ force: true });
      await page
        .locator('#native-capture-target')
        .click({ force: true, position: { x: 90, y: 60 } });
      await page.waitForSelector('.as-popup-screenshot-preview img[src^="data:image/png"]');

      const src = await page.locator('.as-popup-screenshot-preview img').getAttribute('src');
      expect(src).toMatch(/^data:image\/png/);
      const decoded = await decodeImage(page, src as string);

      expect(decoded.width).toBe(180);
      expect(decoded.height).toBe(120);
      expectColor(decoded.left, { red: 255, green: 0, blue: 0 });
      expectColor(decoded.right, { red: 0, green: 255, blue: 0 });
      expectColor(decoded.center, { red: 0, green: 255, blue: 0 });
    } finally {
      await context.close();
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
