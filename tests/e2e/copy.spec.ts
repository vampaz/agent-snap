import { test, expect } from '@playwright/test';

test.describe('Agent Snap Copy Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should copy output to clipboard and show feedback', async ({ context, page }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

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

    // Verify clipboard content
    // Note: This might be flaky in some headless environments (like WebKit on Linux),
    // but works generally well on local.
    const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());

    expect(clipboardContent).toContain('Site Report');
    expect(clipboardContent).toContain('Copy test annotation');
    expect(clipboardContent).toContain('h1'); // The element tag

    // Verify feedback disappears after 2 seconds (optional, but good for completeness)
    // We wait 2.1s
    await page.waitForTimeout(2100);
    await expect(copyBtn).toHaveAttribute('data-active', 'false');
  });

  test('should verify auto-clear after copy setting', async ({ context, page }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

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

    // Wait for auto-clear (timeout is 500ms in code + animation)
    await page.waitForTimeout(1000);

    // Verify markers are gone
    await expect(page.getByTestId('annotation-marker-1')).not.toBeVisible();
    await expect(page.locator('.as-badge')).not.toBeVisible();
  });
});
