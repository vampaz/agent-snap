import { test, expect } from '@playwright/test';

import { clickMarkerAction, openToolbar, resetAgentSnapPage, waitForMarker } from './helpers';

test.describe('Agent Snap Annotation Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await resetAgentSnapPage(page);
  });

  test('should be able to add an annotation', async ({ page }) => {
    // Open toolbar
    await openToolbar(page);

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
    await openToolbar(page);
    await page.locator('h1').click({ force: true });
    await page.getByTestId('popup-textarea').fill('Test');
    await page.getByTestId('popup-submit').click();

    const marker = await waitForMarker(page, 1);
    await clickMarkerAction(marker, 'marker-action-delete');

    // Expect marker to disappear
    await expect(marker).not.toBeVisible();

    // Badge should be gone or 0
    const badge = page.locator('.as-badge');
    await expect(badge).not.toBeVisible();
  });

  test('should be able to clear all annotations', async ({ page }) => {
    // Add two annotations
    await openToolbar(page);

    // Annotation 1
    await page.locator('h1').click({ force: true });
    await page.getByTestId('popup-textarea').fill('Test 1');
    await page.getByTestId('popup-submit').click();
    await waitForMarker(page, 1);
    await page.getByTestId('popup-root').waitFor({ state: 'detached' });

    // Annotation 2
    await page.locator('p').first().click({ force: true });
    const popup = page.getByTestId('popup-root');
    await expect(popup).toBeVisible();

    await page.getByTestId('popup-textarea').fill('Test 2');
    await page.getByTestId('popup-submit').click({ force: true });
    await expect(page.getByTestId('popup-root')).not.toBeVisible();

    await waitForMarker(page, 1);
    await waitForMarker(page, 2);

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
    await openToolbar(page);
    await page.locator('h1').click({ force: true });
    await page.getByTestId('popup-textarea').fill('Original comment');
    await page.getByTestId('popup-submit').click();

    const marker = await waitForMarker(page, 1);
    await clickMarkerAction(marker, 'marker-action-edit');

    const popup = page.getByTestId('popup-root');
    await expect(popup).toBeVisible();
    const textarea = page.getByTestId('popup-textarea');
    await expect(textarea).toHaveValue('Original comment');

    await textarea.fill('Updated comment');
    await page.getByTestId('popup-submit').click();

    // Wait for popup to be gone
    await expect(page.getByTestId('popup-root')).not.toBeVisible();

    // Verify updated text by re-opening the edit popup
    const updatedMarker = await waitForMarker(page, 1);
    await clickMarkerAction(updatedMarker, 'marker-action-edit');
    await expect(page.getByTestId('popup-textarea')).toHaveValue('Updated comment');
    await page.getByTestId('popup-cancel').click();
  });

  test('should be able to copy from edit popup', async ({ page }) => {
    await openToolbar(page);
    await page.locator('h1').click({ force: true });
    await page.getByTestId('popup-textarea').fill('Comment to copy');
    await page.getByTestId('popup-submit').click();

    const marker = await waitForMarker(page, 1);
    await clickMarkerAction(marker, 'marker-action-edit');

    const copyBtn = page.getByTestId('popup-copy');
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    // Success feedback (live region announcement might be hard to test directly,
    // but we can check if the popup closes or stays open depending on implementation)
    // Actually, onCopy doesn't necessarily close the popup in current implementation.
  });

  test('should be able to attach images', async ({ page }) => {
    await openToolbar(page);
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

    await waitForMarker(page, 1);
  });
});
