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

    await marker.hover();
    const deleteButton = marker.getByTestId('marker-action-delete');
    await deleteButton.click();

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
    await page.getByTestId('popup-root').waitFor({ state: 'detached' });

    // Annotation 2
    await page.locator('p').first().click({ force: true });
    const popup = page.getByTestId('popup-root');
    await expect(popup).toBeVisible();

    await page.getByTestId('popup-textarea').fill('Test 2');
    await page.getByTestId('popup-submit').click({ force: true });
    await expect(page.getByTestId('popup-root')).not.toBeVisible();

    await expect(page.getByTestId('annotation-marker-1')).toBeVisible();
    await expect(page.getByTestId('annotation-marker-2')).toBeVisible({ timeout: 10000 });

    // Click clear button in toolbar
    const clearBtn = page.getByTestId('toolbar-clear-button');
    await clearBtn.click();

    // Wait for animations and clearing
    await expect(page.getByTestId('annotation-marker-1')).not.toBeVisible();
    await expect(page.getByTestId('annotation-marker-2')).not.toBeVisible();

    const badge = page.locator('.as-badge');
    await expect(badge).not.toBeVisible();
  });

  test('should be able to edit an annotation', async ({ page }) => {
    await page.getByTestId('as-toggle').click();
    await page.locator('h1').click({ force: true });
    await page.getByTestId('popup-textarea').fill('Original comment');
    await page.getByTestId('popup-submit').click();

    const marker = page.getByTestId('annotation-marker-1');
    await expect(marker).toBeVisible();

    // Hover marker and click edit button
    await marker.hover();
    await marker.getByTestId('marker-action-edit').click();

    const popup = page.getByTestId('popup-root');
    await expect(popup).toBeVisible();
    const textarea = page.getByTestId('popup-textarea');
    await expect(textarea).toHaveValue('Original comment');

    await textarea.fill('Updated comment');
    await page.getByTestId('popup-submit').click();

    // Wait for popup to be gone
    await expect(page.getByTestId('popup-root')).not.toBeVisible();

    // Verify updated text by re-opening the edit popup
    const updatedMarker = page.getByTestId('annotation-marker-1');
    await updatedMarker.hover({ force: true });
    await updatedMarker.getByTestId('marker-action-edit').click();
    await expect(page.getByTestId('popup-textarea')).toHaveValue('Updated comment');
    await page.getByTestId('popup-cancel').click();
  });

  test('should be able to copy from edit popup', async ({ page }) => {
    await page.getByTestId('as-toggle').click();
    await page.locator('h1').click({ force: true });
    await page.getByTestId('popup-textarea').fill('Comment to copy');
    await page.getByTestId('popup-submit').click();

    const marker = page.getByTestId('annotation-marker-1');
    await marker.hover();
    await marker.getByTestId('marker-action-edit').click();

    const copyBtn = page.getByTestId('popup-copy');
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    // Success feedback (live region announcement might be hard to test directly,
    // but we can check if the popup closes or stays open depending on implementation)
    // Actually, onCopy doesn't necessarily close the popup in current implementation.
  });

  test('should be able to attach images', async ({ page }) => {
    await page.getByTestId('as-toggle').click();
    await page.locator('h1').click({ force: true });

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('.as-popup-dropzone').click();
    const fileChooser = await fileChooserPromise;

    // Use a small 1x1 transparent PNG data URL if possible, but setInputFiles needs actual paths or buffers
    // Playwright allows passing a buffer
    await fileChooser.setFiles([
      {
        name: 'test.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          'base64',
        ),
      },
    ]);

    await expect(page.locator('.as-popup-attachment')).toHaveCount(1);

    await page.getByTestId('popup-textarea').fill('With attachment');
    await page.getByTestId('popup-submit').click();

    const marker = page.getByTestId('annotation-marker-1');
    await expect(marker).toBeVisible();
  });
});
