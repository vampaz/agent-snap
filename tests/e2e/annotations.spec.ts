import { test, expect } from '@playwright/test';

test.describe('Agent Snap Annotation Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear local storage to start fresh
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should be able to add an annotation', async ({ page }) => {
    // Open toolbar
    await page.getByTestId('as-toggle').click();

    // Click on the H1 element to annotate it
    await page.locator('h1').click({ force: true });

    // Expect popup to appear
    const popup = page.getByTestId('popup-root');
    await expect(popup).toBeVisible();

    // Type comment
    const textarea = page.getByTestId('popup-textarea');
    await textarea.fill('This is a test annotation');

    // Submit
    await page.getByTestId('popup-submit').click();

    // Expect marker to appear
    const marker = page.getByTestId('annotation-marker-1');
    await expect(marker).toBeVisible();

    // Check badge count
    const badge = page.locator('.as-badge');
    await expect(badge).toHaveText('1');
  });

  test('should be able to delete an annotation', async ({ page }) => {
    // Add annotation first
    await page.getByTestId('as-toggle').click();
    await page.locator('h1').click({ force: true });
    await page.getByTestId('popup-textarea').fill('Test');
    await page.getByTestId('popup-submit').click();

    const marker = page.getByTestId('annotation-marker-1');
    await expect(marker).toBeVisible();

    // Wait for entrance animation and "recently added" state to clear
    await page.waitForTimeout(1000);

    // Hover to reveal actions
    await marker.hover();

    // Use evaluate to click the delete button to avoid "element detached" issues
    // caused by aggressive re-rendering in the application
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="marker-action-delete"]') as HTMLElement;
      if (btn) btn.click();
    });

    // Expect marker to disappear
    await expect(marker).not.toBeVisible();

    // Badge should be gone or 0
    const badge = page.locator('.as-badge');
    await expect(badge).not.toBeVisible();
  });

  test('should be able to clear all annotations', async ({ page }) => {
    // Add two annotations
    await page.getByTestId('as-toggle').click();

    // Annotation 1
    await page.locator('h1').click({ force: true });
    await page.getByTestId('popup-textarea').fill('Test 1');
    await page.getByTestId('popup-submit').click();
    await expect(page.getByTestId('annotation-marker-1')).toBeVisible();

    // Annotation 2
    await page.waitForTimeout(500);

    await page.locator('p').first().click({ force: true });
    const popup = page.getByTestId('popup-root');
    await expect(popup).toBeVisible();

    await page.getByTestId('popup-textarea').fill('Test 2');
    await page.getByTestId('popup-submit').click({ force: true });

    await expect(page.getByTestId('annotation-marker-1')).toBeVisible();
    await expect(page.getByTestId('annotation-marker-2')).toBeVisible();

    // Click clear button in toolbar
    const clearBtn = page.getByTestId('toolbar-clear-button');
    await clearBtn.click();

    // Wait for animations and clearing
    await expect(page.getByTestId('annotation-marker-1')).not.toBeVisible();
    await expect(page.getByTestId('annotation-marker-2')).not.toBeVisible();

    const badge = page.locator('.as-badge');
    await expect(badge).not.toBeVisible();
  });
});
