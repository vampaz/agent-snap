import { test, expect } from '@playwright/test';

test.describe('Agent Snap Copy Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should copy output to clipboard and show feedback', async ({
    context,
    page,
    browserName,
  }) => {
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    }

    // Add an annotation
    await page.getByTestId('as-toggle').click();
    await page.locator('h1').click({ force: true });
    await page.getByTestId('popup-textarea').fill('Copy test annotation');
    await page.getByTestId('popup-submit').click();

    // Click Copy button
    const copyBtn = page.getByTestId('toolbar-copy-button');
    await expect(copyBtn).toBeEnabled();
    await copyBtn.click();

    // Verify UI feedback (button becomes active/green)
    await expect(copyBtn).toHaveAttribute('data-active', 'true');

    if (browserName === 'chromium') {
      const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());

      expect(clipboardContent).toContain('Site Report');
      expect(clipboardContent).toContain('Copy test annotation');
      expect(clipboardContent).toContain('h1');
    }

    await expect(copyBtn).toHaveAttribute('data-active', 'false');
  });

  test('should verify auto-clear after copy setting', async ({ context, page, browserName }) => {
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    }

    // Enable auto-clear setting
    await page.getByTestId('as-toggle').click();
    await page.getByTestId('toolbar-settings-button').click();
    await page.locator('label[for="as-auto-clear"]').click();
    await page.locator('label[for="as-upload-screenshots"]').click();
    await page.getByTestId('toolbar-settings-button').click(); // Close settings

    // Add annotation
    await page.locator('h1').click({ force: true });
    await page.getByTestId('popup-textarea').fill('Will be cleared');
    await page.getByTestId('popup-submit').click();

    await expect(page.getByTestId('annotation-marker-1')).toBeVisible();

    // Copy
    await page.getByTestId('toolbar-copy-button').click();

    // Verify markers are gone
    await expect(page.getByTestId('annotation-marker-1')).not.toBeVisible();
    await expect(page.locator('.as-badge')).not.toBeVisible();
  });

  test('should copy from popup and create annotation', async ({ context, page, browserName }) => {
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    }

    await page.getByTestId('as-toggle').click();
    await page.locator('h1').click({ force: true });

    const popup = page.getByTestId('popup-root');
    await expect(popup).toBeVisible();

    await page.getByTestId('popup-textarea').fill('Copy from popup');

    const copyButton = page.getByTestId('popup-copy');
    await expect(copyButton).toBeEnabled();
    await copyButton.click();

    await expect(page.getByTestId('annotation-marker-1')).toBeVisible();
    await expect(page.locator('.as-badge')).toHaveText('1');

    if (browserName === 'chromium') {
      await expect
        .poll(async () => page.evaluate(() => navigator.clipboard.readText().catch(() => '')), {
          timeout: 10000,
        })
        .toContain('Copy from popup');
      const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());

      expect(clipboardContent).toContain('Site Report');
      expect(clipboardContent).toContain('Copy from popup');
      expect(clipboardContent).toContain('h1');
    }
  });

  test('should show inline upload error when upload fails', async ({ page }) => {
    await page.route('https://agent-snap.conekto.eu/api/public/upload', async (route) => {
      await route.fulfill({ status: 500, body: 'upload failed' });
    });

    await page.getByTestId('as-toggle').click();
    await page.locator('h1').click({ force: true });

    const popup = page.getByTestId('popup-root');
    await expect(popup).toBeVisible();

    await page.getByTestId('popup-textarea').fill('Copy fails upload');
    await page.getByTestId('popup-copy').click();

    const error = page.locator('.as-popup-copy-error');
    await expect(error).toBeVisible();
    await expect(popup).toBeVisible();
  });
});
