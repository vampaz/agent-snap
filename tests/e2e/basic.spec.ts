import { test, expect } from '@playwright/test';

test.describe('Agent Snap Basic E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('toolbar should be visible on load', async ({ page }) => {
    const toolbar = page.getByTestId('toolbar');
    await expect(toolbar).toBeVisible();

    // Check if toggle button exists
    const toggleBtn = page.getByTestId('as-toggle');
    await expect(toggleBtn).toBeVisible();
  });

  test('should be able to expand toolbar', async ({ page }) => {
    const toggleBtn = page.getByTestId('as-toggle');
    await toggleBtn.click();

    // Check if controls are visible
    const copyBtn = page.getByTestId('toolbar-copy-button');
    const settingsBtn = page.getByTestId('toolbar-settings-button');

    await expect(copyBtn).toBeVisible();
    await expect(settingsBtn).toBeVisible();
  });

  test('should be able to open settings', async ({ page }) => {
    const toggleBtn = page.getByTestId('as-toggle');
    await toggleBtn.click();

    const settingsBtn = page.getByTestId('toolbar-settings-button');
    await settingsBtn.click();

    const settingsPanel = page.getByTestId('settings-panel');
    await expect(settingsPanel).toBeVisible();
  });
});
