import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Configuration
const PORT = 5174;
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = path.join(process.cwd(), 'extension/assets/store');

async function startServer() {
  console.log('Starting Vite server...');
  const server = spawn('npx', ['vite', '--port', PORT.toString()], {
    cwd: path.join(process.cwd(), 'playground'),
    stdio: 'ignore',
    shell: true,
  });

  // Give it a moment to spin up
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return server;
}

async function captureScreenshots() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1, // Must be 1 to ensure output is exactly 1280x800 for Web Store
  });
  const page = await context.newPage();

  console.log(`Navigating to ${BASE_URL}...`);
  try {
    await page.goto(BASE_URL);
  } catch (e) {
    console.error(`Failed to load ${BASE_URL}. Is the server running?`);
    throw e;
  }

  await page.waitForLoadState('networkidle');

  // Activate the annotator to show the toolbar
  console.log('Activating annotator...');
  const toggleButton = page.locator('[data-testid="as-toggle"]');
  await toggleButton.waitFor({ state: 'visible' });
  await toggleButton.click();

  // Wait for toolbar expansion animation
  await page.waitForTimeout(1000);

  // --- INTERACTION: Add Annotations ---
  console.log('Adding annotations...');

  // 1. Click on the "Request review" button to annotate it
  // We use force: true to ensure we click even if the element is being intercepted or overlayed
  await page.locator('[data-testid="hero-request-review"]').click({ force: true });
  await page.waitForTimeout(1000); // Wait for potential animations

  // 2. Click on the "Hero Title" to annotate it
  await page.locator('[data-testid="hero-title"]').click({ force: true });
  await page.waitForTimeout(1000);

  // 3. Click on the "Launch checklist" title
  await page.locator('[data-testid="checklist-title"]').click({ force: true });

  // Wait for markers to appear
  await page.locator('.as-marker').first().waitFor({ state: 'visible' });

  // 4. Hover over the first marker to show tooltip (simulating user interaction)
  // This makes the screenshot look "alive"
  const firstMarker = page.locator('[data-testid="annotation-marker-1"]');
  if (await firstMarker.isVisible()) {
    console.log('Hovering over marker 1...');
    await firstMarker.hover();
    await page.waitForTimeout(2000); // Wait for tooltip and any other animations to fully settle
  }

  // --- 1. Main Screenshot (1280x800) ---
  console.log('Capturing Screenshot (1280x800)...');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'screenshot-1280x800.png') });

  // --- 2. Small Tile (440x280) ---
  console.log('Capturing Small Tile (440x280)...');
  await page.setViewportSize({ width: 440, height: 280 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'small-tile-440x280.png') });

  // --- 3. Marquee Tile (1400x560) ---
  console.log('Capturing Marquee Tile (1400x560)...');
  await page.setViewportSize({ width: 1400, height: 560 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'marquee-tile-1400x560.png') });

  await browser.close();
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let server;
  try {
    server = await startServer();
    await captureScreenshots();
    console.log('Assets generated successfully!');
  } catch (error) {
    console.error('Error generating assets:', error);
    process.exit(1);
  } finally {
    if (server) {
      console.log('Stopping server...');
      server.kill();
    }
    process.exit(0);
  }
}

main();
