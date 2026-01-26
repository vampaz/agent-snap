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
});
