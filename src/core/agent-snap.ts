import uiAnnotatorCss from '@/styles/agent-snap.css?inline';
import type {
  Annotation,
  OutputDetailLevel,
  AgentSnapInstance,
  AgentSnapOptions,
  AgentSnapSettings,
} from '@/types';
import {
  createOverlayElements,
  updateDragUI as applyDragUI,
  updateEditOutline as applyEditOutline,
  updateHoverOverlay as applyHoverOverlay,
  updatePendingUI as applyPendingUI,
} from '@/core/overlay';
import {
  renderMarkers as applyRenderMarkers,
  updateMarkerHoverUI as applyMarkerHoverUI,
  updateMarkerOutline as applyMarkerOutline,
} from '@/core/markers';
import {
  getSelectionConfig,
  getSelectionMetrics,
  MIN_AREA_SELECTION_SIZE,
} from '@/core/selection';
import {
  getAccessibilityInfo,
  getDetailedComputedStyles,
  getElementClasses,
  getFullElementPath,
  getNearbyElements,
  getNearbyText,
  identifyElement,
} from '@/utils/element-identification';
import { generateOutput } from '@/utils/output';
import { clearAnnotations, loadAnnotations, saveAnnotations } from '@/utils/storage';
import { t } from '@/utils/i18n';
import { applyInlineStyles } from '@/utils/styles';
import {
  createIconCheckSmall,
  createIconCheckSmallAnimated,
  createIconClose,
  createIconCopyAnimated,
  createIconGear,
  createIconHelp,
  createIconListSparkle,
  createIconMoon,
  createIconPausePlayAnimated,
  createIconPlus,
  createIconSun,
  createIconTrash,
  createIconXmark,
  createIconXmarkLarge,
} from '@/icons';
import { createAnnotationPopup } from '@/ui/popup';
import packageInfo from '../../package.json';

const DEFAULT_SETTINGS: AgentSnapSettings = {
  outputDetail: 'standard',
  autoClearAfterCopy: false,
  annotationColor: '#3c82f7',
  blockInteractions: false,
  captureScreenshots: true,
};

const OUTPUT_DETAIL_OPTIONS: { value: OutputDetailLevel; label: string }[] = [
  { value: 'standard', label: t('settings.outputDetail.standard') },
  { value: 'detailed', label: t('settings.outputDetail.detailed') },
  { value: 'forensic', label: t('settings.outputDetail.forensic') },
];

const COLOR_OPTIONS = [
  { value: '#AF52DE', label: t('settings.color.purple') },
  { value: '#3c82f7', label: t('settings.color.blue') },
  { value: '#5AC8FA', label: t('settings.color.cyan') },
  { value: '#34C759', label: t('settings.color.green') },
  { value: '#FFD60A', label: t('settings.color.yellow') },
  { value: '#FF9500', label: t('settings.color.orange') },
  { value: '#FF3B30', label: t('settings.color.red') },
];

const SETTINGS_KEY = 'agent-snap-settings';
const THEME_KEY = 'agent-snap-theme';

let hasPlayedEntranceAnimation = false;
let annotationCounter = 0;

const AREA_SELECTION_LABEL = t('annotation.areaSelection');
const MULTI_SELECT_PATH = t('annotation.multiSelectPath');

type HoverInfo = {
  element: string;
  elementPath: string;
  rect: DOMRect | null;
};

type PendingAnnotation = {
  x: number;
  y: number;
  clientY: number;
  element: string;
  elementPath: string;
  selectedText?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  screenshot?: string;
  screenshotPromise?: Promise<string | null>;
  nearbyText?: string;
  cssClasses?: string;
  isMultiSelect?: boolean;
  isFixed?: boolean;
  fullPath?: string;
  accessibility?: string;
  computedStyles?: string;
  nearbyElements?: string;
};

function resolveMountTarget(mount?: AgentSnapOptions['mount']): HTMLElement | ShadowRoot | null {
  if (typeof document === 'undefined') return null;
  if (!mount) return document.body;
  if (typeof mount === 'string') {
    const found = document.querySelector(mount);
    return found instanceof HTMLElement ? found : null;
  }
  if (mount instanceof HTMLElement) return mount;
  if (typeof ShadowRoot !== 'undefined' && mount instanceof ShadowRoot) {
    return mount;
  }
  return null;
}

function injectStyles(target: HTMLElement | ShadowRoot | null): void {
  if (typeof document === 'undefined') return;
  const rootNode =
    target && typeof ShadowRoot !== 'undefined' && target instanceof ShadowRoot
      ? target
      : document.head;
  const existing = rootNode.querySelector('#agent-snap-styles');
  if (existing) return;
  const style = document.createElement('style');
  style.id = 'agent-snap-styles';
  style.textContent = uiAnnotatorCss;
  rootNode.appendChild(style);
}

function isElementFixed(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    const position = style.position;
    if (position === 'fixed') {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

function createAnnotationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  annotationCounter += 1;
  return `${Date.now()}-${annotationCounter}`;
}

function safeSetLocalStorage(key: string, value: string): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

function getDocumentSize(): { width: number; height: number } {
  const body = document.body;
  const doc = document.documentElement;
  return {
    width: Math.max(
      body.scrollWidth,
      body.offsetWidth,
      doc.clientWidth,
      doc.scrollWidth,
      doc.offsetWidth,
    ),
    height: Math.max(
      body.scrollHeight,
      body.offsetHeight,
      doc.clientHeight,
      doc.scrollHeight,
      doc.offsetHeight,
    ),
  };
}

function getComputedStyleText(style: CSSStyleDeclaration): string {
  return Array.from(style)
    .map(function mapProperty(property) {
      return `${property}:${style.getPropertyValue(property)};`;
    })
    .join('');
}

function cloneWithInlineStyles(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement;
  const sourceElements = [element].concat(Array.from(element.querySelectorAll('*')));
  const clonedElements = [clone].concat(Array.from(clone.querySelectorAll('*')));

  sourceElements.forEach(function inlineStyles(source, index) {
    const cloned = clonedElements[index];
    if (!(cloned instanceof HTMLElement)) return;
    const computed = window.getComputedStyle(source);
    cloned.setAttribute('style', getComputedStyleText(computed));
  });

  return clone;
}

function stripAnnotatorNodes(root: HTMLElement): void {
  if (root.matches('[data-agent-snap]')) {
    root.removeAttribute('data-agent-snap');
  }
  root.querySelectorAll('[data-agent-snap]').forEach(function removeAnnotator(node) {
    node.remove();
  });
}

function renderCloneToDataUrl(
  clone: HTMLElement,
  width: number,
  height: number,
  offset?: { x: number; y: number },
): Promise<string | null> {
  if (width <= 0 || height <= 0) return Promise.resolve(null);
  if (typeof Image === 'undefined') return Promise.resolve(null);
  stripAnnotatorNodes(clone);
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  if (offset) {
    clone.style.transform = `translate(${-offset.x}px, ${-offset.y}px)`;
    clone.style.transformOrigin = 'top left';
  }
  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.overflow = 'hidden';
  wrapper.appendChild(clone);

  const serialized = new XMLSerializer().serializeToString(wrapper);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`;
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return new Promise(function resolveScreenshot(resolve) {
    const image = new Image();
    image.decoding = 'async';
    image.onload = function handleLoad() {
      const canvas = document.createElement('canvas');
      const scale = window.devicePixelRatio || 1;
      canvas.width = width * scale;
      canvas.height = height * scale;
      const context = canvas.getContext('2d');
      if (!context) {
        resolve(null);
        return;
      }
      context.scale(scale, scale);
      context.drawImage(image, 0, 0);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    image.onerror = function handleError() {
      resolve(null);
    };
    image.src = svgUrl;
  });
}

function captureAnnotationScreenshot(bounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Promise<string | null> {
  if (typeof window === 'undefined' || !document.body) {
    return Promise.resolve(null);
  }
  const roundedBounds = {
    x: Math.max(0, Math.round(bounds.x)),
    y: Math.max(0, Math.round(bounds.y)),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
  };
  const docSize = getDocumentSize();
  const clone = cloneWithInlineStyles(document.body);
  clone.style.width = `${docSize.width}px`;
  clone.style.height = `${docSize.height}px`;
  return renderCloneToDataUrl(clone, roundedBounds.width, roundedBounds.height, {
    x: roundedBounds.x,
    y: roundedBounds.y,
  });
}

function noop(): void {}

function noopGetAnnotations(): Annotation[] {
  return [];
}

function noopCopy(): Promise<string> {
  return Promise.resolve('');
}

function buildMultiSelectLabel(count: number, elements: string, suffix: string): string {
  return t('annotation.multiSelectLabel', {
    count: count,
    elements: elements,
    suffix: suffix,
  });
}

function createNoopInstance(): AgentSnapInstance {
  return {
    destroy: noop,
    setSettings: noop,
    getAnnotations: noopGetAnnotations,
    copyOutput: noopCopy,
  };
}

export function createAgentSnap(options: AgentSnapOptions = {}): AgentSnapInstance {
  const mountTarget = resolveMountTarget(options.mount);
  if (!mountTarget || typeof document === 'undefined') {
    return createNoopInstance();
  }

  injectStyles(mountTarget);

  const root = document.createElement('div');
  root.dataset.agentSnapRoot = 'true';
  root.dataset.agentSnap = 'true';
  if (typeof options.zIndex === 'number') {
    root.style.zIndex = String(options.zIndex);
  }
  mountTarget.appendChild(root);

  let isActive = false;
  let markersVisible = false;
  let markersExiting = false;
  let hoverInfo: HoverInfo | null = null;
  let hoverPosition = { x: 0, y: 0 };
  let pendingAnnotation: PendingAnnotation | null = null;
  let copied = false;
  let isClearing = false;
  let hoveredMarkerId: string | null = null;
  let deletingMarkerId: string | null = null;
  let renumberFrom: number | null = null;
  let editingAnnotation: Annotation | null = null;
  let scrollY = 0;
  let isScrolling = false;
  let isFrozen = false;
  let showSettings = false;
  let showSettingsVisible = false;
  let isDarkMode = true;
  let showEntranceAnimation = false;
  let toolbarPosition: { x: number; y: number } | null = null;
  let isDraggingToolbar = false;
  let dragStartPos: {
    x: number;
    y: number;
    toolbarX: number;
    toolbarY: number;
  } | null = null;
  let dragRotation = 0;
  let justFinishedToolbarDrag = false;
  let isDragging = false;
  let mouseDownPos: { x: number; y: number } | null = null;
  let dragStart: { x: number; y: number } | null = null;
  let justFinishedDrag = false;
  let lastElementUpdate = 0;
  let recentlyAddedId: string | null = null;
  let pendingExiting = false;

  const animatedMarkers = new Set<string>();
  const exitingMarkers = new Set<string>();

  const DRAG_THRESHOLD = 8;
  const ELEMENT_UPDATE_THROTTLE = 50;
  const HOVER_UPDATE_THROTTLE = 40;

  const markerElements = new Map<string, HTMLDivElement>();
  const fixedMarkerElements = new Map<string, HTMLDivElement>();

  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastHoverUpdate = -Infinity;
  let lastHoverElement: HTMLElement | null = null;
  let systemThemeMediaQuery: MediaQueryList | null = null;
  let systemThemeListenerType: 'event' | 'listener' | null = null;
  let shadowRoots: ShadowRoot[] | null = null;
  let shadowObserver: MutationObserver | null = null;

  const pathname = window.location.pathname;

  let settings: AgentSnapSettings = {
    ...DEFAULT_SETTINGS,
    ...options.settings,
  };
  let lastToggleState = {
    autoClearAfterCopy: settings.autoClearAfterCopy,
    blockInteractions: settings.blockInteractions,
    captureScreenshots: settings.captureScreenshots,
  };
  const shouldCopyToClipboard = options.copyToClipboard !== false;

  function createControlButton(options: {
    testid: string;
    icon: SVGSVGElement;
    danger?: boolean;
  }): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'as-control-button';
    button.dataset.testid = options.testid;
    if (options.danger) {
      button.dataset.danger = 'true';
    }
    button.appendChild(options.icon);
    return button;
  }

  function createSettingsToggle(options: {
    id: string;
    testid: string;
    label: string;
    showHelp?: boolean;
  }): {
    wrapper: HTMLLabelElement;
    checkbox: HTMLInputElement;
    custom: HTMLLabelElement;
    label: HTMLSpanElement;
    help?: HTMLSpanElement;
  } {
    const toggle = document.createElement('label');
    toggle.className = 'as-settings-toggle';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = options.id;
    checkbox.dataset.testid = options.testid;
    const custom = document.createElement('label');
    custom.className = 'as-custom-checkbox';
    custom.setAttribute('for', checkbox.id);
    const label = document.createElement('span');
    label.className = 'as-toggle-label';
    label.textContent = options.label;
    let help: HTMLSpanElement | undefined;
    if (options.showHelp) {
      help = document.createElement('span');
      help.className = 'as-help-icon';
      help.appendChild(createIconHelp({ size: 20 }));
      label.appendChild(help);
    }
    toggle.appendChild(checkbox);
    toggle.appendChild(custom);
    toggle.appendChild(label);
    return { wrapper: toggle, checkbox, custom, label, help };
  }

  const toolbar = document.createElement('div');
  toolbar.className = 'as-toolbar';
  toolbar.dataset.agentSnap = 'true';
  toolbar.dataset.testid = 'toolbar';

  const toolbarContainer = document.createElement('div');
  toolbarContainer.className = 'as-toolbar-container as-collapsed';
  toolbarContainer.dataset.testid = 'toolbar-container';
  toolbar.appendChild(toolbarContainer);

  const toggleContent = document.createElement('div');
  toggleContent.className = 'as-toggle-content as-visible';
  toggleContent.dataset.testid = 'toolbar-toggle';
  const toggleIconWrap = document.createElement('button');
  toggleIconWrap.type = 'button';
  toggleIconWrap.className = 'as-toggle-icon';
  toggleIconWrap.appendChild(createIconListSparkle({ size: 24 }));
  toggleContent.appendChild(toggleIconWrap);

  const controlsContent = document.createElement('div');
  controlsContent.className = 'as-controls-content as-hidden';

  const badge = document.createElement('span');
  badge.className = 'as-badge';
  controlsContent.appendChild(badge);

  const controlsInner = document.createElement('div');
  controlsInner.className = 'as-controls-inner';

  const pauseButton = createControlButton({
    testid: 'toolbar-pause-button',
    icon: createIconPausePlayAnimated({ size: 24 }),
  });
  const copyButton = createControlButton({
    testid: 'toolbar-copy-button',
    icon: createIconCopyAnimated({ size: 24, copied: false }),
  });
  const clearButton = createControlButton({
    testid: 'toolbar-clear-button',
    danger: true,
    icon: createIconTrash({ size: 24 }),
  });
  const settingsButton = createControlButton({
    testid: 'toolbar-settings-button',
    icon: createIconGear({ size: 24 }),
  });

  controlsInner.appendChild(pauseButton);
  controlsInner.appendChild(copyButton);
  controlsInner.appendChild(clearButton);
  controlsInner.appendChild(settingsButton);

  controlsContent.appendChild(toggleContent);
  controlsContent.appendChild(controlsInner);
  toolbarContainer.appendChild(controlsContent);

  const settingsPanel = document.createElement('div');
  settingsPanel.className = 'as-settings-panel';
  settingsPanel.dataset.agentSnap = 'true';
  settingsPanel.dataset.testid = 'settings-panel';
  toolbarContainer.appendChild(settingsPanel);

  const settingsHeader = document.createElement('div');
  settingsHeader.className = 'as-settings-header';
  const settingsBrand = document.createElement('span');
  settingsBrand.className = 'as-settings-brand';
  const settingsBrandSlash = document.createElement('span');
  settingsBrandSlash.className = 'as-settings-brand-slash';
  settingsBrandSlash.textContent = '/';
  settingsBrand.appendChild(settingsBrandSlash);
  settingsBrand.appendChild(document.createTextNode(` ${t('settings.brandName')}`));
  const settingsVersion = document.createElement('span');
  settingsVersion.className = 'as-settings-version';
  settingsVersion.textContent = `${t('settings.versionLabel')} ${packageInfo.version}`;
  const themeToggle = document.createElement('button');
  themeToggle.className = 'as-theme-toggle';
  themeToggle.type = 'button';
  themeToggle.dataset.testid = 'settings-theme-toggle';
  themeToggle.appendChild(createIconSun({ size: 14 }));
  settingsHeader.appendChild(settingsBrand);
  settingsHeader.appendChild(settingsVersion);
  settingsHeader.appendChild(themeToggle);
  settingsPanel.appendChild(settingsHeader);

  const outputSection = document.createElement('div');
  outputSection.className = 'as-settings-section';
  const outputRow = document.createElement('div');
  outputRow.className = 'as-settings-row';
  const outputLabel = document.createElement('div');
  outputLabel.className = 'as-settings-label';
  outputLabel.textContent = t('settings.outputDetail');
  const outputHelp = document.createElement('span');
  outputHelp.className = 'as-help-icon';
  outputHelp.appendChild(createIconHelp({ size: 20 }));
  outputLabel.appendChild(outputHelp);
  const outputCycle = document.createElement('button');
  outputCycle.className = 'as-cycle-button';
  outputCycle.type = 'button';
  outputCycle.dataset.testid = 'settings-output-cycle';
  const outputCycleText = document.createElement('span');
  outputCycleText.className = 'as-cycle-button-text';
  outputCycle.appendChild(outputCycleText);
  const outputCycleDots = document.createElement('span');
  outputCycleDots.className = 'as-cycle-dots';
  outputCycle.appendChild(outputCycleDots);
  outputRow.appendChild(outputLabel);
  outputRow.appendChild(outputCycle);
  outputSection.appendChild(outputRow);
  settingsPanel.appendChild(outputSection);

  const colorSection = document.createElement('div');
  colorSection.className = 'as-settings-section';
  const colorLabel = document.createElement('div');
  colorLabel.className = 'as-settings-label as-settings-label-marker';
  colorLabel.textContent = t('settings.markerColour');
  const colorOptions = document.createElement('div');
  colorOptions.className = 'as-color-options';
  colorSection.appendChild(colorLabel);
  colorSection.appendChild(colorOptions);
  settingsPanel.appendChild(colorSection);

  const togglesSection = document.createElement('div');
  togglesSection.className = 'as-settings-section';
  settingsPanel.appendChild(togglesSection);

  const clearToggle = createSettingsToggle({
    id: 'as-auto-clear',
    testid: 'settings-auto-clear',
    label: t('settings.clearAfterOutput'),
    showHelp: true,
  });
  const blockToggle = createSettingsToggle({
    id: 'as-block-interactions',
    testid: 'settings-block-interactions',
    label: t('settings.blockInteractions'),
  });
  const screenshotToggle = createSettingsToggle({
    id: 'as-capture-screenshots',
    testid: 'settings-capture-screenshots',
    label: t('settings.captureScreenshots'),
  });

  const clearCheckbox = clearToggle.checkbox;
  const clearCustom = clearToggle.custom;
  const clearHelp = clearToggle.help;
  const blockCheckbox = blockToggle.checkbox;
  const blockCustom = blockToggle.custom;
  const screenshotCheckbox = screenshotToggle.checkbox;
  const screenshotCustom = screenshotToggle.custom;

  togglesSection.appendChild(clearToggle.wrapper);
  togglesSection.appendChild(blockToggle.wrapper);
  togglesSection.appendChild(screenshotToggle.wrapper);

  const markersLayer = document.createElement('div');
  markersLayer.className = 'as-markers-layer';
  markersLayer.dataset.agentSnap = 'true';
  markersLayer.dataset.testid = 'markers-layer';
  const fixedMarkersLayer = document.createElement('div');
  fixedMarkersLayer.className = 'as-fixed-markers-layer';
  fixedMarkersLayer.dataset.agentSnap = 'true';
  fixedMarkersLayer.dataset.testid = 'fixed-markers-layer';

  const {
    overlay,
    hoverHighlight,
    hoverTooltip,
    markerOutline,
    editOutline,
    pendingOutline,
    pendingMarker,
    dragRect,
    highlightsContainer,
  } = createOverlayElements();
  overlay.dataset.agentSnap = 'true';
  overlay.dataset.testid = 'overlay';
  dragRect.dataset.testid = 'drag-selection';
  pendingMarker.appendChild(createIconPlus({ size: 12 }));

  root.appendChild(toolbar);
  root.appendChild(markersLayer);
  root.appendChild(fixedMarkersLayer);
  root.appendChild(overlay);

  let annotations: Annotation[] = [];
  let pendingPopup: ReturnType<typeof createAnnotationPopup> | null = null;
  let editPopup: ReturnType<typeof createAnnotationPopup> | null = null;

  function setAccentColor(color: string): void {
    root.style.setProperty('--as-accent', color);
    settingsBrandSlash.style.color = color;
  }

  function setTheme(mode: 'dark' | 'light'): void {
    isDarkMode = mode === 'dark';
    toolbarContainer.classList.toggle('as-light', !isDarkMode);
    settingsPanel.classList.toggle('as-light', !isDarkMode);
    pauseButton.classList.toggle('as-light', !isDarkMode);
    copyButton.classList.toggle('as-light', !isDarkMode);
    clearButton.classList.toggle('as-light', !isDarkMode);
    settingsButton.classList.toggle('as-light', !isDarkMode);
    const toggleColor = isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.7)';
    toggleContent.style.color = toggleColor;
    while (themeToggle.firstChild) {
      themeToggle.removeChild(themeToggle.firstChild);
    }
    themeToggle.appendChild(
      isDarkMode ? createIconSun({ size: 14 }) : createIconMoon({ size: 14 }),
    );
  }

  function updateOutputDetailUI(): void {
    const activeOption = OUTPUT_DETAIL_OPTIONS.find(function findOption(option) {
      return option.value === settings.outputDetail;
    });
    outputCycleText.textContent = activeOption ? activeOption.label : '';
    outputCycleDots.innerHTML = '';
    OUTPUT_DETAIL_OPTIONS.forEach(function addDot(option) {
      const dot = document.createElement('span');
      dot.className = 'as-cycle-dot';
      if (option.value === settings.outputDetail) {
        dot.classList.add('as-active');
      }
      outputCycleDots.appendChild(dot);
    });
  }

  function updateColorOptionsUI(): void {
    colorOptions.innerHTML = '';
    COLOR_OPTIONS.forEach(function addColorOption(option, index) {
      const ring = document.createElement('div');
      ring.className = 'as-color-option-ring';
      ring.dataset.testid = `settings-color-option-${index}`;
      if (settings.annotationColor === option.value) {
        ring.style.borderColor = option.value;
      }
      const dot = document.createElement('div');
      dot.className = 'as-color-option';
      dot.style.backgroundColor = option.value;
      ring.appendChild(dot);
      ring.title = option.label;
      ring.addEventListener('click', function handleColorClick() {
        setSettings({ annotationColor: option.value });
      });
      colorOptions.appendChild(ring);
    });
  }

  function updateToggleUI(): void {
    clearCheckbox.checked = settings.autoClearAfterCopy;
    clearCustom.classList.toggle('as-checked', settings.autoClearAfterCopy);
    clearCustom.innerHTML = '';
    if (settings.autoClearAfterCopy) {
      clearCustom.appendChild(
        lastToggleState.autoClearAfterCopy
          ? createIconCheckSmall({ size: 14 })
          : createIconCheckSmallAnimated({ size: 14 }),
      );
    }
    blockCheckbox.checked = settings.blockInteractions;
    blockCustom.classList.toggle('as-checked', settings.blockInteractions);
    blockCustom.innerHTML = '';
    if (settings.blockInteractions) {
      blockCustom.appendChild(
        lastToggleState.blockInteractions
          ? createIconCheckSmall({ size: 14 })
          : createIconCheckSmallAnimated({ size: 14 }),
      );
    }
    screenshotCheckbox.checked = settings.captureScreenshots;
    screenshotCustom.classList.toggle('as-checked', settings.captureScreenshots);
    screenshotCustom.innerHTML = '';
    if (settings.captureScreenshots) {
      screenshotCustom.appendChild(
        lastToggleState.captureScreenshots
          ? createIconCheckSmall({ size: 14 })
          : createIconCheckSmallAnimated({ size: 14 }),
      );
    }
    lastToggleState = {
      autoClearAfterCopy: settings.autoClearAfterCopy,
      blockInteractions: settings.blockInteractions,
      captureScreenshots: settings.captureScreenshots,
    };
  }

  function updateSettingsUI(): void {
    updateOutputDetailUI();
    updateColorOptionsUI();
    updateToggleUI();
  }

  function updateToolbarUI(): void {
    badge.textContent = String(annotations.length);
    badge.style.display = annotations.length > 0 ? 'inline-flex' : 'none';
    badge.style.backgroundColor = settings.annotationColor;

    if (isActive) {
      toolbarContainer.classList.remove('as-collapsed');
      toolbarContainer.classList.add('as-expanded');
      toggleContent.classList.add('as-visible');
      toggleContent.classList.remove('as-hidden');
      controlsContent.classList.remove('as-hidden');
      controlsContent.classList.add('as-visible');
    } else {
      toolbarContainer.classList.add('as-collapsed');
      toolbarContainer.classList.remove('as-expanded');
      toggleContent.classList.add('as-visible');
      toggleContent.classList.remove('as-hidden');
      controlsContent.classList.add('as-hidden');
      controlsContent.classList.remove('as-visible');
    }

    toolbarContainer.classList.toggle('as-entrance', showEntranceAnimation);

    copyButton.disabled = annotations.length === 0;
    clearButton.disabled = annotations.length === 0;

    toggleIconWrap.replaceChildren(
      isActive ? createIconXmarkLarge({ size: 24 }) : createIconListSparkle({ size: 24 }),
    );

    pauseButton.dataset.active = isFrozen ? 'true' : 'false';
    copyButton.dataset.active = copied ? 'true' : 'false';

    pauseButton.replaceChildren(createIconPausePlayAnimated({ size: 24, isPaused: isFrozen }));
    copyButton.replaceChildren(createIconCopyAnimated({ size: 24, copied: copied }));
  }

  function updateSettingsPanelVisibility(): void {
    settingsButton.dataset.active = showSettings ? 'true' : 'false';

    const rect = toolbarContainer.getBoundingClientRect();
    const panelWidth = 280;
    const spaceLeft = rect.left;

    settingsPanel.style.top = '';
    settingsPanel.style.bottom = '';
    settingsPanel.style.left = '';
    settingsPanel.style.right = '';

    const placeLeft = spaceLeft > panelWidth;
    if (placeLeft) {
      settingsPanel.style.right = 'calc(100% + 12px)';
    } else {
      settingsPanel.style.left = 'calc(100% + 12px)';
    }

    const isMenuUp = toolbarContainer.dataset.menu === 'up';
    if (isMenuUp) {
      settingsPanel.style.bottom = '0';
      settingsPanel.style.top = 'auto';
      settingsPanel.style.transformOrigin = placeLeft ? 'bottom right' : 'bottom left';
    } else {
      settingsPanel.style.top = '0';
      settingsPanel.style.bottom = 'auto';
      settingsPanel.style.transformOrigin = placeLeft ? 'top right' : 'top left';
    }

    if (showSettings) {
      showSettingsVisible = true;
      settingsPanel.style.display = 'block';
      settingsPanel.classList.remove('as-exit');
      settingsPanel.classList.add('as-enter');
    } else if (showSettingsVisible) {
      settingsPanel.classList.remove('as-enter');
      settingsPanel.classList.add('as-exit');
      setTimeout(function hidePanel() {
        if (!showSettings) {
          settingsPanel.style.display = 'none';
          showSettingsVisible = false;
        }
      }, 120);
    }
  }

  function updateToolbarPosition(): void {
    if (toolbarPosition) {
      const padding = 20;
      const containerRect = toolbarContainer.getBoundingClientRect();
      const containerWidth = containerRect.width || 257;
      const containerHeight = containerRect.height || 44;
      let newX = toolbarPosition.x;
      let newY = toolbarPosition.y;

      newX = Math.max(padding, Math.min(window.innerWidth - containerWidth - padding, newX));
      newY = Math.max(padding, Math.min(window.innerHeight - containerHeight - padding, newY));

      toolbarPosition = { x: newX, y: newY };
      toolbar.style.left = `${newX}px`;
      toolbar.style.top = `${newY}px`;
      toolbar.style.right = 'auto';
      toolbar.style.bottom = 'auto';
    }
    updateSettingsPanelVisibility();
    updateToolbarMenuDirection();
  }

  function updateToolbarMenuDirection(): void {
    const rect = toolbarContainer.getBoundingClientRect();
    const toolbarHeight = rect.height || 44;
    const menuGap = 8;
    const menuPadding = 8;
    const itemCount = controlsInner.children.length;
    const estimatedItemsHeight =
      itemCount * 34 + Math.max(0, itemCount - 1) * menuGap + menuPadding * 2;
    const estimatedHeight = toolbarHeight + estimatedItemsHeight;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldOpenUp = spaceBelow < estimatedHeight + 16 && spaceAbove > spaceBelow;
    toolbarContainer.dataset.menu = shouldOpenUp ? 'up' : 'down';
    toolbarContainer.style.setProperty('--as-toolbar-menu-size', `${estimatedHeight}px`);
    toolbarContainer.style.setProperty('--as-toolbar-menu-items-max', `${estimatedItemsHeight}px`);
    toolbarContainer.style.setProperty('--as-toolbar-menu-cap', '0px');
  }

  function updateMarkerVisibility(): void {
    const shouldShow = isActive;
    if (shouldShow) {
      markersExiting = false;
      markersVisible = true;
      setTimeout(function markAnimated() {
        annotations.forEach(function markAnimatedAnnotation(annotation) {
          animatedMarkers.add(annotation.id);
        });
      }, 350);
      renderMarkers();
      return;
    }

    if (markersVisible) {
      markersExiting = true;
      renderMarkers();
      setTimeout(function hideMarkers() {
        markersVisible = false;
        markersExiting = false;
        markersLayer.innerHTML = '';
        fixedMarkersLayer.innerHTML = '';
        markerElements.clear();
        fixedMarkerElements.clear();
      }, 250);
    }
  }

  function setHoverMarker(id: string | null): void {
    hoveredMarkerId = id;
    updateMarkerHoverUI();
    updateMarkerOutline();
  }

  function updateMarkerHoverUI(): void {
    applyMarkerHoverUI({
      annotations: annotations,
      markersExiting: markersExiting,
      hoveredMarkerId: hoveredMarkerId,
      deletingMarkerId: deletingMarkerId,
      editingAnnotation: editingAnnotation,
      isDarkMode: isDarkMode,
      markerElements: markerElements,
      fixedMarkerElements: fixedMarkerElements,
      getTooltipPosition: getTooltipPosition,
      applyInlineStyles: applyInlineStyles,
      createIconCopyAnimated: createIconCopyAnimated,
      createIconXmark: createIconXmark,
      createIconClose: createIconClose,
    });
  }

  function updateMarkerOutline(): void {
    applyMarkerOutline({
      editingAnnotation: editingAnnotation,
      hoveredMarkerId: hoveredMarkerId,
      pendingAnnotation: pendingAnnotation,
      isDragging: isDragging,
      annotations: annotations,
      markerOutline: markerOutline,
      scrollY: scrollY,
      accentColor: settings.annotationColor,
    });
  }

  function renderMarkers(): void {
    applyRenderMarkers({
      annotations: annotations,
      markersVisible: markersVisible,
      markersExiting: markersExiting,
      getMarkersExiting: function getMarkersExiting() {
        return markersExiting;
      },
      exitingMarkers: exitingMarkers,
      animatedMarkers: animatedMarkers,
      isClearing: isClearing,
      renumberFrom: renumberFrom,
      recentlyAddedId: recentlyAddedId,
      getRecentlyAddedId: function getRecentlyAddedId() {
        return recentlyAddedId;
      },
      markerElements: markerElements,
      fixedMarkerElements: fixedMarkerElements,
      markersLayer: markersLayer,
      fixedMarkersLayer: fixedMarkersLayer,
      onHoverMarker: setHoverMarker,
      onCopyAnnotation: copySingleAnnotation,
      onDeleteAnnotation: deleteAnnotation,
      onEditAnnotation: startEditAnnotation,
      getTooltipPosition: getTooltipPosition,
      applyInlineStyles: applyInlineStyles,
      createIconCopyAnimated: createIconCopyAnimated,
      createIconXmark: createIconXmark,
      createIconClose: createIconClose,
      accentColor: settings.annotationColor,
      isDarkMode: isDarkMode,
      hoveredMarkerId: hoveredMarkerId,
      deletingMarkerId: deletingMarkerId,
      editingAnnotation: editingAnnotation,
    });
  }

  function updateHoverOverlay(): void {
    applyHoverOverlay({
      hoverInfo: hoverInfo,
      hoverPosition: hoverPosition,
      isActive: isActive,
      pendingAnnotation: pendingAnnotation,
      isScrolling: isScrolling,
      isDragging: isDragging,
      accentColor: settings.annotationColor,
      hoverHighlight: hoverHighlight,
      hoverTooltip: hoverTooltip,
    });
  }

  function updatePendingUI(): void {
    applyPendingUI({
      pendingAnnotation: pendingAnnotation,
      scrollY: scrollY,
      accentColor: settings.annotationColor,
      pendingExiting: pendingExiting,
      pendingOutline: pendingOutline,
      pendingMarker: pendingMarker,
    });
  }

  function queuePendingScreenshot(): void {
    if (!pendingAnnotation?.boundingBox) return;
    if (!settings.captureScreenshots) return;
    const pendingRef = pendingAnnotation;
    const screenshotPromise = captureAnnotationScreenshot(pendingAnnotation.boundingBox);
    pendingAnnotation.screenshotPromise = screenshotPromise;
    screenshotPromise.then(function applyScreenshot(value) {
      if (!value) return;
      pendingRef.screenshot = value;
    });
  }

  function createPendingPopup(): void {
    if (!pendingAnnotation) return;
    if (pendingPopup) {
      pendingPopup.destroy();
      pendingPopup = null;
    }

    pendingPopup = createAnnotationPopup({
      element: pendingAnnotation.element,
      selectedText: pendingAnnotation.selectedText,
      placeholder:
        pendingAnnotation.element === AREA_SELECTION_LABEL
          ? t('popup.placeholderArea')
          : pendingAnnotation.isMultiSelect
            ? t('popup.placeholderGroup')
            : t('popup.placeholder'),
      onSubmit: addAnnotation,
      onCancel: cancelAnnotation,
      accentColor: pendingAnnotation.isMultiSelect ? '#34C759' : settings.annotationColor,
      lightMode: !isDarkMode,
      style: {
        left: `${Math.max(
          160,
          Math.min(window.innerWidth - 160, (pendingAnnotation.x / 100) * window.innerWidth),
        )}px`,
        top: `${Math.max(
          20,
          Math.min(pendingAnnotation.clientY + 20, window.innerHeight - 180),
        )}px`,
      },
    });
    overlay.appendChild(pendingPopup.root);
  }

  function createEditPopup(): void {
    if (!editingAnnotation) return;
    if (editPopup) {
      editPopup.destroy();
      editPopup = null;
    }

    editPopup = createAnnotationPopup({
      element: editingAnnotation.element,
      selectedText: editingAnnotation.selectedText,
      placeholder: t('popup.placeholderEdit'),
      initialValue: editingAnnotation.comment,
      submitLabel: t('popup.submitSave'),
      onSubmit: updateAnnotation,
      onCancel: cancelEditAnnotation,
      accentColor: editingAnnotation.isMultiSelect ? '#34C759' : settings.annotationColor,
      lightMode: !isDarkMode,
      style: {
        left: `${Math.max(
          160,
          Math.min(window.innerWidth - 160, (editingAnnotation.x / 100) * window.innerWidth),
        )}px`,
        top: `${Math.max(
          20,
          Math.min(
            (editingAnnotation.isFixed ? editingAnnotation.y : editingAnnotation.y - scrollY) + 20,
            window.innerHeight - 180,
          ),
        )}px`,
      },
    });
    overlay.appendChild(editPopup.root);
  }

  function updateEditOutline(): void {
    applyEditOutline({
      editingAnnotation: editingAnnotation,
      scrollY: scrollY,
      accentColor: settings.annotationColor,
      editOutline: editOutline,
    });
  }

  function updateDragUI(): void {
    applyDragUI({
      isDragging: isDragging,
      dragRect: dragRect,
      highlightsContainer: highlightsContainer,
    });
  }

  function setSettings(next: Partial<AgentSnapSettings>): void {
    settings = { ...settings, ...next };
    setAccentColor(settings.annotationColor);
    updateSettingsUI();
    updateToolbarUI();
    if (typeof window !== 'undefined') {
      safeSetLocalStorage(SETTINGS_KEY, JSON.stringify(settings));
    }
  }

  function setActive(next: boolean): void {
    isActive = next;
    if (!isActive) {
      pendingAnnotation = null;
      editingAnnotation = null;
      hoverInfo = null;
      lastHoverUpdate = -Infinity;
      lastHoverElement = null;
      showSettings = false;
      updateSettingsPanelVisibility();
      if (isFrozen) unfreezeAnimations();
      pendingPopup?.destroy();
      pendingPopup = null;
      editPopup?.destroy();
      editPopup = null;
      markerOutline.style.display = 'none';
      editOutline.style.display = 'none';
      pendingOutline.style.display = 'none';
      pendingMarker.style.display = 'none';
      overlay.style.display = 'none';
    }
    if (isActive) {
      overlay.style.display = 'block';
    }
    updateToolbarUI();
    updateToolbarPosition();
    updateMarkerVisibility();
    updateHoverOverlay();
    updateCursorStyles();
  }

  function freezeAnimations(): void {
    if (isFrozen) return;
    const style = document.createElement('style');
    style.id = 'agent-snap-freeze-styles';
    style.textContent =
      '*:not([data-agent-snap]):not([data-agent-snap] *),*:not([data-agent-snap]):not([data-agent-snap] *)::before,*:not([data-agent-snap]):not([data-agent-snap] *)::after{animation-play-state: paused !important;transition: none !important;}';
    document.head.appendChild(style);
    document.querySelectorAll('video').forEach(function pauseVideo(video) {
      if (!video.paused) {
        video.dataset.wasPaused = 'false';
        video.pause();
      }
    });
    isFrozen = true;
    updateToolbarUI();
  }

  function unfreezeAnimations(): void {
    if (!isFrozen) return;
    const style = document.getElementById('agent-snap-freeze-styles');
    if (style) style.remove();
    document.querySelectorAll('video').forEach(function resumeVideo(video) {
      if (video.dataset.wasPaused === 'false') {
        video.play();
        delete video.dataset.wasPaused;
      }
    });
    isFrozen = false;
    updateToolbarUI();
  }

  function toggleFreeze(): void {
    if (isFrozen) {
      unfreezeAnimations();
    } else {
      freezeAnimations();
    }
  }

  function addAnnotation(comment: string): void {
    if (!pendingAnnotation) return;
    const allowScreenshots = settings.captureScreenshots;
    const screenshotPromise = allowScreenshots ? pendingAnnotation.screenshotPromise : undefined;
    const newAnnotation: Annotation = {
      id: createAnnotationId(),
      x: pendingAnnotation.x,
      y: pendingAnnotation.y,
      comment: comment,
      element: pendingAnnotation.element,
      elementPath: pendingAnnotation.elementPath,
      timestamp: Date.now(),
      selectedText: pendingAnnotation.selectedText,
      boundingBox: pendingAnnotation.boundingBox,
      screenshot: allowScreenshots ? pendingAnnotation.screenshot : undefined,
      nearbyText: pendingAnnotation.nearbyText,
      cssClasses: pendingAnnotation.cssClasses,
      isMultiSelect: pendingAnnotation.isMultiSelect,
      isFixed: pendingAnnotation.isFixed,
      fullPath: pendingAnnotation.fullPath,
      accessibility: pendingAnnotation.accessibility,
      computedStyles: pendingAnnotation.computedStyles,
      nearbyElements: pendingAnnotation.nearbyElements,
    };

    annotations = annotations.concat(newAnnotation);
    recentlyAddedId = newAnnotation.id;
    setTimeout(function clearRecent() {
      recentlyAddedId = null;
    }, 300);
    setTimeout(function markAnimated() {
      animatedMarkers.add(newAnnotation.id);
    }, 250);

    pendingExiting = true;
    updatePendingUI();
    if (pendingPopup) {
      pendingPopup.exit(function removePending() {
        pendingPopup?.destroy();
        pendingPopup = null;
      });
    }
    setTimeout(function clearPending() {
      pendingAnnotation = null;
      pendingExiting = false;
      updatePendingUI();
      updateHoverOverlay();
    }, 150);

    window.getSelection()?.removeAllRanges();
    saveAnnotations(pathname, annotations, options.storageAdapter);
    if (options.onAnnotationAdd) {
      options.onAnnotationAdd(newAnnotation);
    }
    updateToolbarUI();
    renderMarkers();

    if (screenshotPromise && !newAnnotation.screenshot) {
      screenshotPromise.then(function updateScreenshot(value) {
        if (!value) return;
        let updated: Annotation | null = null;
        annotations = annotations.map(function mapAnnotation(item) {
          if (item.id === newAnnotation.id) {
            updated = { ...item, screenshot: value };
            return updated;
          }
          return item;
        });
        if (updated) {
          saveAnnotations(pathname, annotations, options.storageAdapter);
          if (options.onAnnotationUpdate) {
            options.onAnnotationUpdate(updated);
          }
        }
      });
    }
  }

  function cancelAnnotation(): void {
    pendingExiting = true;
    updatePendingUI();
    if (pendingPopup) {
      pendingPopup.exit(function removePending() {
        pendingPopup?.destroy();
        pendingPopup = null;
      });
    }
    setTimeout(function clearPending() {
      pendingAnnotation = null;
      pendingExiting = false;
      updatePendingUI();
      updateHoverOverlay();
    }, 150);
  }

  function deleteAnnotation(id: string): void {
    const deletedIndex = annotations.findIndex(function findIndex(item) {
      return item.id === id;
    });
    const deletedAnnotation = deletedIndex >= 0 ? annotations[deletedIndex] : null;
    deletingMarkerId = id;
    exitingMarkers.add(id);
    const marker = markerElements.get(id) || fixedMarkerElements.get(id);
    if (marker) {
      marker.classList.add('as-exit');
      marker.classList.add('as-hovered');
      marker.classList.remove('as-actions-visible');
      marker.innerHTML = '';
      marker.appendChild(createIconXmark({ size: 12 }));
    }
    setTimeout(function removeAnnotation() {
      annotations = annotations.filter(function filterAnnotation(item) {
        return item.id !== id;
      });
      exitingMarkers.delete(id);
      deletingMarkerId = null;
      saveAnnotations(pathname, annotations, options.storageAdapter);
      if (deletedAnnotation && options.onAnnotationDelete) {
        options.onAnnotationDelete(deletedAnnotation);
      }
      renderMarkers();
      updateToolbarUI();
      if (deletedIndex < annotations.length) {
        renumberFrom = deletedIndex;
        setTimeout(function clearRenumber() {
          renumberFrom = null;
          renderMarkers();
        }, 200);
      }
    }, 150);
  }

  function startEditAnnotation(annotation: Annotation): void {
    editingAnnotation = annotation;
    setHoverMarker(null);
    createEditPopup();
    updateEditOutline();
  }

  function updateAnnotation(newComment: string): void {
    if (!editingAnnotation) return;
    let updatedAnnotation: Annotation | null = null;
    annotations = annotations.map(function mapAnnotation(item) {
      if (item.id === editingAnnotation?.id) {
        updatedAnnotation = { ...item, comment: newComment };
        return updatedAnnotation;
      }
      return item;
    });
    saveAnnotations(pathname, annotations, options.storageAdapter);
    if (updatedAnnotation && options.onAnnotationUpdate) {
      options.onAnnotationUpdate(updatedAnnotation);
    }
    if (editPopup) {
      editPopup.exit(function removeEdit() {
        editPopup?.destroy();
        editPopup = null;
      });
    }
    setTimeout(function clearEdit() {
      editingAnnotation = null;
      editOutline.style.display = 'none';
      renderMarkers();
    }, 150);
  }

  function cancelEditAnnotation(): void {
    if (editPopup) {
      editPopup.exit(function removeEdit() {
        editPopup?.destroy();
        editPopup = null;
      });
    }
    setTimeout(function clearEdit() {
      editingAnnotation = null;
      editOutline.style.display = 'none';
    }, 150);
  }

  function clearAll(): void {
    const count = annotations.length;
    if (count === 0) return;
    const clearedAnnotations = annotations.slice();
    isClearing = true;
    renderMarkers();
    const totalAnimationTime = count * 30 + 200;
    setTimeout(function finalizeClear() {
      annotations = [];
      animatedMarkers.clear();
      clearAnnotations(pathname, options.storageAdapter);
      isClearing = false;
      renderMarkers();
      updateToolbarUI();
      if (options.onAnnotationsClear) {
        options.onAnnotationsClear(clearedAnnotations);
      }
    }, totalAnimationTime);
  }

  async function copyOutput(): Promise<string> {
    const output = generateOutput(annotations, pathname, settings.outputDetail);
    if (!output) return '';

    try {
      if (shouldCopyToClipboard && navigator.clipboard) {
        await navigator.clipboard.writeText(output);
      }
    } catch {
      // Ignore clipboard errors
    }

    if (options.onCopy) {
      await options.onCopy(output);
    }

    copied = true;
    updateToolbarUI();
    setTimeout(function clearCopied() {
      copied = false;
      updateToolbarUI();
    }, 2000);

    if (settings.autoClearAfterCopy) {
      setTimeout(function autoClear() {
        clearAll();
      }, 500);
    }

    return output;
  }

  function flashCopiedMarker(id: string): void {
    const marker = markerElements.get(id) || fixedMarkerElements.get(id);
    if (!marker) return;
    const copyButton = marker.querySelector(
      '.as-marker-action[data-action="copy"]',
    ) as HTMLButtonElement | null;
    let copyIconSize = 12;
    if (copyButton && copyButton.dataset.copySize) {
      const parsed = Number(copyButton.dataset.copySize);
      if (!Number.isNaN(parsed)) {
        copyIconSize = parsed;
      }
      copyButton.replaceChildren(createIconCheckSmallAnimated({ size: copyIconSize }));
    }
    marker.classList.add('as-copied');
    setTimeout(function clearCopiedMarker() {
      marker.classList.remove('as-copied');
      if (copyButton) {
        copyButton.replaceChildren(createIconCopyAnimated({ size: copyIconSize }));
      }
    }, 1200);
  }

  async function copySingleAnnotation(annotation: Annotation): Promise<string> {
    const output = generateOutput([annotation], pathname, settings.outputDetail);
    if (!output) return '';

    try {
      if (shouldCopyToClipboard && navigator.clipboard) {
        await navigator.clipboard.writeText(output);
      }
    } catch {
      // Ignore clipboard errors
    }

    if (options.onCopy) {
      await options.onCopy(output);
    }

    copied = true;
    updateToolbarUI();
    setTimeout(function clearCopied() {
      copied = false;
      updateToolbarUI();
    }, 2000);

    flashCopiedMarker(annotation.id);

    return output;
  }

  function updateCursorStyles(): void {
    const existingStyle = document.getElementById('agent-snap-cursor-styles');
    if (existingStyle) existingStyle.remove();
    if (!isActive) return;
    const style = document.createElement('style');
    style.id = 'agent-snap-cursor-styles';
    style.textContent =
      'body *{cursor:crosshair !important;}body p,body span,body h1,body h2,body h3,body h4,body h5,body h6,body li,body td,body th,body label,body blockquote,body figcaption,body caption,body legend,body dt,body dd,body pre,body code,body em,body strong,body b,body i,body u,body s,body a,body time,body address,body cite,body q,body abbr,body dfn,body mark,body small,body sub,body sup,body [contenteditable],body p *,body span *,body h1 *,body h2 *,body h3 *,body h4 *,body h5 *,body h6 *,body li *,body a *,body label *,body pre *,body code *,body blockquote *,body [contenteditable] *{cursor:text !important;}[data-agent-snap],[data-agent-snap] *{cursor:default !important;}[data-annotation-marker],[data-annotation-marker] *{cursor:pointer !important;}';
    document.head.appendChild(style);
  }

  function getTooltipPosition(annotation: Annotation): Partial<CSSStyleDeclaration> {
    const tooltipMaxWidth = 200;
    const tooltipEstimatedHeight = 80;
    const markerSize = 22;
    const gap = 10;
    const markerX = (annotation.x / 100) * window.innerWidth;
    const markerY = annotation.isFixed ? annotation.y : annotation.y - scrollY;
    const styles: Partial<CSSStyleDeclaration> = {};

    const spaceBelow = window.innerHeight - markerY - markerSize - gap;
    if (spaceBelow < tooltipEstimatedHeight) {
      styles.top = 'auto';
      styles.bottom = `calc(100% + ${gap}px)`;
    }

    const centerX = markerX - tooltipMaxWidth / 2;
    const edgePadding = 10;

    if (centerX < edgePadding) {
      const offset = edgePadding - centerX;
      styles.left = `calc(50% + ${offset}px)`;
    } else if (centerX + tooltipMaxWidth > window.innerWidth - edgePadding) {
      const overflow = centerX + tooltipMaxWidth - (window.innerWidth - edgePadding);
      styles.left = `calc(50% - ${overflow}px)`;
    }

    return styles;
  }

  function handleToolbarMouseDown(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('.as-control-button') || target.closest('.as-settings-panel')) {
      return;
    }
    const toolbarParent = toolbarContainer.parentElement;
    if (!toolbarParent) return;
    const rect = toolbarParent.getBoundingClientRect();
    const currentX = toolbarPosition ? toolbarPosition.x : rect.left;
    const currentY = toolbarPosition ? toolbarPosition.y : rect.top;
    const randomRotation = (Math.random() - 0.5) * 10;
    dragRotation = randomRotation;
    dragStartPos = {
      x: event.clientX,
      y: event.clientY,
      toolbarX: currentX,
      toolbarY: currentY,
    };
  }

  function handleToolbarMouseMove(event: MouseEvent): void {
    if (!dragStartPos) return;
    const deltaX = event.clientX - dragStartPos.x;
    const deltaY = event.clientY - dragStartPos.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const threshold = 5;
    if (!isDraggingToolbar && distance > threshold) {
      isDraggingToolbar = true;
      toolbarContainer.classList.add('as-dragging');
      toolbarContainer.style.transform = `scale(1.05) rotate(${dragRotation}deg)`;
      toolbarContainer.style.cursor = 'grabbing';
    }
    if (isDraggingToolbar || distance > threshold) {
      let newX = dragStartPos.toolbarX + deltaX;
      let newY = dragStartPos.toolbarY + deltaY;
      toolbarPosition = { x: newX, y: newY };
      updateToolbarPosition();
    }
  }

  function handleToolbarMouseUp(): void {
    if (isDraggingToolbar) {
      justFinishedToolbarDrag = true;
      setTimeout(function clearFlag() {
        justFinishedToolbarDrag = false;
      }, 50);
    }
    isDraggingToolbar = false;
    dragStartPos = null;
    toolbarContainer.classList.remove('as-dragging');
    toolbarContainer.style.transform = '';
    toolbarContainer.style.cursor = '';
  }

  function handleScroll(): void {
    scrollY = window.scrollY;
    isScrolling = true;
    updateMarkerOutline();
    updateEditOutline();
    updatePendingUI();
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(function stopScrolling() {
      isScrolling = false;
      updateHoverOverlay();
    }, 150);
  }

  function getEffectiveTarget(event: Event): HTMLElement | null {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (let i = 0; i < path.length; i += 1) {
      const item = path[i];
      if (item instanceof HTMLElement) {
        if (item.closest('[data-agent-snap]') || item.closest('[data-annotation-marker]')) {
          return null;
        }
      }
    }
    for (let i = 0; i < path.length; i += 1) {
      const item = path[i];
      if (item instanceof HTMLElement) {
        return item;
      }
    }

    const target = event.target;
    if (target instanceof HTMLElement) {
      if (target.closest('[data-agent-snap]') || target.closest('[data-annotation-marker]')) {
        return null;
      }
      return target;
    }

    return null;
  }

  function collectShadowRoots(): ShadowRoot[] {
    const roots: ShadowRoot[] = [];
    function collectFromNode(node: ParentNode): void {
      const elements = Array.from(node.childNodes).filter(function filterElement(child) {
        return child instanceof Element;
      }) as Element[];

      elements.forEach(function visitElement(element) {
        const host = element as HTMLElement;
        if (host.shadowRoot) {
          roots.push(host.shadowRoot);
          collectFromNode(host.shadowRoot);
        }
        collectFromNode(element);
      });
    }

    collectFromNode(document.body);
    return roots;
  }

  function setupShadowObserver(): void {
    shadowRoots = collectShadowRoots();
    if (!window.MutationObserver) return;
    if (shadowObserver) return;
    shadowObserver = new MutationObserver(function handleMutations() {
      shadowRoots = collectShadowRoots();
    });
    shadowObserver.observe(document.body, { childList: true, subtree: true });
  }

  function teardownShadowObserver(): void {
    if (shadowObserver) {
      shadowObserver.disconnect();
      shadowObserver = null;
    }
    shadowRoots = null;
  }

  function getShadowRoots(): ShadowRoot[] {
    if (!shadowRoots) shadowRoots = collectShadowRoots();
    return shadowRoots;
  }

  function elementsFromPointDeep(x: number, y: number): HTMLElement[] {
    const results = new Set<HTMLElement>();
    document.elementsFromPoint(x, y).forEach(function addRootElement(el) {
      if (el instanceof HTMLElement) results.add(el);
    });

    getShadowRoots().forEach(function addShadowRoot(root) {
      root.elementsFromPoint(x, y).forEach(function addShadowElement(el) {
        if (el instanceof HTMLElement) results.add(el);
      });
    });

    return Array.from(results);
  }

  function querySelectorAllDeep(selector: string): HTMLElement[] {
    const results: HTMLElement[] = Array.from(document.querySelectorAll(selector)).filter(
      function filterElement(el) {
        return el instanceof HTMLElement;
      },
    ) as HTMLElement[];

    getShadowRoots().forEach(function addShadowRoot(root) {
      root.querySelectorAll(selector).forEach(function addShadowElement(el) {
        if (el instanceof HTMLElement) results.push(el);
      });
    });

    return results;
  }

  function handleMouseMove(event: MouseEvent): void {
    if (!isActive || pendingAnnotation) return;
    const now = Date.now();
    const elementUnder = getEffectiveTarget(event);
    if (!elementUnder) {
      hoverInfo = null;
      lastHoverElement = null;
      updateHoverOverlay();
      return;
    }
    if (elementUnder === lastHoverElement && now - lastHoverUpdate < HOVER_UPDATE_THROTTLE) {
      return;
    }
    lastHoverUpdate = now;
    lastHoverElement = elementUnder;

    const identified = identifyElement(elementUnder);
    hoverInfo = {
      element: identified.name,
      elementPath: identified.path,
      rect: elementUnder.getBoundingClientRect(),
    };
    hoverPosition = { x: event.clientX, y: event.clientY };
    updateHoverOverlay();
  }

  function handleClick(event: MouseEvent): void {
    if (!isActive) return;
    if (justFinishedDrag) {
      justFinishedDrag = false;
      return;
    }
    const target = getEffectiveTarget(event);
    if (!target) return;

    const isInteractive = target.closest(
      'button, a, input, select, textarea, [role="button"], [onclick]',
    );

    if (settings.blockInteractions && isInteractive) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (pendingAnnotation) {
      if (isInteractive && !settings.blockInteractions) return;
      event.preventDefault();
      pendingPopup?.shake();
      return;
    }

    if (editingAnnotation) {
      if (isInteractive && !settings.blockInteractions) return;
      event.preventDefault();
      editPopup?.shake();
      return;
    }

    event.preventDefault();

    const elementUnder = target;

    const identified = identifyElement(elementUnder);
    const rect = elementUnder.getBoundingClientRect();
    const x = (event.clientX / window.innerWidth) * 100;
    const fixed = isElementFixed(elementUnder);
    const y = fixed ? event.clientY : event.clientY + window.scrollY;
    const selection = window.getSelection();
    let selectedText: string | undefined;
    if (selection && selection.toString().trim().length > 0) {
      selectedText = selection.toString().trim().slice(0, 500);
    }

    const computedStylesObj = getDetailedComputedStyles(elementUnder);
    const computedStylesStr = Object.entries(computedStylesObj)
      .map(function mapStyle([key, value]) {
        return `${key}: ${value}`;
      })
      .join('; ');

    pendingAnnotation = {
      x: x,
      y: y,
      clientY: event.clientY,
      element: identified.name,
      elementPath: identified.path,
      selectedText: selectedText,
      boundingBox: {
        x: rect.left,
        y: fixed ? rect.top : rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      },
      nearbyText: getNearbyText(elementUnder),
      cssClasses: getElementClasses(elementUnder),
      isFixed: fixed,
      fullPath: getFullElementPath(elementUnder),
      accessibility: getAccessibilityInfo(elementUnder),
      computedStyles: computedStylesStr,
      nearbyElements: getNearbyElements(elementUnder),
    };

    queuePendingScreenshot();
    hoverInfo = null;
    updatePendingUI();
    createPendingPopup();
  }

  function handleMouseDown(event: MouseEvent): void {
    if (!isActive || pendingAnnotation) return;
    const target = getEffectiveTarget(event);
    if (!target) return;

    const textTags = new Set([
      'P',
      'SPAN',
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'H6',
      'LI',
      'TD',
      'TH',
      'LABEL',
      'BLOCKQUOTE',
      'FIGCAPTION',
      'CAPTION',
      'LEGEND',
      'DT',
      'DD',
      'PRE',
      'CODE',
      'EM',
      'STRONG',
      'B',
      'I',
      'U',
      'S',
      'A',
      'TIME',
      'ADDRESS',
      'CITE',
      'Q',
      'ABBR',
      'DFN',
      'MARK',
      'SMALL',
      'SUB',
      'SUP',
    ]);

    if (textTags.has(target.tagName) || target.isContentEditable) {
      return;
    }

    mouseDownPos = { x: event.clientX, y: event.clientY };
  }

  function handleMouseDrag(event: MouseEvent): void {
    if (!isActive || pendingAnnotation) return;
    if (!mouseDownPos) return;

    const dx = event.clientX - mouseDownPos.x;
    const dy = event.clientY - mouseDownPos.y;
    const distance = dx * dx + dy * dy;
    const thresholdSq = DRAG_THRESHOLD * DRAG_THRESHOLD;

    if (!isDragging && distance >= thresholdSq) {
      dragStart = mouseDownPos;
      isDragging = true;
      updateDragUI();
    }

    if ((isDragging || distance >= thresholdSq) && dragStart) {
      const metrics = getSelectionMetrics(dragStart.x, dragStart.y, event.clientX, event.clientY);
      const {
        left,
        top,
        width,
        height,
        isThinSelection,
        detectLeft,
        detectTop,
        detectRight,
        detectBottom,
      } = metrics;
      const selectionConfig = getSelectionConfig(metrics);
      const minElementSize = selectionConfig.minElementSize;
      const overlapThreshold = selectionConfig.overlapThreshold;
      dragRect.style.transform = `translate(${left}px, ${top}px)`;
      dragRect.style.width = `${width}px`;
      dragRect.style.height = `${height}px`;
      dragRect.classList.toggle('as-thin', isThinSelection);

      const now = Date.now();
      if (now - lastElementUpdate < ELEMENT_UPDATE_THROTTLE) return;
      lastElementUpdate = now;

      const midX = (detectLeft + detectRight) / 2;
      const midY = (detectTop + detectBottom) / 2;

      const candidateElements = new Set<HTMLElement>();
      const points = [
        [detectLeft, detectTop],
        [detectRight, detectTop],
        [detectLeft, detectBottom],
        [detectRight, detectBottom],
        [midX, midY],
        [midX, detectTop],
        [midX, detectBottom],
        [detectLeft, midY],
        [detectRight, midY],
      ];

      points.forEach(function addPoint(point) {
        const elements = elementsFromPointDeep(point[0], point[1]);
        elements.forEach(function addElement(element) {
          candidateElements.add(element);
        });
      });

      const nearbyElements = querySelectorAllDeep(
        'button, a, input, img, p, h1, h2, h3, h4, h5, h6, li, label, td, th, div, span, section, article, aside, nav',
      );

      nearbyElements.forEach(function addNearby(element) {
        if (!(element instanceof HTMLElement)) return;
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const centerInside =
          centerX >= detectLeft && centerX <= detectRight && centerY >= detectTop &&
          centerY <= detectBottom;
        const overlapX = Math.min(rect.right, detectRight) - Math.max(rect.left, detectLeft);
        const overlapY = Math.min(rect.bottom, detectBottom) - Math.max(rect.top, detectTop);
        const overlapArea = overlapX > 0 && overlapY > 0 ? overlapX * overlapY : 0;
        const elementArea = rect.width * rect.height;
        const overlapRatio = elementArea > 0 ? overlapArea / elementArea : 0;
        if (centerInside || overlapRatio > overlapThreshold) {
          candidateElements.add(element);
        }
      });

      const allMatching: DOMRect[] = [];
      const meaningfulTags = new Set([
        'BUTTON',
        'A',
        'INPUT',
        'IMG',
        'P',
        'H1',
        'H2',
        'H3',
        'H4',
        'H5',
        'H6',
        'LI',
        'LABEL',
        'TD',
        'TH',
        'SECTION',
        'ARTICLE',
        'ASIDE',
        'NAV',
      ]);

      candidateElements.forEach(function addCandidate(element) {
        if (element.closest('[data-agent-snap]') || element.closest('[data-annotation-marker]')) {
          return;
        }

        const rect = element.getBoundingClientRect();
        if (rect.width > window.innerWidth * 0.8 && rect.height > window.innerHeight * 0.5) {
          return;
        }
        if (rect.width < minElementSize || rect.height < minElementSize) return;

        if (
          rect.left < detectRight && rect.right > detectLeft && rect.top < detectBottom &&
          rect.bottom > detectTop
        ) {
          const tagName = element.tagName;
          let shouldInclude = meaningfulTags.has(tagName);
          if (!shouldInclude && (tagName === 'DIV' || tagName === 'SPAN')) {
            const hasText = element.textContent ? element.textContent.trim().length > 0 : false;
            const isInteractive =
              element.onclick !== null ||
              element.getAttribute('role') === 'button' ||
              element.getAttribute('role') === 'link' ||
              element.classList.contains('clickable') ||
              element.hasAttribute('data-clickable');
            if (
              (hasText || isInteractive) &&
              !element.querySelector('p, h1, h2, h3, h4, h5, h6, button, a')
            ) {
              shouldInclude = true;
            }
          }
          if (shouldInclude) {
            let dominated = false;
            allMatching.forEach(function checkExisting(existingRect) {
              if (
                existingRect.left <= rect.left &&
                existingRect.right >= rect.right &&
                existingRect.top <= rect.top &&
                existingRect.bottom >= rect.bottom
              ) {
                dominated = true;
              }
            });
            if (!dominated) allMatching.push(rect);
          }
        }
      });

      while (highlightsContainer.children.length > allMatching.length) {
        highlightsContainer.removeChild(highlightsContainer.lastChild as Node);
      }
      allMatching.forEach(function updateHighlight(rect, index) {
        let highlight = highlightsContainer.children[index] as HTMLDivElement | null;
        if (!highlight) {
          highlight = document.createElement('div');
          highlight.className = 'as-selected-element-highlight';
          highlightsContainer.appendChild(highlight);
        }
        highlight.classList.toggle('as-thin', isThinSelection);
        highlight.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
        highlight.style.width = `${rect.width}px`;
        highlight.style.height = `${rect.height}px`;
      });
    }
  }

  function handleMouseUp(event: MouseEvent): void {
    if (!isActive) return;
    const wasDragging = isDragging;
    const dragStartPoint = dragStart;
    if (isDragging && dragStartPoint) {
      justFinishedDrag = true;
      const metrics = getSelectionMetrics(
        dragStartPoint.x,
        dragStartPoint.y,
        event.clientX,
        event.clientY,
      );
      const { left, top, width, height, detectLeft, detectTop, detectRight, detectBottom } =
        metrics;
      const selectionConfig = getSelectionConfig(metrics);
      const minElementSize = selectionConfig.minElementSize;
      const allMatching: { element: HTMLElement; rect: DOMRect }[] = [];
      const selector = 'button, a, input, img, p, h1, h2, h3, h4, h5, h6, li, label, td, th';

      querySelectorAllDeep(selector).forEach(function checkElement(el) {
        if (!(el instanceof HTMLElement)) return;
        if (el.closest('[data-agent-snap]') || el.closest('[data-annotation-marker]')) return;
        const rect = el.getBoundingClientRect();
        if (rect.width > window.innerWidth * 0.8 && rect.height > window.innerHeight * 0.5) return;
        if (rect.width < minElementSize || rect.height < minElementSize) return;
        if (
          rect.left < detectRight && rect.right > detectLeft && rect.top < detectBottom &&
          rect.bottom > detectTop
        ) {
          allMatching.push({ element: el, rect: rect });
        }
      });

      const finalElements = allMatching.filter(function filterParent(item) {
        return !allMatching.some(function checkOther(other) {
          return other !== item && item.element.contains(other.element);
        });
      });

      const x = (event.clientX / window.innerWidth) * 100;
      const y = event.clientY + window.scrollY;

      if (finalElements.length > 0) {
        const bounds = finalElements.reduce(
          function reduceBounds(acc, item) {
            return {
              left: Math.min(acc.left, item.rect.left),
              top: Math.min(acc.top, item.rect.top),
              right: Math.max(acc.right, item.rect.right),
              bottom: Math.max(acc.bottom, item.rect.bottom),
            };
          },
          {
            left: Infinity,
            top: Infinity,
            right: -Infinity,
            bottom: -Infinity,
          },
        );

        const elementNames = finalElements
          .slice(0, 5)
          .map(function mapElement(item) {
            return identifyElement(item.element).name;
          })
          .join(', ');
        const suffix =
          finalElements.length > 5
            ? t('annotation.multiSelectSuffix', {
                count: finalElements.length - 5,
              })
            : '';
        const firstElement = finalElements[0].element;
        const firstComputedStyles = getDetailedComputedStyles(firstElement);
        const firstComputedStylesStr = Object.entries(firstComputedStyles)
          .map(function mapStyle([key, value]) {
            return `${key}: ${value}`;
          })
          .join('; ');

        pendingAnnotation = {
          x: x,
          y: y,
          clientY: event.clientY,
          element: buildMultiSelectLabel(finalElements.length, elementNames, suffix),
          elementPath: MULTI_SELECT_PATH,
          boundingBox: {
            x: bounds.left,
            y: bounds.top + window.scrollY,
            width: bounds.right - bounds.left,
            height: bounds.bottom - bounds.top,
          },
          isMultiSelect: true,
          fullPath: getFullElementPath(firstElement),
          accessibility: getAccessibilityInfo(firstElement),
          computedStyles: firstComputedStylesStr,
          nearbyElements: getNearbyElements(firstElement),
          cssClasses: getElementClasses(firstElement),
          nearbyText: getNearbyText(firstElement),
        };
        queuePendingScreenshot();
        updatePendingUI();
        createPendingPopup();
      } else {
        if (width > MIN_AREA_SELECTION_SIZE && height > MIN_AREA_SELECTION_SIZE) {
          pendingAnnotation = {
            x: x,
            y: y,
            clientY: event.clientY,
            element: AREA_SELECTION_LABEL,
            elementPath: t('annotation.regionAt', {
              x: Math.round(left),
              y: Math.round(top),
            }),
            boundingBox: {
              x: left,
              y: top + window.scrollY,
              width: width,
              height: height,
            },
            isMultiSelect: true,
          };
          queuePendingScreenshot();
          updatePendingUI();
          createPendingPopup();
        }
      }
      hoverInfo = null;
    } else if (wasDragging) {
      justFinishedDrag = true;
    }

    mouseDownPos = null;
    dragStart = null;
    isDragging = false;
    updateDragUI();
    highlightsContainer.innerHTML = '';
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (pendingAnnotation) {
        return;
      }
      if (isActive) {
        setActive(false);
      }
    }
  }

  function setupSettingsPersistence(): void {
    try {
      const storedSettings = localStorage.getItem(SETTINGS_KEY);
      if (storedSettings) {
        settings = { ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) };
      }
    } catch {
      return;
    }
  }

  function safeGetStoredTheme(): string | null {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  }

  function handleSystemThemeChange(event: MediaQueryListEvent | MediaQueryList): void {
    if (!safeGetStoredTheme() && !options.initialTheme) {
      setTheme(event.matches ? 'dark' : 'light');
    }
  }

  function setupThemePreference(): void {
    const savedTheme = safeGetStoredTheme();
    if (savedTheme) {
      setTheme(savedTheme === 'dark' ? 'dark' : 'light');
      return;
    }
    if (options.initialTheme) {
      setTheme(options.initialTheme);
      return;
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setTheme(systemThemeMediaQuery.matches ? 'dark' : 'light');
      if ('addEventListener' in systemThemeMediaQuery) {
        systemThemeMediaQuery.addEventListener('change', handleSystemThemeChange);
        systemThemeListenerType = 'event';
      } else {
        const legacyMediaQuery = systemThemeMediaQuery as MediaQueryList & {
          addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
        };
        if (typeof legacyMediaQuery.addListener === 'function') {
          legacyMediaQuery.addListener(handleSystemThemeChange);
          systemThemeListenerType = 'listener';
        }
      }
      return;
    }
    setTheme('dark');
  }

  function handleToolbarClick(event: MouseEvent): void {
    if (justFinishedToolbarDrag) {
      event.preventDefault();
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest('.as-control-button')) {
      return;
    }
    if (target.closest('.as-settings-panel')) {
      return;
    }
    if (toggleContent.contains(target)) {
      setActive(!isActive);
      updateCursorStyles();
      return;
    }
    setActive(!isActive);
    updateCursorStyles();
  }

  function showHelpTooltip(target: HTMLElement, message: string): void {
    const existingTooltip = root.querySelector('.as-help-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'as-help-tooltip';
    if (!isDarkMode) tooltip.classList.add('as-light');
    tooltip.textContent = message;

    const targetRect = target.getBoundingClientRect();
    const tooltipWidth = 200;
    const tooltipLeft = Math.max(
      8,
      Math.min(
        targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        window.innerWidth - tooltipWidth - 8,
      ),
    );
    const tooltipTop = targetRect.bottom + 8;

    tooltip.style.left = `${tooltipLeft}px`;
    tooltip.style.top = `${tooltipTop}px`;
    tooltip.style.width = `${tooltipWidth}px`;

    root.appendChild(tooltip);

    const removeTooltip = () => {
      tooltip.remove();
      document.removeEventListener('click', removeTooltip);
    };

    setTimeout(removeTooltip, 3000);
    setTimeout(() => {
      document.addEventListener('click', removeTooltip);
    }, 100);
  }

  function stopRootEvent(event: Event): void {
    event.stopPropagation();
  }

  function attachListeners(): void {
    root.addEventListener('click', stopRootEvent);
    root.addEventListener('mousedown', stopRootEvent);
    root.addEventListener('touchstart', stopRootEvent);
    root.addEventListener('touchend', stopRootEvent);
    root.addEventListener('pointerdown', stopRootEvent);
    toolbarContainer.addEventListener('click', handleToolbarClick);
    toolbarContainer.addEventListener('mousedown', handleToolbarMouseDown);
    document.addEventListener('mousemove', handleToolbarMouseMove);
    document.addEventListener('mouseup', handleToolbarMouseUp);
    pauseButton.addEventListener('click', function handlePause(event) {
      event.stopPropagation();
      toggleFreeze();
    });
    copyButton.addEventListener('click', function handleCopy(event) {
      event.stopPropagation();
      copyOutput();
    });
    clearButton.addEventListener('click', function handleClear(event) {
      event.stopPropagation();
      clearAll();
    });
    settingsButton.addEventListener('click', function handleSettings(event) {
      event.stopPropagation();
      showSettings = !showSettings;
      updateSettingsPanelVisibility();
    });
    outputCycle.addEventListener('click', function handleOutputCycle() {
      const currentIndex = OUTPUT_DETAIL_OPTIONS.findIndex(function findIndex(option) {
        return option.value === settings.outputDetail;
      });
      const nextIndex = (currentIndex + 1) % OUTPUT_DETAIL_OPTIONS.length;
      setSettings({ outputDetail: OUTPUT_DETAIL_OPTIONS[nextIndex].value });
    });
    clearCheckbox.addEventListener('change', function handleClearToggle() {
      setSettings({ autoClearAfterCopy: clearCheckbox.checked });
    });
    blockCheckbox.addEventListener('change', function handleBlockToggle() {
      setSettings({ blockInteractions: blockCheckbox.checked });
    });
    screenshotCheckbox.addEventListener('change', function handleScreenshotToggle() {
      setSettings({ captureScreenshots: screenshotCheckbox.checked });
    });
    themeToggle.addEventListener('click', function handleThemeToggle() {
      setTheme(isDarkMode ? 'light' : 'dark');
      safeSetLocalStorage(THEME_KEY, isDarkMode ? 'dark' : 'light');
      updateToolbarUI();
      updateSettingsUI();
    });

    // Help icon click handlers
    outputHelp.addEventListener('click', function handleOutputHelp(event) {
      event.stopPropagation();
      showHelpTooltip(outputHelp, t('settings.help.outputDetail'));
    });

    if (clearHelp) {
      clearHelp.addEventListener('click', function handleClearHelp(event) {
        event.stopPropagation();
        showHelpTooltip(clearHelp, t('settings.help.clearAfterOutput'));
      });
    }

    settingsPanel.addEventListener('click', function stopPropagation(event) {
      event.stopPropagation();
    });

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseDrag, { passive: true });
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateToolbarPosition);
  }

  function detachListeners(): void {
    root.removeEventListener('click', stopRootEvent);
    root.removeEventListener('mousedown', stopRootEvent);
    root.removeEventListener('touchstart', stopRootEvent);
    root.removeEventListener('touchend', stopRootEvent);
    root.removeEventListener('pointerdown', stopRootEvent);
    toolbarContainer.removeEventListener('click', handleToolbarClick);
    toolbarContainer.removeEventListener('mousedown', handleToolbarMouseDown);
    document.removeEventListener('mousemove', handleToolbarMouseMove);
    document.removeEventListener('mouseup', handleToolbarMouseUp);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseDrag);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('scroll', handleScroll);
    window.removeEventListener('resize', updateToolbarPosition);
    if (systemThemeMediaQuery) {
      if (systemThemeListenerType === 'event') {
        systemThemeMediaQuery.removeEventListener('change', handleSystemThemeChange);
      } else if (systemThemeListenerType === 'listener') {
        const legacyMediaQuery = systemThemeMediaQuery as MediaQueryList & {
          removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
        };
        if (typeof legacyMediaQuery.removeListener === 'function') {
          legacyMediaQuery.removeListener(handleSystemThemeChange);
        }
      }
      systemThemeMediaQuery = null;
      systemThemeListenerType = null;
    }
  }

  function initialize(): void {
    scrollY = window.scrollY;
    annotations = loadAnnotations(pathname, options.storageAdapter);
    setupSettingsPersistence();
    setupThemePreference();
    setAccentColor(settings.annotationColor);
    setupShadowObserver();
    updateSettingsUI();
    updateToolbarUI();
    renderMarkers();
    updateMarkerVisibility();
    updatePendingUI();
    updateHoverOverlay();
    updateEditOutline();
    overlay.style.display = 'none';

    if (!hasPlayedEntranceAnimation) {
      showEntranceAnimation = true;
      hasPlayedEntranceAnimation = true;
      setTimeout(function removeEntrance() {
        showEntranceAnimation = false;
        updateToolbarUI();
      }, 750);
    }
  }

  attachListeners();
  initialize();

  function destroy(): void {
    detachListeners();
    if (pendingPopup) pendingPopup.destroy();
    if (editPopup) editPopup.destroy();
    teardownShadowObserver();
    root.remove();
    const cursorStyle = document.getElementById('agent-snap-cursor-styles');
    if (cursorStyle) cursorStyle.remove();
    if (isFrozen) unfreezeAnimations();
  }

  return {
    destroy: destroy,
    setSettings: setSettings,
    getAnnotations: function getAnnotations() {
      return annotations;
    },
    copyOutput: copyOutput,
  };
}

export function registerAgentSnapElement(): void {
  if (typeof customElements === 'undefined') return;
  if (customElements.get('agent-snap')) return;

  class AgentSnapElement extends HTMLElement {
    private instance?: AgentSnapInstance;

    static get observedAttributes(): string[] {
      return [
        'theme',
        'annotation-color',
        'output-detail',
        'auto-clear-after-copy',
        'block-interactions',
        'capture-screenshots',
        'z-index',
      ];
    }

    connectedCallback(): void {
      const mountTarget = document.body;
      const nextSettings: Partial<AgentSnapSettings> = {};
      const annotationColor = this.getAttribute('annotation-color');
      if (annotationColor) {
        nextSettings.annotationColor = annotationColor;
      }
      const outputDetail = this.getAttribute('output-detail');
      if (outputDetail) {
        nextSettings.outputDetail = outputDetail as OutputDetailLevel;
      }
      if (this.hasAttribute('auto-clear-after-copy')) {
        nextSettings.autoClearAfterCopy = true;
      }
      if (this.hasAttribute('block-interactions')) {
        nextSettings.blockInteractions = true;
      }
      const captureScreenshots = this.getAttribute('capture-screenshots');
      if (captureScreenshots !== null) {
        nextSettings.captureScreenshots = captureScreenshots !== 'false';
      }
      this.instance = createAgentSnap({
        mount: mountTarget,
        initialTheme: this.hasAttribute('theme')
          ? this.getAttribute('theme') === 'light'
            ? 'light'
            : 'dark'
          : undefined,
        settings: nextSettings,
        zIndex: this.getAttribute('z-index') ? Number(this.getAttribute('z-index')) : undefined,
      });
    }

    attributeChangedCallback(
      name: string,
      _oldValue: string | null,
      newValue: string | null,
    ): void {
      if (!this.instance) return;
      if (name === 'annotation-color' && newValue) {
        this.instance.setSettings({ annotationColor: newValue });
      }
      if (name === 'output-detail' && newValue) {
        this.instance.setSettings({
          outputDetail: newValue as OutputDetailLevel,
        });
      }
      if (name === 'auto-clear-after-copy') {
        this.instance.setSettings({
          autoClearAfterCopy: this.hasAttribute('auto-clear-after-copy'),
        });
      }
      if (name === 'block-interactions') {
        this.instance.setSettings({
          blockInteractions: this.hasAttribute('block-interactions'),
        });
      }
      if (name === 'capture-screenshots') {
        this.instance.setSettings({
          captureScreenshots: newValue !== 'false',
        });
      }
    }

    disconnectedCallback(): void {
      if (this.instance) {
        this.instance.destroy();
        this.instance = undefined;
      }
    }
  }

  customElements.define('agent-snap', AgentSnapElement);
}
