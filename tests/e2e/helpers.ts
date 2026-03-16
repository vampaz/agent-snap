import { expect, type Locator, type Page } from '@playwright/test';

const TEST_STYLES = `
  [data-agent-snap-root] *,
  [data-agent-snap-root] *::before,
  [data-agent-snap-root] *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
`;

export async function resetAgentSnapPage(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.addStyleTag({ content: TEST_STYLES });
  await expect(page.getByTestId('toolbar')).toBeVisible();
}

export async function openToolbar(page: Page): Promise<void> {
  const toolbarContainer = page.getByTestId('toolbar-container');
  const className = (await toolbarContainer.getAttribute('class')) ?? '';
  if (className.includes('as-expanded')) {
    await expect(page.getByTestId('toolbar-copy-button')).toBeVisible();
    return;
  }

  await page.getByTestId('as-toggle').click({ force: true });
  await expect(toolbarContainer).toHaveClass(/as-expanded/);
  await expect(page.getByTestId('toolbar-copy-button')).toBeVisible();
}

export async function openSettings(page: Page): Promise<void> {
  await openToolbar(page);
  await page.getByTestId('toolbar-settings-button').click({ force: true });
  await expect(page.getByTestId('settings-panel')).toBeVisible();
}

export async function closeSettings(page: Page): Promise<void> {
  await page.getByTestId('toolbar-settings-button').click({ force: true });
  await expect(page.getByTestId('settings-panel')).not.toBeVisible();
}

export async function waitForMarker(page: Page, index: number): Promise<Locator> {
  const marker = page.getByTestId(`annotation-marker-${index}`);
  await expect(marker).toBeVisible();
  return marker;
}

export async function clickMarkerAction(marker: Locator, actionTestId: string): Promise<void> {
  await expect(marker).toBeVisible();
  await marker.hover({ force: true });
  const action = marker.getByTestId(actionTestId);
  await expect(action).toBeVisible();
  await action.click({ force: true });
}
