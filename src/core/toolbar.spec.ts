import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentSnapSettings } from '@/types';
import {
  applyToolbarTheme,
  createToolbarElements,
  getNextOutputDetail,
  updateScreenshotQuotaUI,
  updateSettingsPanelVisibility,
  updateSettingsUI,
  updateToolbarMenuDirection,
  updateToolbarUI,
} from '@/core/toolbar';

function setRect(element: HTMLElement, rect: DOMRect): void {
  element.getBoundingClientRect = function getBoundingClientRect() {
    return rect;
  };
}

describe('toolbar helpers', function () {
  beforeEach(function () {
    document.body.innerHTML = '';
  });

  afterEach(function () {
    vi.useRealTimers();
  });

  it('shows and hides the settings panel with visibility tracking', function () {
    vi.useFakeTimers();
    const elements = createToolbarElements();
    document.body.appendChild(elements.toolbar);

    setRect(elements.toolbarContainer, {
      left: 400,
      right: 600,
      top: 100,
      bottom: 150,
      width: 200,
      height: 50,
      x: 400,
      y: 100,
      toJSON: function toJSON() {
        return {};
      },
    } as DOMRect);

    elements.toolbarContainer.dataset.menu = 'down';

    let onHideCalled = false;
    const shown = updateSettingsPanelVisibility({
      elements: elements,
      showSettings: true,
      showSettingsVisible: false,
    });

    expect(shown).toBe(true);
    expect(elements.settingsButton.dataset.active).toBe('true');
    expect(elements.settingsPanel.style.display).toBe('block');
    expect(elements.settingsPanel.classList.contains('as-enter')).toBe(true);

    const hiding = updateSettingsPanelVisibility({
      elements: elements,
      showSettings: false,
      showSettingsVisible: true,
      onHideComplete: function onHideComplete() {
        onHideCalled = true;
      },
    });

    expect(hiding).toBe(true);
    expect(elements.settingsPanel.classList.contains('as-exit')).toBe(true);

    vi.runAllTimers();

    expect(onHideCalled).toBe(true);
    expect(elements.settingsPanel.style.display).toBe('none');
  });

  it('positions the settings panel to the left when there is space', function () {
    const elements = createToolbarElements();
    document.body.appendChild(elements.toolbar);

    setRect(elements.toolbarContainer, {
      left: 400,
      right: 600,
      top: 100,
      bottom: 150,
      width: 200,
      height: 50,
      x: 400,
      y: 100,
      toJSON: function toJSON() {
        return {};
      },
    } as DOMRect);

    elements.toolbarContainer.dataset.menu = 'down';

    updateSettingsPanelVisibility({
      elements: elements,
      showSettings: true,
      showSettingsVisible: false,
    });

    expect(elements.settingsPanel.style.right).toBe('calc(100% + 12px)');
    expect(elements.settingsPanel.style.left).toBe('');
    expect(elements.settingsPanel.style.transformOrigin).toBe('top right');
  });

  it('positions the settings panel to the right when space is limited', function () {
    const elements = createToolbarElements();
    document.body.appendChild(elements.toolbar);

    setRect(elements.toolbarContainer, {
      left: 120,
      right: 300,
      top: 100,
      bottom: 150,
      width: 180,
      height: 50,
      x: 120,
      y: 100,
      toJSON: function toJSON() {
        return {};
      },
    } as DOMRect);

    elements.toolbarContainer.dataset.menu = 'up';

    updateSettingsPanelVisibility({
      elements: elements,
      showSettings: true,
      showSettingsVisible: false,
    });

    expect(elements.settingsPanel.style.left).toBe('calc(100% + 12px)');
    expect(elements.settingsPanel.style.right).toBe('');
    expect(elements.settingsPanel.style.transformOrigin).toBe('bottom left');
  });

  it('returns false when settings panel is hidden and not visible', function () {
    const elements = createToolbarElements();
    document.body.appendChild(elements.toolbar);

    const visible = updateSettingsPanelVisibility({
      elements: elements,
      showSettings: false,
      showSettingsVisible: false,
    });

    expect(visible).toBe(false);
    expect(elements.settingsPanel.style.display).toBe('');
  });

  it('chooses an upward menu direction when space below is tight', function () {
    const elements = createToolbarElements();
    document.body.appendChild(elements.toolbar);

    setRect(elements.toolbarContainer, {
      left: 100,
      right: 300,
      top: 500,
      bottom: 550,
      width: 200,
      height: 50,
      x: 100,
      y: 500,
      toJSON: function toJSON() {
        return {};
      },
    } as DOMRect);

    Object.defineProperty(window, 'innerHeight', {
      value: 600,
      configurable: true,
    });

    updateToolbarMenuDirection({ elements: elements });

    expect(elements.toolbarContainer.dataset.menu).toBe('up');
    expect(elements.toolbarContainer.style.getPropertyValue('--as-toolbar-menu-size')).toBe(
      '226px',
    );
  });

  it('keeps the menu direction down when there is ample space below', function () {
    const elements = createToolbarElements();
    document.body.appendChild(elements.toolbar);

    setRect(elements.toolbarContainer, {
      left: 100,
      right: 300,
      top: 40,
      bottom: 90,
      width: 200,
      height: 50,
      x: 100,
      y: 40,
      toJSON: function toJSON() {
        return {};
      },
    } as DOMRect);

    Object.defineProperty(window, 'innerHeight', {
      value: 900,
      configurable: true,
    });

    updateToolbarMenuDirection({ elements: elements });

    expect(elements.toolbarContainer.dataset.menu).toBe('down');
  });

  it('updates settings toggles and returns the next toggle state', function () {
    const elements = createToolbarElements();
    document.body.appendChild(elements.toolbar);

    const settings: AgentSnapSettings = {
      outputDetail: 'standard',
      autoClearAfterCopy: true,
      blockInteractions: true,
      captureScreenshots: true,
      uploadScreenshots: true,
      annotationColor: '#3c82f7',
    };

    const nextState = updateSettingsUI({
      elements: elements,
      settings: settings,
      lastToggleState: {
        autoClearAfterCopy: false,
        blockInteractions: false,
        captureScreenshots: false,
      },
      onSelectColor: function onSelectColor() {},
    });

    expect(elements.clearCheckbox.checked).toBe(true);
    expect(elements.clearCustom.classList.contains('as-checked')).toBe(true);
    expect(elements.blockCheckbox.checked).toBe(true);
    expect(elements.screenshotCheckbox.checked).toBe(true);
    expect(nextState).toEqual({
      autoClearAfterCopy: true,
      blockInteractions: true,
      captureScreenshots: true,
    });
  });

  it('cycles output detail options in order', function () {
    expect(getNextOutputDetail('standard')).toBe('detailed');
    expect(getNextOutputDetail('detailed')).toBe('forensic');
    expect(getNextOutputDetail('forensic')).toBe('standard');
  });

  it('invokes color selection handler when clicking a color ring', function () {
    const elements = createToolbarElements();
    document.body.appendChild(elements.toolbar);

    const settings: AgentSnapSettings = {
      outputDetail: 'standard',
      autoClearAfterCopy: false,
      blockInteractions: false,
      captureScreenshots: false,
      uploadScreenshots: true,
      annotationColor: '#3c82f7',
    };

    let selectedColor = '';
    updateSettingsUI({
      elements: elements,
      settings: settings,
      lastToggleState: {
        autoClearAfterCopy: false,
        blockInteractions: false,
        captureScreenshots: false,
      },
      onSelectColor: function onSelectColor(color) {
        selectedColor = color;
      },
    });

    const ring = elements.colorOptions.querySelector('[data-testid="settings-color-option-0"]');
    expect(ring).not.toBeNull();
    (ring as HTMLDivElement).click();

    expect(selectedColor).toBe('#AF52DE');
  });

  it('renders output detail dots and highlights the active option', function () {
    const elements = createToolbarElements();
    document.body.appendChild(elements.toolbar);

    const settings: AgentSnapSettings = {
      outputDetail: 'detailed',
      autoClearAfterCopy: false,
      blockInteractions: false,
      captureScreenshots: false,
      uploadScreenshots: true,
      annotationColor: '#3c82f7',
    };

    updateSettingsUI({
      elements: elements,
      settings: settings,
      lastToggleState: {
        autoClearAfterCopy: false,
        blockInteractions: false,
        captureScreenshots: false,
      },
      onSelectColor: function onSelectColor() {},
    });

    const dots = elements.outputCycleDots.querySelectorAll('.as-cycle-dot');
    const activeDots = elements.outputCycleDots.querySelectorAll('.as-cycle-dot.as-active');

    expect(dots.length).toBe(3);
    expect(activeDots.length).toBe(1);
  });

  it('highlights the selected color ring with a border', function () {
    const elements = createToolbarElements();
    document.body.appendChild(elements.toolbar);

    const settings: AgentSnapSettings = {
      outputDetail: 'standard',
      autoClearAfterCopy: false,
      blockInteractions: false,
      captureScreenshots: false,
      uploadScreenshots: true,
      annotationColor: '#FF9500',
    };

    updateSettingsUI({
      elements: elements,
      settings: settings,
      lastToggleState: {
        autoClearAfterCopy: false,
        blockInteractions: false,
        captureScreenshots: false,
      },
      onSelectColor: function onSelectColor() {},
    });

    const selectedRing = elements.colorOptions.querySelector(
      '[data-testid="settings-color-option-5"]',
    ) as HTMLDivElement;

    expect(selectedRing.style.borderColor).toBe('rgb(255, 149, 0)');
  });

  it('renders screenshot quota text after the screenshots toggle', function () {
    const elements = createToolbarElements();
    document.body.appendChild(elements.toolbar);

    updateScreenshotQuotaUI({
      elements: elements,
      quota: { used: 3, total: 10 },
    });

    expect(elements.screenshotQuotaText.textContent).toBe('7/10');
    expect(elements.screenshotQuotaText.style.display).toBe('block');
  });

  it('shows an infinity symbol when all screenshots are available', function () {
    const elements = createToolbarElements();
    document.body.appendChild(elements.toolbar);

    updateScreenshotQuotaUI({
      elements: elements,
      quota: { used: 0, total: 10 },
    });

    expect(elements.screenshotQuotaText.textContent).toBe('∞');
    expect(elements.screenshotQuotaText.style.display).toBe('block');
  });

  it('applies light theme classes and icon to the toolbar', function () {
    const elements = createToolbarElements();
    document.body.appendChild(elements.toolbar);

    applyToolbarTheme({ elements: elements, isDarkMode: true });
    const darkIconMarkup = elements.themeToggle.innerHTML;
    applyToolbarTheme({ elements: elements, isDarkMode: false });
    const lightIconMarkup = elements.themeToggle.innerHTML;

    expect(elements.toolbarContainer.classList.contains('as-light')).toBe(true);
    expect(elements.settingsPanel.classList.contains('as-light')).toBe(true);
    expect(elements.pauseButton.classList.contains('as-light')).toBe(true);
    expect(elements.toggleContent.style.color).toBe('rgba(0, 0, 0, 0.7)');
    expect(elements.themeToggle.childElementCount).toBe(1);
    expect(darkIconMarkup).not.toBe(lightIconMarkup);
  });

  it('updates badge, menu state, and action flags', function () {
    const elements = createToolbarElements();
    document.body.appendChild(elements.toolbar);

    updateToolbarUI({
      elements: elements,
      annotationsCount: 0,
      isActive: false,
      showEntranceAnimation: false,
      isFrozen: false,
      copied: false,
      accentColor: '#34C759',
    });

    expect(elements.badge.style.display).toBe('none');
    expect(elements.clearButton.disabled).toBe(true);

    updateToolbarUI({
      elements: elements,
      annotationsCount: 2,
      isActive: true,
      showEntranceAnimation: true,
      isFrozen: true,
      copied: true,
      accentColor: '#34C759',
    });

    expect(elements.badge.style.display).toBe('inline-flex');
    expect(elements.badge.style.backgroundColor).toBe('rgb(52, 199, 89)');
    expect(elements.toolbarContainer.classList.contains('as-expanded')).toBe(true);
    expect(elements.pauseButton.dataset.active).toBe('true');
    expect(elements.copyButton.dataset.active).toBe('true');
  });
});
