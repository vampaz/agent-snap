import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createUiAnnotator, registerUiAnnotatorElement } from '@/core/ui-annotator';

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

function ensureLocalStorage(): Storage {
  const globalRef = globalThis as typeof globalThis & { localStorage?: Storage };
  const storage = globalRef.localStorage;
  if (
    storage &&
    typeof storage.getItem === 'function' &&
    typeof storage.setItem === 'function' &&
    typeof storage.removeItem === 'function' &&
    typeof storage.clear === 'function'
  ) {
    return storage;
  }

  const store = new Map<string, string>();
  const fallback = Object.create(
    typeof Storage === 'undefined' ? null : Storage.prototype,
  ) as Storage;
  fallback.getItem = function getItem(key: string): string | null {
    return store.has(key) ? store.get(key) ?? null : null;
  };
  fallback.setItem = function setItem(key: string, value: string): void {
    store.set(key, String(value));
  };
  fallback.removeItem = function removeItem(key: string): void {
    store.delete(key);
  };
  fallback.clear = function clear(): void {
    store.clear();
  };
  fallback.key = function key(index: number): string | null {
    return Array.from(store.keys())[index] ?? null;
  };
  Object.defineProperty(fallback, 'length', {
    get: function getLength() {
      return store.size;
    },
  });

  Object.defineProperty(globalRef, 'localStorage', {
    value: fallback,
    configurable: true,
  });

  return fallback;
}

function setRect(element: HTMLElement, rect: Rect): void {
  element.getBoundingClientRect = function getBoundingClientRect() {
    return rect as DOMRect;
  };
}

function mockPointing(element: HTMLElement): void {
  if (!document.elementFromPoint) {
    document.elementFromPoint = function () {
      return element;
    };
  }
  if (!document.elementsFromPoint) {
    document.elementsFromPoint = function () {
      return [element];
    };
  }
  vi.spyOn(document, 'elementFromPoint').mockImplementation(function () {
    return element;
  });
  vi.spyOn(document, 'elementsFromPoint').mockImplementation(function () {
    return [element];
  });
}

function setupContent(): {
  button: HTMLElement;
  box: HTMLElement;
} {
  const container = document.createElement('div');
  const button = document.createElement('button');
  button.id = 'target';
  button.textContent = 'Save';
  const box = document.createElement('div');
  box.id = 'box';
  box.textContent = 'Box';
  container.appendChild(button);
  container.appendChild(box);
  document.body.appendChild(container);

  setRect(button, {
    left: 10,
    top: 10,
    right: 110,
    bottom: 40,
    width: 100,
    height: 30,
  });
  setRect(box, {
    left: 20,
    top: 60,
    right: 160,
    bottom: 140,
    width: 140,
    height: 80,
  });

  return { button, box };
}

function activateToolbar(): HTMLElement {
  const toolbarContainer = document.querySelector(
    '.ua-toolbar-container',
  ) as HTMLElement;
  toolbarContainer.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return toolbarContainer;
}

function openPendingPopup(): HTMLDivElement {
  return document.querySelector('.ua-popup') as HTMLDivElement;
}

function fillPopup(text: string): void {
  const textarea = document.querySelector(
    '.ua-popup-textarea',
  ) as HTMLTextAreaElement;
  textarea.value = text;
  textarea.dispatchEvent(new Event('input'));
  const submit = document.querySelector(
    '.ua-popup-submit',
  ) as HTMLButtonElement;
  submit.click();
}

describe('ui annotator', function () {
  beforeEach(function () {
    document.body.innerHTML = '';
    ensureLocalStorage().clear();
    vi.restoreAllMocks();
    if (!globalThis.requestAnimationFrame) {
      globalThis.requestAnimationFrame = function requestAnimationFrame(
        callback,
      ) {
        callback(0);
        return 0;
      };
    }
  });

  afterEach(function () {
    document.querySelectorAll('[data-ui-annotator-root]').forEach(function (el) {
      el.remove();
    });
    ensureLocalStorage().clear();
    vi.useRealTimers();
  });

  it('mounts, annotates, edits, copies, and clears', async function () {
    vi.useFakeTimers();
    const { button } = setupContent();
    mockPointing(button);

    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.defineProperty(navigator, 'clipboard', {
      value: clipboard,
      configurable: true,
    });

    const instance = createUiAnnotator({ mount: document.body });
    const toolbarContainer = activateToolbar();
    instance.setSettings({ blockInteractions: true });

    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: function toString() {
        return 'Selected text';
      },
      removeAllRanges: vi.fn(),
    } as unknown as Selection);

    toolbarContainer.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }),
    );
    toolbarContainer.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, clientX: 30, clientY: 30 }),
    );
    toolbarContainer.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    button.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, clientX: 15, clientY: 15 }),
    );
    const hoverHighlight = document.querySelector('.ua-hover-highlight') as HTMLElement;
    expect(hoverHighlight.style.display).toBe('block');

    button.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 15, clientY: 15 }),
    );
    expect(openPendingPopup()).not.toBeNull();
    fillPopup('Update button copy');
    vi.advanceTimersByTime(350);

    const markers = document.querySelectorAll('.ua-marker');
    expect(markers.length).toBeGreaterThan(0);

    const marker = markers[0] as HTMLElement;
    marker.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    const tooltip = marker.querySelector('.ua-marker-tooltip');
    expect(tooltip).not.toBeNull();
    marker.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    marker.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    fillPopup('New comment');
    vi.advanceTimersByTime(200);
    expect(instance.getAnnotations()[0].comment).toBe('New comment');

    const controlButtons = Array.from(
      document.querySelectorAll('.ua-controls-content .ua-control-button'),
    ) as HTMLButtonElement[];
    const markersButton = controlButtons[1];
    const settingsButton = controlButtons[4];
    markersButton.click();
    markersButton.click();
    settingsButton.click();
    const settingsPanel = document.querySelector(
      '.ua-settings-panel',
    ) as HTMLElement;
    expect(settingsPanel.style.top).toContain('calc');
    const colorOption = settingsPanel.querySelector(
      '.ua-color-option-ring',
    ) as HTMLElement;
    colorOption.click();
    const clearToggle = settingsPanel.querySelector(
      '#ua-auto-clear',
    ) as HTMLInputElement;
    clearToggle.click();
    const blockToggle = settingsPanel.querySelector(
      '#ua-block-interactions',
    ) as HTMLInputElement;
    blockToggle.click();

    const themeToggle = document.querySelector(
      '.ua-theme-toggle',
    ) as HTMLButtonElement;
    themeToggle.click();
    expect(
      document
        .querySelector('.ua-toolbar-container')
        ?.classList.contains('ua-light'),
    ).toBe(true);
    settingsButton.click();

    instance.setSettings({ annotationColor: '#445566' });
    const root = document.querySelector(
      '[data-ui-annotator-root]',
    ) as HTMLElement;
    expect(root.style.getPropertyValue('--ua-accent')).toBe('#445566');

    instance.setSettings({ autoClearAfterCopy: true });
    const copyButton = controlButtons[2];
    copyButton.click();
    await vi.runAllTimersAsync();
    expect(clipboard.writeText).toHaveBeenCalled();
    expect(instance.getAnnotations()).toHaveLength(0);

    const pauseButton = document.querySelector(
      '.ua-control-button',
    ) as HTMLButtonElement;
    pauseButton.click();
    expect(document.getElementById('ui-annotator-freeze-styles')).not.toBeNull();
    pauseButton.click();
    expect(document.getElementById('ui-annotator-freeze-styles')).toBeNull();

    const exitButton = controlButtons[5];
    exitButton.click();

    instance.destroy();
    expect(document.querySelector('[data-ui-annotator-root]')).toBeNull();
  });

  it('supports drag selection and deletion', async function () {
    vi.useFakeTimers();
    const { box } = setupContent();
    mockPointing(box);

    const onCopy = vi.fn();
    const instance = createUiAnnotator({ mount: document.body, onCopy: onCopy });
    activateToolbar();

    box.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, clientX: 20, clientY: 60 }),
    );
    box.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, clientX: 120, clientY: 120 }),
    );
    box.dispatchEvent(
      new MouseEvent('mouseup', { bubbles: true, clientX: 120, clientY: 120 }),
    );

    const popup = openPendingPopup();
    expect(popup).not.toBeNull();
    const cancel = popup.querySelector('.ua-popup-cancel') as HTMLButtonElement;
    cancel.click();
    vi.advanceTimersByTime(200);

    box.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 25, clientY: 70 }),
    );
    fillPopup('Multi select');
    vi.advanceTimersByTime(200);

    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });
    await instance.copyOutput();
    expect(onCopy).toHaveBeenCalled();

    const marker = document.querySelector('.ua-marker') as HTMLElement;
    marker.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vi.advanceTimersByTime(200);

    expect(instance.getAnnotations()).toHaveLength(0);
    instance.destroy();
  });

  it('loads settings and theme from storage', function () {
    localStorage.setItem(
      'ui-annotator-settings',
      JSON.stringify({
        outputDetail: 'compact',
        autoClearAfterCopy: true,
        annotationColor: '#112233',
        blockInteractions: true,
      }),
    );
    localStorage.setItem('ui-annotator-theme', 'light');

    const instance = createUiAnnotator({ mount: document.body });
    const toolbarContainer = document.querySelector(
      '.ua-toolbar-container',
    ) as HTMLElement;
    expect(toolbarContainer.classList.contains('ua-light')).toBe(true);
    const root = document.querySelector(
      '[data-ui-annotator-root]',
    ) as HTMLElement;
    expect(root.style.getPropertyValue('--ua-accent')).toBe('#112233');
    instance.destroy();
  });

  it('fires annotation lifecycle callbacks and respects copyToClipboard', async function () {
    vi.useFakeTimers();
    const { button } = setupContent();
    mockPointing(button);

    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.defineProperty(navigator, 'clipboard', {
      value: clipboard,
      configurable: true,
    });

    const onAnnotationAdd = vi.fn();
    const onAnnotationDelete = vi.fn();
    const onAnnotationUpdate = vi.fn();
    const onAnnotationsClear = vi.fn();
    const onCopy = vi.fn();

    const instance = createUiAnnotator({
      mount: document.body,
      copyToClipboard: false,
      onAnnotationAdd: onAnnotationAdd,
      onAnnotationDelete: onAnnotationDelete,
      onAnnotationUpdate: onAnnotationUpdate,
      onAnnotationsClear: onAnnotationsClear,
      onCopy: onCopy,
    });
    activateToolbar();

    button.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 15, clientY: 15 }),
    );
    fillPopup('First note');
    vi.advanceTimersByTime(200);

    expect(onAnnotationAdd).toHaveBeenCalledTimes(1);
    const addedAnnotation = onAnnotationAdd.mock.calls[0][0];
    expect(addedAnnotation.comment).toBe('First note');

    const marker = document.querySelector('.ua-marker') as HTMLElement;
    marker.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    fillPopup('Updated note');
    vi.advanceTimersByTime(200);

    expect(onAnnotationUpdate).toHaveBeenCalledTimes(1);
    const updatedAnnotation = onAnnotationUpdate.mock.calls[0][0];
    expect(updatedAnnotation.comment).toBe('Updated note');

    await instance.copyOutput();
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(clipboard.writeText).not.toHaveBeenCalled();

    const clearButton = document.querySelector(
      '.ua-control-button[data-danger="true"]',
    ) as HTMLButtonElement;
    clearButton.click();
    vi.advanceTimersByTime(260);

    expect(onAnnotationsClear).toHaveBeenCalledTimes(1);
    expect(onAnnotationsClear.mock.calls[0][0]).toHaveLength(1);

    button.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 15, clientY: 15 }),
    );
    fillPopup('Delete me');
    vi.advanceTimersByTime(200);

    const deleteMarker = document.querySelector('.ua-marker') as HTMLElement;
    deleteMarker.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vi.advanceTimersByTime(200);

    expect(onAnnotationDelete).toHaveBeenCalledTimes(1);
    const deletedAnnotation = onAnnotationDelete.mock.calls[0][0];
    expect(deletedAnnotation.comment).toBe('Delete me');

    instance.destroy();
  });

  it('returns a noop instance without a mount target', async function () {
    const instance = createUiAnnotator({ mount: '#missing' });
    expect(instance.getAnnotations()).toEqual([]);
    expect(await instance.copyOutput()).toBe('');
  });

  it('mounts into selector and shadow root targets', function () {
    const mount = document.createElement('div');
    mount.id = 'mount';
    document.body.appendChild(mount);

    const instance = createUiAnnotator({ mount: '#mount' });
    expect(mount.querySelector('[data-ui-annotator-root]')).not.toBeNull();
    instance.destroy();

    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    document.body.appendChild(host);

    const shadowInstance = createUiAnnotator({ mount: shadow });
    expect(shadow.querySelector('[data-ui-annotator-root]')).not.toBeNull();
    expect(shadow.querySelector('#ui-annotator-styles')).not.toBeNull();
    const secondShadowInstance = createUiAnnotator({ mount: shadow });
    secondShadowInstance.destroy();
    shadowInstance.destroy();
  });

  it('returns noop when document is missing', function () {
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, 'document', {
      value: undefined,
      configurable: true,
    });
    const instance = createUiAnnotator();
    expect(instance.getAnnotations()).toEqual([]);
    Object.defineProperty(globalThis, 'document', {
      value: originalDocument,
      configurable: true,
    });
  });

  it('registers the custom element', function () {
    registerUiAnnotatorElement();
    const element = document.createElement('ui-annotator');
    element.setAttribute('annotation-color', '#ff0000');
    element.setAttribute('output-detail', 'compact');
    element.setAttribute('auto-clear-after-copy', '');
    element.setAttribute('block-interactions', '');
    element.setAttribute('z-index', '99999');
    document.body.appendChild(element);

    const root = document.querySelector('[data-ui-annotator-root]') as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.style.getPropertyValue('--ua-accent')).toBe('#ff0000');

    element.setAttribute('annotation-color', '#00ff00');
    expect(root.style.getPropertyValue('--ua-accent')).toBe('#00ff00');

    element.remove();
  });

  it('creates area selections and shakes pending popup', function () {
    vi.useFakeTimers();
    const container = document.createElement('div');
    container.textContent = 'Empty area';
    document.body.appendChild(container);

    if (!document.elementsFromPoint) {
      document.elementsFromPoint = function () {
        return [];
      };
    }
    vi.spyOn(document, 'elementsFromPoint').mockImplementation(function () {
      return [];
    });

    const originalQuery = document.querySelectorAll.bind(document);
    vi.spyOn(document, 'querySelectorAll').mockImplementation(function (selector) {
      if (typeof selector === 'string' && selector.includes('button')) {
        return [] as unknown as NodeListOf<Element>;
      }
      return originalQuery(selector);
    });

    const instance = createUiAnnotator({ mount: document.body });
    activateToolbar();

    container.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, clientX: 20, clientY: 20 }),
    );
    container.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, clientX: 120, clientY: 120 }),
    );
    container.dispatchEvent(
      new MouseEvent('mouseup', { bubbles: true, clientX: 120, clientY: 120 }),
    );

    const popup = document.querySelector('.ua-popup') as HTMLElement;
    const textarea = popup.querySelector(
      '.ua-popup-textarea',
    ) as HTMLTextAreaElement;
    expect(textarea.placeholder).toContain('area');

    container.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 30, clientY: 30 }),
    );
    container.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 30, clientY: 30 }),
    );
    expect(popup.classList.contains('ua-shake')).toBe(true);
    vi.advanceTimersByTime(250);

    const cancel = popup.querySelector('.ua-popup-cancel') as HTMLButtonElement;
    cancel.click();
    vi.advanceTimersByTime(200);

    instance.destroy();
  });

  it('creates fixed markers for fixed elements', function () {
    vi.useFakeTimers();
    const fixed = document.createElement('div');
    fixed.textContent = 'Fixed';
    fixed.style.position = 'fixed';
    document.body.appendChild(fixed);
    setRect(fixed, {
      left: 10,
      top: 10,
      right: 110,
      bottom: 40,
      width: 100,
      height: 30,
    });

    mockPointing(fixed);

    const instance = createUiAnnotator({ mount: document.body });
    activateToolbar();

    fixed.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 15, clientY: 15 }),
    );
    fillPopup('Fixed note');
    vi.advanceTimersByTime(200);

    const fixedLayer = document.querySelector(
      '.ua-fixed-markers-layer',
    ) as HTMLElement;
    expect(fixedLayer.querySelector('.ua-fixed')).not.toBeNull();

    const fixedMarker = fixedLayer.querySelector('.ua-fixed') as HTMLElement;
    fixedMarker.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    fixedMarker.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    instance.destroy();
  });

  it('returns empty copy output with no annotations', async function () {
    const instance = createUiAnnotator({ mount: document.body });
    const output = await instance.copyOutput();
    expect(output).toBe('');
    instance.destroy();
  });
});
