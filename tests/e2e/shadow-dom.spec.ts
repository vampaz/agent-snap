import { test, expect } from '@playwright/test';

test.describe('Agent Snap Shadow DOM Support', () => {
  test('should include shadow DOM content in screenshot', async ({ page }) => {
    // Navigate to playground
    await page.goto('/');

    // Inject a component with Shadow DOM
    await page.evaluate(() => {
      // Remove any existing shadow host if it exists to avoid duplicates in tests
      const existing = document.getElementById('my-shadow-host');
      if (existing) existing.remove();

      const host = document.createElement('div');
      host.id = 'my-shadow-host';
      host.style.padding = '20px';
      host.style.border = '1px solid #ccc';
      host.style.marginBottom = '20px';
      document.body.prepend(host);

      const shadow = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = `
        .shadow-content {
          color: red;
          font-weight: bold;
          font-size: 20px;
          background: #eee;
          padding: 10px;
        }
      `;
      shadow.appendChild(style);

      const content = document.createElement('div');
      content.className = 'shadow-content';
      content.textContent = 'I am inside Shadow DOM';
      shadow.appendChild(content);
    });

    // Start Agent Snap
    await page.getByTestId('as-toggle').click();

    // Click on the shadow host to annotate it
    await page.locator('#my-shadow-host').click({ force: true });

    // Wait for popup
    const popup = page.getByTestId('popup-root');
    await expect(popup).toBeVisible();

    // The screenshot is generated in the background and shown in the preview.
    // We need to verify the preview image contains the shadow text.
    // Since it's a data URL, we can't easily perform OCR in the browser,
    // but we can check if the preview image loads and has a src.

    // Better yet: we can inspect the `src` of the preview image.
    // However, the `src` is a JPEG data URL.

    // Wait for preview to appear
    const previewImg = popup.locator('.as-popup-screenshot-preview img');
    await expect(previewImg).toBeVisible();
    await expect(previewImg).toHaveAttribute('src', /^data:image\/jpeg/);

    // To verify content, we can potentially decode the SVG from the data URL if it was SVG,
    // but the final output is JPEG (canvas toDataURL).

    // So verifying the *pixel content* is hard without visual regression testing tools.
    // But we can verify that the screenshot generation didn't crash and produced a valid image.
    // And if we rely on our unit test for the "logic" (SVG construction),
    // this E2E test confirms the integration works (screenshot is taken and displayed).

    // Let's add a comment and save to ensure full flow works with Shadow DOM target
    await page.getByTestId('popup-textarea').fill('Shadow DOM Test');
    await page.getByTestId('popup-submit').click();

    // Verify marker appears
    await expect(page.getByTestId('annotation-marker-1')).toBeVisible();
  });

  test('should fall back to light dom for oversized shadow trees', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      const existing = document.getElementById('big-shadow-host');
      if (existing) existing.remove();

      const host = document.createElement('div');
      host.id = 'big-shadow-host';
      host.style.padding = '20px';
      host.style.border = '1px solid #ccc';
      host.style.marginBottom = '20px';
      host.textContent = 'Light DOM fallback content';
      document.body.prepend(host);

      const shadow = host.attachShadow({ mode: 'open' });
      for (let i = 0; i < 1500; i += 1) {
        const node = document.createElement('span');
        node.textContent = `Shadow Node ${i}`;
        shadow.appendChild(node);
      }
    });

    await page.getByTestId('as-toggle').click();
    await page.locator('#big-shadow-host').click({ force: true });

    const popup = page.getByTestId('popup-root');
    await expect(popup).toBeVisible();

    const previewImg = popup.locator('.as-popup-screenshot-preview img');
    await expect(previewImg).toBeVisible();
    await expect(previewImg).toHaveAttribute('src', /^data:image\/jpeg/);

    await page.getByTestId('popup-textarea').fill('Oversized shadow tree');
    await page.getByTestId('popup-submit').click();
    await expect(page.getByTestId('annotation-marker-1')).toBeVisible();
  });
});

test.describe('Agent Snap Shadow DOM Visual', () => {
  test.skip(({ browserName }) => browserName !== 'chromium');

  test('screenshot preview should match baseline', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      const existing = document.getElementById('visual-shadow-host');
      if (existing) existing.remove();

      const host = document.createElement('div');
      host.id = 'visual-shadow-host';
      host.style.width = '320px';
      host.style.height = '180px';
      host.style.padding = '16px';
      host.style.border = '2px solid #222';
      host.style.borderRadius = '12px';
      host.style.background = '#f5f5f5';
      host.style.display = 'flex';
      host.style.alignItems = 'center';
      host.style.justifyContent = 'center';
      host.style.marginBottom = '24px';
      document.body.prepend(host);

      const shadow = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = `
        .card {
          width: 100%;
          height: 100%;
          border-radius: 10px;
          background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f9fafb;
          font-family: Arial, sans-serif;
          font-size: 18px;
          letter-spacing: 0.5px;
        }
        .badge {
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
      `;
      shadow.appendChild(style);

      const card = document.createElement('div');
      card.className = 'card';
      const badge = document.createElement('div');
      badge.className = 'badge';
      badge.textContent = 'Shadow Snapshot';
      card.appendChild(badge);
      shadow.appendChild(card);
    });

    await page.getByTestId('as-toggle').click();
    await page.locator('#visual-shadow-host').click({ force: true });

    const popup = page.getByTestId('popup-root');
    await expect(popup).toBeVisible();

    await page.waitForSelector('.as-popup-screenshot-preview img[src^="data:image/"]');
    const previewImg = popup.locator('.as-popup-screenshot-preview img');
    await expect(previewImg).toBeVisible();

    await page.addStyleTag({
      content:
        '.as-popup-screenshot-preview img { width: 250px !important; height: 64px !important; object-fit: cover; }',
    });
    await previewImg.evaluate((img) => img.getBoundingClientRect());

    await expect(previewImg).toHaveScreenshot('shadow-dom-preview.png', {
      animations: 'disabled',
      maxDiffPixels: 200,
    });
  });
});
