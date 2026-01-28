import { test, expect } from '@playwright/test';

test.describe('Agent Snap Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Open toolbar and settings
    await page.getByTestId('as-toggle').click();
    await page.getByTestId('toolbar-settings-button').click();
  });

  test('should cycle output detail', async ({ page }) => {
    const cycleBtn = page.getByTestId('settings-output-cycle');
    const cycleText = page.locator('.as-cycle-button-text');

    // Default is standard ("Normal")
    await expect(cycleText).toContainText('Normal');

    // Click -> Detailed ("Full")
    await cycleBtn.click();
    await expect(cycleText).toContainText('Full');

    // Click -> Forensic ("Debug")
    await cycleBtn.click();
    await expect(cycleText).toContainText('Debug');

    // Click -> Standard ("Normal")
    await cycleBtn.click();
    await expect(cycleText).toContainText('Normal');
  });

  test('should toggle options', async ({ page }) => {
    // Block interactions
    const blockCheckbox = page.getByTestId('settings-block-interactions');
    const blockLabel = page.locator('label[for="as-block-interactions"]');

    // Default should be unchecked
    await expect(blockCheckbox).not.toBeChecked();

    // Click to check
    await blockLabel.click();
    await expect(blockCheckbox).toBeChecked();

    // Capture screenshots
    const screenshotCheckbox = page.getByTestId('settings-capture-screenshots');
    const screenshotLabel = page.locator('label[for="as-capture-screenshots"]');

    // Default should be checked
    await expect(screenshotCheckbox).toBeChecked();

    // Click to uncheck
    await screenshotLabel.click();
    await expect(screenshotCheckbox).not.toBeChecked();
  });

  test('should select color', async ({ page }) => {
    // Select first color option (Purple #AF52DE)
    const colorOption0 = page.getByTestId('settings-color-option-0');

    await colorOption0.click();

    // Close settings
    await page.getByTestId('toolbar-settings-button').click();

    // Add marker
    await page.locator('h1').click({ force: true });
    await page.getByTestId('popup-textarea').fill('Test Color');
    await page.getByTestId('popup-submit').click();

    const marker = page.getByTestId('annotation-marker-1');
    await expect(marker).toHaveCSS('background-color', 'rgb(175, 82, 222)'); // #AF52DE
  });
});
