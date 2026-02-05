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
import { createEventEmitter } from '@/core/events';
import { deferAnnotationScreenshot } from '@/core/screenshot';
import {
  renderMarkers as applyRenderMarkers,
  updateMarkerHoverUI as applyMarkerHoverUI,
  updateMarkerOutline as applyMarkerOutline,
} from '@/core/markers';
import {
  applyToolbarTheme,
  createToolbarElements,
  getNextOutputDetail,
  updateScreenshotQuotaUI,
  updateSettingsPanelVisibility as applySettingsPanelVisibility,
  updateSettingsUI as applySettingsUI,
  updateToolbarMenuDirection as applyToolbarMenuDirection,
  updateToolbarUI as applyToolbarUI,
  type ToggleState,
} from '@/core/toolbar';
import { createAnnotationStore } from '@/core/annotation-store';
import {
  DRAG_CANDIDATE_SELECTOR,
  DRAG_THRESHOLD,
  ELEMENT_UPDATE_THROTTLE,
  FINAL_SELECTION_TAGS,
  HOVER_UPDATE_THROTTLE,
  MEANINGFUL_TAGS,
  TEXT_TAGS,
} from '@/core/constants';
import { getSelectionConfig, getSelectionMetrics, MIN_AREA_SELECTION_SIZE } from '@/core/selection';
import {
  getAccessibilityInfo,
  getDataTestId,
  getDetailedComputedStyles,
  getElementClasses,
  getFullElementPath,
  getNearbyElements,
  getNearbyText,
  identifyElement,
} from '@/utils/element-identification';
import { generateOutput } from '@/utils/output';
import { clearAnnotations, loadAnnotations, saveAnnotations } from '@/utils/storage';
import { uploadDataUrlAsset } from '@/utils/upload';
import { t } from '@/utils/i18n';
import { applyInlineStyles } from '@/utils/styles';
import { getDailyScreenshotQuota } from '@/utils/screenshot-quota';
import {
  createIconCheckSmallAnimated,
  createIconClose,
  createIconCopyAnimated,
  createIconEdit,
  createIconPlus,
  createIconXmark,
} from '@/icons';
import { createAnnotationPopup } from '@/ui/popup';

const DEFAULT_SETTINGS: AgentSnapSettings = {
  outputDetail: 'standard',
  autoClearAfterCopy: false,
  annotationColor: '#3c82f7',
  blockInteractions: false,
  captureScreenshots: true,
  uploadScreenshots: true,
};

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
  elementRef?: HTMLElement;
  dataTestId?: string;
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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function buildUploadName(
  comment: string,
  kind: 'screenshot' | 'attachment',
  index?: number,
): string {
  const pathname =
    typeof window !== 'undefined' && window.location && window.location.pathname
      ? window.location.pathname
      : '';
  const pathSlug = pathname && pathname !== '/' ? slugify(pathname) : 'root';
  const base = slugify(comment) || 'annotation';
  if (kind === 'screenshot') {
    return `${pathSlug}-${base}-screenshot`;
  }
  const suffix = typeof index === 'number' ? String(index + 1) : '1';
  return `${pathSlug}-${base}-attachment-${suffix}`;
}

function buildUploadSignature(annotation: Annotation): string {
  const screenshot = annotation.screenshot || '';
  const attachments = annotation.attachments ? annotation.attachments.join('|') : '';
  return `${screenshot}|${attachments}`;
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
  let showShortcuts = false;
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
  let dragPendingPoint: { x: number; y: number } | null = null;
  let dragUpdateFrame: number | null = null;
  let justFinishedDrag = false;
  let lastElementUpdate = 0;
  let pendingExiting = false;
  let overlayFrame: number | null = null;
  let dragCandidateElements: HTMLElement[] | null = null;
  let dragCandidatesDirty = false;

  const animatedMarkers = new Set<string>();
  const exitingMarkers = new Set<string>();

  const passiveListenerOptions: AddEventListenerOptions = { passive: true };

  const markerElements = new Map<string, HTMLDivElement>();
  const fixedMarkerElements = new Map<string, HTMLDivElement>();

  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastHoverUpdate = -Infinity;
  let lastHoverElement: HTMLElement | null = null;
  let systemThemeMediaQuery: MediaQueryList | null = null;
  let systemThemeListenerType: 'event' | 'listener' | null = null;
  let annotationListenersAttached = false;
  let shadowRootsDirty = false;
  let shadowRootHosts = new Set<HTMLElement>();
  let shadowObserver: MutationObserver | null = null;
  let dragCandidateResizeObserver: ResizeObserver | null = null;

  const pathname = window.location.pathname;

  let settings: AgentSnapSettings = {
    ...DEFAULT_SETTINGS,
    ...options.settings,
  };
  let lastToggleState: ToggleState = {
    autoClearAfterCopy: settings.autoClearAfterCopy,
    blockInteractions: settings.blockInteractions,
    captureScreenshots: settings.captureScreenshots,
  };
  const shouldCopyToClipboard = options.copyToClipboard !== false;

  const toolbarElements = createToolbarElements();
  const {
    toolbar,
    toolbarContainer,
    toggleContent,
    pauseButton,
    copyButton,
    clearButton,
    settingsButton,
    settingsPanel,
    outputCycle,
    outputHelp,
    themeToggle,
    settingsBrandSlash,
    clearCheckbox,
    clearHelp,
    blockCheckbox,
    screenshotCheckbox,
    shortcutsButton,
  } = toolbarElements;

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

  const shortcutsBackdrop = document.createElement('div');
  shortcutsBackdrop.className = 'as-shortcuts-backdrop';
  shortcutsBackdrop.dataset.agentSnap = 'true';
  shortcutsBackdrop.style.display = 'none';

  const shortcutsPanel = document.createElement('div');
  shortcutsPanel.className = 'as-shortcuts-panel';
  shortcutsPanel.dataset.agentSnap = 'true';
  shortcutsPanel.dataset.testid = 'shortcuts-panel';
  shortcutsPanel.style.display = 'none';

  const shortcutsHeader = document.createElement('div');
  shortcutsHeader.className = 'as-shortcuts-header';
  const shortcutsTitle = document.createElement('span');
  shortcutsTitle.className = 'as-shortcuts-title';
  shortcutsTitle.textContent = t('shortcuts.title');
  const shortcutsClose = document.createElement('button');
  shortcutsClose.className = 'as-shortcuts-close';
  shortcutsClose.type = 'button';
  shortcutsClose.textContent = t('shortcuts.close');
  shortcutsHeader.appendChild(shortcutsTitle);
  shortcutsHeader.appendChild(shortcutsClose);
  shortcutsPanel.appendChild(shortcutsHeader);

  const shortcutsList = document.createElement('div');
  shortcutsList.className = 'as-shortcuts-list';
  const shortcutItems = [
    { label: t('shortcuts.toggle'), keys: 'Cmd/Ctrl+Shift+A' },
    { label: t('shortcuts.copy'), keys: 'Cmd/Ctrl+Shift+C' },
    { label: t('shortcuts.clear'), keys: 'Cmd/Ctrl+Shift+Backspace' },
    { label: t('shortcuts.pause'), keys: 'Cmd/Ctrl+Shift+P' },
    { label: t('shortcuts.next'), keys: 'Alt+ArrowRight' },
    { label: t('shortcuts.previous'), keys: 'Alt+ArrowLeft' },
    { label: t('shortcuts.help'), keys: '?' },
  ];
  shortcutItems.forEach(function addShortcut(item) {
    const row = document.createElement('div');
    row.className = 'as-shortcut-row';
    const label = document.createElement('span');
    label.className = 'as-shortcut-label';
    label.textContent = item.label;
    const keys = document.createElement('span');
    keys.className = 'as-shortcut-keys';
    keys.textContent = item.keys;
    row.appendChild(label);
    row.appendChild(keys);
    shortcutsList.appendChild(row);
  });
  shortcutsPanel.appendChild(shortcutsList);

  root.appendChild(toolbar);
  root.appendChild(markersLayer);
  root.appendChild(fixedMarkersLayer);
  root.appendChild(overlay);
  const liveRegion = document.createElement('div');
  liveRegion.className = 'as-live-region';
  liveRegion.dataset.agentSnap = 'true';
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  root.appendChild(liveRegion);
  overlay.appendChild(shortcutsBackdrop);
  overlay.appendChild(shortcutsPanel);

  const annotationStore = createAnnotationStore();
  const events = createEventEmitter<{ annotationsChanged: Annotation[] }>();
  let pendingPopup: ReturnType<typeof createAnnotationPopup> | null = null;
  let editPopup: ReturnType<typeof createAnnotationPopup> | null = null;
  const uploadPromises = new Map<string, { promise: Promise<Annotation>; signature: string }>();

  function getAnnotationsList(): Annotation[] {
    return annotationStore.getAnnotations();
  }

  function getAnnotationById(id: string): Annotation | null {
    return annotationStore.getAnnotationById(id);
  }

  function getAnnotationIndex(id: string): number {
    return annotationStore.getAnnotationIndex(id);
  }

  function persistAnnotations(annotations: Annotation[]): ReturnType<typeof saveAnnotations> {
    const result = saveAnnotations(pathname, annotations, options.storageAdapter);
    if (result.wasTrimmed) {
      annotationStore.setAnnotations(result.annotations);
    }
    return result;
  }

  function setAccentColor(color: string): void {
    root.style.setProperty('--as-accent', color);
    settingsBrandSlash.style.color = color;
  }

  function setTheme(mode: 'dark' | 'light'): void {
    isDarkMode = mode === 'dark';
    applyToolbarTheme({ elements: toolbarElements, isDarkMode: isDarkMode });
    shortcutsPanel.classList.toggle('as-light', !isDarkMode);
  }

  function updateSettingsUI(): void {
    lastToggleState = applySettingsUI({
      elements: toolbarElements,
      settings: settings,
      lastToggleState: lastToggleState,
      onSelectColor: function onSelectColor(color: string) {
        setSettings({ annotationColor: color });
      },
    });

    updateScreenshotQuotaUI({
      elements: toolbarElements,
      quota: getDailyScreenshotQuota({ annotations: getAnnotationsList() }),
    });
  }

  function updateToolbarUI(): void {
    applyToolbarUI({
      elements: toolbarElements,
      annotationsCount: getAnnotationsList().length,
      isActive: isActive,
      showEntranceAnimation: showEntranceAnimation,
      isFrozen: isFrozen,
      copied: copied,
      accentColor: settings.annotationColor,
    });
  }

  function updateSettingsPanelVisibility(): void {
    showSettingsVisible = applySettingsPanelVisibility({
      elements: toolbarElements,
      showSettings: showSettings,
      showSettingsVisible: showSettingsVisible,
      onHideComplete: function onHideComplete() {
        showSettingsVisible = false;
      },
    });
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
    applyToolbarMenuDirection({ elements: toolbarElements });
  }

  function setShortcutsVisible(next: boolean): void {
    showShortcuts = next;
    const display = showShortcuts ? 'block' : 'none';
    shortcutsBackdrop.style.display = display;
    shortcutsPanel.style.display = display;
  }

  function toggleShortcuts(): void {
    setShortcutsVisible(!showShortcuts);
  }

  function announce(message: string): void {
    if (!message) return;
    liveRegion.textContent = '';
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function announceMessage() {
        liveRegion.textContent = message;
      });
    } else {
      liveRegion.textContent = message;
    }
  }

  function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  function focusMarkerByOffset(offset: number): void {
    if (!isActive) return;
    const annotations = getAnnotationsList();
    if (annotations.length === 0) return;
    const currentIndex = hoveredMarkerId
      ? annotations.findIndex(function findIndex(annotation) {
          return annotation.id === hoveredMarkerId;
        })
      : -1;
    const baseIndex = currentIndex >= 0 ? currentIndex : offset > 0 ? -1 : 0;
    const nextIndex = (baseIndex + offset + annotations.length) % annotations.length;
    const next = annotations[nextIndex];
    if (next) {
      setHoverMarker(next.id);
    }
  }

  function updateMarkerVisibility(): void {
    const shouldShow = isActive;
    if (shouldShow) {
      markersExiting = false;
      markersVisible = true;
      setTimeout(function markAnimated() {
        getAnnotationsList().forEach(function markAnimatedAnnotation(annotation) {
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
    const previousId = hoveredMarkerId;
    if (previousId === id) return;
    hoveredMarkerId = id;
    updateMarkerHoverUI([previousId, id]);
    updateMarkerOutline();
  }

  function updateMarkerHoverUI(markerIds?: Array<string | null>): void {
    const ids = markerIds
      ? markerIds.filter(function filterId(id): id is string {
          return typeof id === 'string' && id.length > 0;
        })
      : undefined;
    if (ids && ids.length === 0) return;
    applyMarkerHoverUI({
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
      createIconEdit: createIconEdit,
      createIconXmark: createIconXmark,
      createIconClose: createIconClose,
      getAnnotationById: getAnnotationById,
      getAnnotationIndex: getAnnotationIndex,
      markerIds: ids,
    });
  }

  function updateMarkerOutline(): void {
    applyMarkerOutline({
      editingAnnotation: editingAnnotation,
      hoveredMarkerId: hoveredMarkerId,
      pendingAnnotation: pendingAnnotation,
      isDragging: isDragging,
      annotations: getAnnotationsList(),
      markerOutline: markerOutline,
      scrollY: scrollY,
      accentColor: settings.annotationColor,
    });
  }

  function renderMarkers(): void {
    applyRenderMarkers({
      annotations: getAnnotationsList(),
      markersVisible: markersVisible,
      markersExiting: markersExiting,
      getMarkersExiting: function getMarkersExiting() {
        return markersExiting;
      },
      exitingMarkers: exitingMarkers,
      animatedMarkers: animatedMarkers,
      isClearing: isClearing,
      renumberFrom: renumberFrom,
      markerElements: markerElements,
      fixedMarkerElements: fixedMarkerElements,
      markersLayer: markersLayer,
      fixedMarkersLayer: fixedMarkersLayer,
      scrollY: scrollY,
      onHoverMarker: setHoverMarker,
      onCopyAnnotation: copySingleAnnotation,
      onDeleteAnnotation: deleteAnnotation,
      onEditAnnotation: startEditAnnotation,
      getTooltipPosition: getTooltipPosition,
      applyInlineStyles: applyInlineStyles,
      createIconCopyAnimated: createIconCopyAnimated,
      createIconEdit: createIconEdit,
      createIconXmark: createIconXmark,
      createIconClose: createIconClose,
      accentColor: settings.annotationColor,
      isDarkMode: isDarkMode,
      hoveredMarkerId: hoveredMarkerId,
      deletingMarkerId: deletingMarkerId,
      editingAnnotation: editingAnnotation,
      getAnnotationById: getAnnotationById,
      getAnnotationIndex: getAnnotationIndex,
    });
  }

  events.on('annotationsChanged', function handleAnnotationsChange() {
    updateToolbarUI();
    renderMarkers();
  });

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

  function createPendingPopup(): void {
    if (!pendingAnnotation) return;
    if (pendingPopup) {
      pendingPopup.destroy();
      pendingPopup = null;
    }

    const anchorY = pendingAnnotation.clientY;

    pendingPopup = createAnnotationPopup({
      element: pendingAnnotation.element,
      selectedText: pendingAnnotation.selectedText,
      placeholder:
        pendingAnnotation.element === AREA_SELECTION_LABEL
          ? t('popup.placeholderArea')
          : pendingAnnotation.isMultiSelect
            ? t('popup.placeholderGroup')
            : t('popup.placeholder'),
      onSubmit: function handleSubmit(text, attachments, includeScreenshot) {
        addAnnotation(text, attachments, includeScreenshot);
      },
      onCopy: function handleCopy(text, attachments, includeScreenshot) {
        return copyPendingAnnotation(text, attachments, includeScreenshot);
      },
      onCancel: cancelAnnotation,
      accentColor: pendingAnnotation.isMultiSelect ? '#34C759' : settings.annotationColor,
      lightMode: !isDarkMode,
      screenshot: pendingAnnotation.screenshot,
      screenshotEnabled: settings.captureScreenshots,
      onScreenshotToggle: function handleScreenshotToggle(enabled) {
        if (!enabled) return;
        if (!pendingAnnotation || pendingAnnotation.screenshot || !pendingAnnotation.boundingBox) {
          return;
        }
        const currentPending = pendingAnnotation;
        deferAnnotationScreenshot(
          pendingAnnotation.boundingBox,
          pendingAnnotation.isFixed,
          pendingAnnotation.elementRef,
        ).then((dataUrl) => {
          if (dataUrl && currentPending === pendingAnnotation) {
            pendingAnnotation.screenshot = dataUrl;
            if (pendingPopup) {
              pendingPopup.updateScreenshot(dataUrl);
              // Re-adjust position after screenshot changes popup height (double RAF for layout)
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  adjustPopupPosition(pendingPopup?.root || null, anchorY);
                });
              });
            }
          }
        });
      },
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

    if (
      settings.captureScreenshots &&
      pendingAnnotation.boundingBox &&
      !pendingAnnotation.screenshot
    ) {
      const currentPending = pendingAnnotation;
      deferAnnotationScreenshot(
        pendingAnnotation.boundingBox,
        pendingAnnotation.isFixed,
        pendingAnnotation.elementRef,
      ).then((dataUrl) => {
        if (dataUrl && currentPending === pendingAnnotation) {
          pendingAnnotation.screenshot = dataUrl;
          if (pendingPopup) {
            pendingPopup.updateScreenshot(dataUrl);
            // Re-adjust position after screenshot changes popup height (double RAF for layout)
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                adjustPopupPosition(pendingPopup?.root || null, anchorY);
              });
            });
          }
        }
      });
    }
    // Double RAF to ensure layout is complete before measuring
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function waitForLayout() {
        requestAnimationFrame(function positionPendingPopup() {
          adjustPopupPosition(pendingPopup?.root || null, anchorY);
        });
      });
    } else {
      adjustPopupPosition(pendingPopup.root, anchorY);
    }
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
      initialAttachments: editingAnnotation.attachments,
      submitLabel: t('popup.submitSave'),
      onSubmit: updateAnnotation,
      onCopy: copyEditAnnotation,
      onCancel: cancelEditAnnotation,
      accentColor: editingAnnotation.isMultiSelect ? '#34C759' : settings.annotationColor,
      lightMode: !isDarkMode,
      screenshot: editingAnnotation.screenshot,
      screenshotEnabled: settings.captureScreenshots,
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
    const editAnchorY = editingAnnotation.isFixed
      ? editingAnnotation.y
      : editingAnnotation.y - scrollY;
    // Double RAF to ensure layout is complete before measuring
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function waitForLayout() {
        requestAnimationFrame(function positionEditPopup() {
          adjustPopupPosition(editPopup?.root || null, editAnchorY);
        });
      });
    } else {
      adjustPopupPosition(editPopup.root, editAnchorY);
    }
  }

  function adjustPopupPosition(popup: HTMLDivElement | null, anchorY?: number): void {
    if (!popup) return;
    const rect = popup.getBoundingClientRect();
    const padding = 16;
    const gap = 12;

    // Horizontal clamping (keep popup centered but within viewport)
    const minCenterX = padding + rect.width / 2;
    const maxCenterX = Math.max(minCenterX, window.innerWidth - padding - rect.width / 2);
    const centerX = rect.left + rect.width / 2;
    const clampedCenterX = Math.min(Math.max(centerX, minCenterX), maxCenterX);

    // Vertical positioning - smart flip when not enough space below
    const popupHeight = rect.height;
    const anchor = anchorY !== undefined ? anchorY : rect.top;
    const spaceBelow = window.innerHeight - anchor - gap;
    const spaceAbove = anchor - gap;

    let finalTop: number;

    // Check if popup fits below the anchor point
    if (popupHeight <= spaceBelow) {
      // Fits below - position below anchor
      finalTop = anchor + gap;
    } else if (popupHeight <= spaceAbove) {
      // Doesn't fit below but fits above - position above anchor
      finalTop = anchor - popupHeight - gap;
    } else {
      // Doesn't fit either way - position at top and let it scroll/clip
      // Or position where there's more space
      if (spaceAbove > spaceBelow) {
        finalTop = Math.max(padding, anchor - popupHeight - gap);
      } else {
        finalTop = Math.min(anchor + gap, window.innerHeight - padding - popupHeight);
      }
    }

    // Ensure popup stays within viewport bounds
    finalTop = Math.max(padding, Math.min(finalTop, window.innerHeight - padding - popupHeight));

    popup.style.left = `${clampedCenterX}px`;
    popup.style.top = `${finalTop}px`;
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

  function scheduleOverlayUpdate(): void {
    if (overlayFrame !== null) return;
    if (typeof requestAnimationFrame !== 'function') {
      updateMarkerOutline();
      updateEditOutline();
      updatePendingUI();
      updateHoverOverlay();
      return;
    }
    overlayFrame = requestAnimationFrame(function renderOverlay() {
      overlayFrame = null;
      updateMarkerOutline();
      updateEditOutline();
      updatePendingUI();
      updateHoverOverlay();
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
    if (isActive) {
      attachAnnotationListeners();
    } else {
      detachAnnotationListeners();
    }
    if (!isActive) {
      pendingAnnotation = null;
      editingAnnotation = null;
      hoverInfo = null;
      lastHoverUpdate = -Infinity;
      lastHoverElement = null;
      clearDragCandidates();
      showSettings = false;
      setShortcutsVisible(false);
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
      announce(t('announce.resumed'));
    } else {
      freezeAnimations();
      announce(t('announce.paused'));
    }
  }

  function buildAnnotationFromPending(
    comment: string,
    annotationId: string,
    allowScreenshots: boolean,
  ): Annotation | null {
    if (!pendingAnnotation) return null;
    return {
      id: annotationId,
      x: pendingAnnotation.x,
      y: pendingAnnotation.y,
      comment: comment,
      element: pendingAnnotation.element,
      elementPath: pendingAnnotation.elementPath,
      dataTestId: pendingAnnotation.dataTestId,
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
  }

  async function uploadAnnotationAssets(annotation: Annotation): Promise<Annotation> {
    if (!settings.uploadScreenshots) return annotation;

    const signature = buildUploadSignature(annotation);
    const existing = uploadPromises.get(annotation.id);
    if (existing && existing.signature === signature) {
      return existing.promise;
    }

    const promise = (async () => {
      let changed = false;
      let remoteScreenshot = annotation.remoteScreenshot;
      let remoteScreenshotViewer = annotation.remoteScreenshotViewer;
      let remoteAttachments = annotation.remoteAttachments;
      let remoteAttachmentViewers = annotation.remoteAttachmentViewers;

      if (annotation.screenshot && !remoteScreenshot) {
        const result = await uploadDataUrlAsset(annotation.screenshot, {
          apiKey: settings.uploadApiKey,
          filename: buildUploadName(annotation.comment, 'screenshot'),
        });
        if (result) {
          remoteScreenshot = result.downloadUrl;
          remoteScreenshotViewer = result.viewerUrl;
          changed = true;
        }
      }

      if (annotation.attachments && annotation.attachments.length > 0) {
        if (!remoteAttachments || remoteAttachments.length !== annotation.attachments.length) {
          const results = await Promise.all(
            annotation.attachments.map((item, index) =>
              uploadDataUrlAsset(item, {
                apiKey: settings.uploadApiKey,
                filename: buildUploadName(annotation.comment, 'attachment', index),
              }),
            ),
          );
          const validDownloads = results
            .map((item) => item?.downloadUrl)
            .filter((item): item is string => item !== undefined);
          const validViewers = results
            .map((item) => item?.viewerUrl)
            .filter((item): item is string => item !== undefined);
          if (validDownloads.length === annotation.attachments.length) {
            remoteAttachments = validDownloads;
            remoteAttachmentViewers =
              validViewers.length === annotation.attachments.length ? validViewers : undefined;
            changed = true;
          }
        }
      }

      if (!changed) return annotation;

      const latest = annotationStore.getAnnotationById(annotation.id);
      if (!latest || buildUploadSignature(latest) !== signature) {
        return annotation;
      }

      const updated = annotationStore.updateAnnotation(annotation.id, function update(item) {
        return {
          ...item,
          remoteScreenshot: remoteScreenshot,
          remoteScreenshotViewer: remoteScreenshotViewer,
          remoteAttachments: remoteAttachments,
          remoteAttachmentViewers: remoteAttachmentViewers,
        };
      });
      if (updated) {
        persistAnnotations(getAnnotationsList());
        return updated;
      }
      return annotation;
    })();

    uploadPromises.set(annotation.id, { promise: promise, signature: signature });

    try {
      return await promise;
    } finally {
      const stored = uploadPromises.get(annotation.id);
      if (stored && stored.promise === promise) {
        uploadPromises.delete(annotation.id);
      }
    }
  }

  async function prepareAnnotationsForCopy(annotations: Annotation[]): Promise<Annotation[]> {
    if (!settings.uploadScreenshots) return annotations;
    annotations.forEach(function queueUpload(annotation) {
      void uploadAnnotationAssets(annotation);
    });
    return annotations;
  }

  function finalizeAnnotation(
    newAnnotation: Annotation,
    screenshotPromise?: Promise<string | null>,
  ): void {
    annotationStore.addAnnotation(newAnnotation);
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
    const annotations = getAnnotationsList();
    const saveResult = persistAnnotations(annotations);
    const storedAnnotations = saveResult.annotations;
    if (options.onAnnotationAdd) {
      const storedAnnotation =
        storedAnnotations.find((item) => item.id === newAnnotation.id) || newAnnotation;
      options.onAnnotationAdd(storedAnnotation);
    }
    events.emit('annotationsChanged', getAnnotationsList());
    announce(t('announce.annotationAdded'));
    if (saveResult.didFail) {
      announce(t('announce.storageFailed'));
    }

    void uploadAnnotationAssets(newAnnotation);

    if (screenshotPromise && !newAnnotation.screenshot) {
      screenshotPromise.then(function updateScreenshot(value) {
        if (!value) return;
        const updated = annotationStore.updateAnnotation(
          newAnnotation.id,
          function update(item: Annotation) {
            return { ...item, screenshot: value };
          },
        );
        if (!updated) return;
        const saveResult = persistAnnotations(getAnnotationsList());
        if (saveResult.didFail) {
          announce(t('announce.storageFailed'));
        }
        if (options.onAnnotationUpdate) {
          options.onAnnotationUpdate(updated);
        }
        void uploadAnnotationAssets(updated);
      });
    }
  }

  function addAnnotation(
    comment: string,
    attachments: string[] = [],
    allowScreenshotsOverride?: boolean,
    screenshotPromiseOverride?: Promise<string | null>,
  ): Annotation | null {
    if (!pendingAnnotation) return null;
    const allowScreenshots = allowScreenshotsOverride ?? settings.captureScreenshots;
    const screenshotPromise = allowScreenshots
      ? screenshotPromiseOverride ||
        (!pendingAnnotation.screenshot && pendingAnnotation.boundingBox
          ? deferAnnotationScreenshot(
              pendingAnnotation.boundingBox,
              pendingAnnotation.isFixed,
              pendingAnnotation.elementRef,
            )
          : undefined)
      : undefined;
    const newAnnotation = buildAnnotationFromPending(
      comment,
      createAnnotationId(),
      allowScreenshots,
    );
    if (!newAnnotation) return null;
    newAnnotation.attachments = attachments;
    finalizeAnnotation(newAnnotation, screenshotPromise);
    return newAnnotation;
  }

  async function copyPendingAnnotation(
    comment: string,
    attachments: string[] = [],
    allowScreenshotsOverride?: boolean,
  ): Promise<void> {
    if (!pendingAnnotation) return;
    const allowScreenshots = allowScreenshotsOverride ?? settings.captureScreenshots;
    const screenshotPromise =
      allowScreenshots && !pendingAnnotation.screenshot && pendingAnnotation.boundingBox
        ? deferAnnotationScreenshot(
            pendingAnnotation.boundingBox,
            pendingAnnotation.isFixed,
            pendingAnnotation.elementRef,
          )
        : undefined;
    const annotation = addAnnotation(comment, attachments, allowScreenshots, screenshotPromise);
    if (!annotation) return;
    if (screenshotPromise && !annotation.screenshot) {
      const value = await screenshotPromise;
      if (value) {
        annotation.screenshot = value;
      }
    }
    await copySingleAnnotation(annotation);
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
    const deletedIndex = annotationStore.getAnnotationIndex(id);
    const deletedAnnotation = annotationStore.getAnnotationById(id);
    uploadPromises.delete(id);
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
      annotationStore.removeAnnotation(id);
      exitingMarkers.delete(id);
      animatedMarkers.delete(id);
      deletingMarkerId = null;
      const annotations = getAnnotationsList();
      const saveResult = persistAnnotations(annotations);
      if (deletedAnnotation && options.onAnnotationDelete) {
        options.onAnnotationDelete(deletedAnnotation);
      }
      events.emit('annotationsChanged', saveResult.annotations);
      announce(t('announce.annotationDeleted'));
      if (saveResult.didFail) {
        announce(t('announce.storageFailed'));
      }
      if (deletedIndex >= 0 && deletedIndex < annotations.length) {
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

  async function copyEditAnnotation(
    comment: string,
    attachments: string[] = [],
    includeScreenshot: boolean,
  ): Promise<void> {
    if (!editingAnnotation) return;
    updateAnnotation(comment, attachments, includeScreenshot);
    const annotation = getAnnotationById(editingAnnotation.id);
    if (annotation) {
      await copySingleAnnotation(annotation);
    }
  }

  function updateAnnotation(
    newComment: string,
    newAttachments: string[] = [],
    includeScreenshot: boolean,
  ): void {
    if (!editingAnnotation) return;
    const previousAttachments = editingAnnotation.attachments || [];
    const attachmentsChanged =
      previousAttachments.length !== newAttachments.length ||
      newAttachments.some(function compareAttachment(value, index) {
        return value !== previousAttachments[index];
      });
    const updatedAnnotation = annotationStore.updateAnnotation(
      editingAnnotation.id,
      function update(item: Annotation) {
        return {
          ...item,
          comment: newComment,
          attachments: newAttachments,
          screenshot: includeScreenshot ? item.screenshot : undefined,
          remoteScreenshot: includeScreenshot ? item.remoteScreenshot : undefined,
          remoteAttachments:
            newAttachments.length > 0 && !attachmentsChanged ? item.remoteAttachments : undefined,
        };
      },
    );
    if (!includeScreenshot || newAttachments.length === 0 || attachmentsChanged) {
      uploadPromises.delete(editingAnnotation.id);
    }
    const saveResult = persistAnnotations(getAnnotationsList());
    if (saveResult.didFail) {
      announce(t('announce.storageFailed'));
    }
    if (updatedAnnotation && options.onAnnotationUpdate) {
      options.onAnnotationUpdate(updatedAnnotation);
    }
    if (updatedAnnotation) {
      void uploadAnnotationAssets(updatedAnnotation);
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
    const annotations = getAnnotationsList();
    const count = annotations.length;
    if (count === 0) return;
    const clearedAnnotations = annotations.slice();
    isClearing = true;
    renderMarkers();
    const totalAnimationTime = count * 30 + 200;
    setTimeout(function finalizeClear() {
      annotationStore.setAnnotations([]);
      animatedMarkers.clear();
      exitingMarkers.clear();
      uploadPromises.clear();
      clearAnnotations(pathname, options.storageAdapter);
      isClearing = false;
      events.emit('annotationsChanged', getAnnotationsList());
      announce(t('announce.annotationsCleared'));
      if (options.onAnnotationsClear) {
        options.onAnnotationsClear(clearedAnnotations);
      }
    }, totalAnimationTime);
  }

  async function copyOutput(): Promise<string> {
    const prepared = await prepareAnnotationsForCopy(getAnnotationsList());
    const output = generateOutput(prepared, pathname, settings.outputDetail);
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
    announce(t('announce.copied'));
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
    const prepared = await prepareAnnotationsForCopy([annotation]);
    const output = generateOutput(prepared, pathname, settings.outputDetail);
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
    announce(t('announce.copiedSingle'));
    setTimeout(function clearCopied() {
      copied = false;
      updateToolbarUI();
    }, 2000);

    flashCopiedMarker(annotation.id);

    return output;
  }

  function updateCursorStyles(): void {
    if (typeof document === 'undefined') return;
    if (isActive) {
      document.documentElement.dataset.agentSnapActive = 'true';
    } else {
      delete document.documentElement.dataset.agentSnapActive;
    }
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
    if (!isActive && !pendingAnnotation && !editingAnnotation) return;
    scrollY = window.scrollY;
    isScrolling = true;
    scheduleOverlayUpdate();
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(function stopScrolling() {
      isScrolling = false;
      scheduleOverlayUpdate();
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

  function collectShadowRootsFromNode(node: ParentNode): void {
    const elements = Array.from(node.childNodes).filter(function filterElement(child) {
      return child instanceof Element;
    }) as Element[];

    elements.forEach(function visitElement(element) {
      const host = element as HTMLElement;
      if (host.shadowRoot) {
        shadowRootHosts.add(host);
        collectShadowRootsFromNode(host.shadowRoot);
      }
      collectShadowRootsFromNode(element);
    });
  }

  function collectInitialShadowRoots(): void {
    shadowRootHosts.clear();
    if (document.body) {
      collectShadowRootsFromNode(document.body);
    }
    shadowRootsDirty = false;
  }

  function cleanupShadowRoots(): void {
    if (!shadowRootsDirty) return;
    shadowRootHosts.forEach(function cleanupHost(host) {
      if (!host.isConnected || !host.shadowRoot) {
        shadowRootHosts.delete(host);
      }
    });
    shadowRootsDirty = false;
  }

  function setupShadowObserver(): void {
    collectInitialShadowRoots();
    if (!window.MutationObserver) return;
    if (shadowObserver) return;
    shadowObserver = new MutationObserver(function handleMutations(mutations) {
      mutations.forEach(function applyMutation(mutation) {
        mutation.addedNodes.forEach(function handleAdded(node) {
          if (node instanceof Element) {
            collectShadowRootsFromNode(node);
          }
        });
        if (mutation.removedNodes.length > 0) {
          shadowRootsDirty = true;
        }
      });
      dragCandidatesDirty = true;
    });
    shadowObserver.observe(document.body, { childList: true, subtree: true });
  }

  function teardownShadowObserver(): void {
    if (shadowObserver) {
      shadowObserver.disconnect();
      shadowObserver = null;
    }
    shadowRootHosts.clear();
    shadowRootsDirty = false;
  }

  function setupDragCandidateObserver(): void {
    if (typeof ResizeObserver === 'undefined') return;
    if (dragCandidateResizeObserver) return;
    if (!document.body) return;
    dragCandidateResizeObserver = new ResizeObserver(function handleResize() {
      dragCandidatesDirty = true;
    });
    dragCandidateResizeObserver.observe(document.body);
  }

  function teardownDragCandidateObserver(): void {
    if (!dragCandidateResizeObserver) return;
    dragCandidateResizeObserver.disconnect();
    dragCandidateResizeObserver = null;
  }

  function getShadowRoots(): ShadowRoot[] {
    cleanupShadowRoots();
    return Array.from(shadowRootHosts)
      .map(function mapRoot(host) {
        return host.shadowRoot || null;
      })
      .filter(function filterRoot(root): root is ShadowRoot {
        return root !== null;
      });
  }

  function querySelectorAllDeep(selector: string): HTMLElement[] {
    const results: HTMLElement[] = [];
    document.querySelectorAll(selector).forEach(function addElement(el) {
      if (el instanceof HTMLElement) results.push(el);
    });

    getShadowRoots().forEach(function addShadowRoot(root) {
      root.querySelectorAll(selector).forEach(function addShadowElement(el) {
        if (el instanceof HTMLElement) results.push(el);
      });
    });

    return results;
  }

  function refreshDragCandidates(): void {
    dragCandidateElements = querySelectorAllDeep(DRAG_CANDIDATE_SELECTOR);
    dragCandidatesDirty = false;
  }

  function getDragCandidates(): HTMLElement[] {
    if (!dragCandidateElements || dragCandidatesDirty) {
      refreshDragCandidates();
    }
    return dragCandidateElements || [];
  }

  function clearDragCandidates(): void {
    dragCandidateElements = null;
    dragCandidatesDirty = false;
  }

  function handleMouseMove(event: MouseEvent): void {
    if (!isActive || pendingAnnotation) return;
    const now = Date.now();
    const elementUnder = getEffectiveTarget(event);
    if (!elementUnder) {
      hoverInfo = null;
      lastHoverElement = null;
      scheduleOverlayUpdate();
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
    scheduleOverlayUpdate();
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

    const shouldCaptureDetailed = settings.outputDetail !== 'standard';
    const shouldCaptureForensic = settings.outputDetail === 'forensic';
    let nearbyText: string | undefined;
    let cssClasses: string | undefined;
    let fullPath: string | undefined;
    let accessibility: string | undefined;
    let computedStyles: string | undefined;
    let nearbyElements: string | undefined;
    if (shouldCaptureDetailed) {
      nearbyText = getNearbyText(elementUnder);
      cssClasses = getElementClasses(elementUnder);
    }
    if (shouldCaptureForensic) {
      fullPath = getFullElementPath(elementUnder);
      accessibility = getAccessibilityInfo(elementUnder);
      const computedStylesObj = getDetailedComputedStyles(elementUnder);
      computedStyles = Object.entries(computedStylesObj)
        .map(function mapStyle([key, value]) {
          return `${key}: ${value}`;
        })
        .join('; ');
      nearbyElements = getNearbyElements(elementUnder);
    }

    pendingAnnotation = {
      x: x,
      y: y,
      clientY: event.clientY,
      element: identified.name,
      elementPath: identified.path,
      elementRef: elementUnder,
      dataTestId: getDataTestId(elementUnder),
      selectedText: selectedText,
      boundingBox: {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      },
      nearbyText: nearbyText,
      cssClasses: cssClasses,
      isFixed: fixed,
      fullPath: fullPath,
      accessibility: accessibility,
      computedStyles: computedStyles,
      nearbyElements: nearbyElements,
    };

    hoverInfo = null;
    updatePendingUI();
    createPendingPopup();
  }

  function handleMouseDown(event: MouseEvent): void {
    if (!isActive || pendingAnnotation) return;
    const target = getEffectiveTarget(event);
    if (!target) return;

    if (TEXT_TAGS.has(target.tagName) || target.isContentEditable) {
      return;
    }

    mouseDownPos = { x: event.clientX, y: event.clientY };
  }

  function scheduleDragUpdate(): void {
    if (dragUpdateFrame !== null) return;
    if (typeof requestAnimationFrame !== 'function') {
      runDragUpdate();
      return;
    }
    dragUpdateFrame = requestAnimationFrame(runDragUpdate);
  }

  function runDragUpdate(): void {
    dragUpdateFrame = null;
    if (!dragStart || !dragPendingPoint) return;

    const endPoint = dragPendingPoint;
    dragPendingPoint = null;

    const metrics = getSelectionMetrics(dragStart.x, dragStart.y, endPoint.x, endPoint.y);
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
    const candidateElements = getDragCandidates();
    const allMatching: DOMRect[] = [];

    candidateElements.forEach(function addCandidate(element) {
      if (element.closest('[data-agent-snap]') || element.closest('[data-annotation-marker]')) {
        return;
      }

      const rect = element.getBoundingClientRect();
      if (rect.width > window.innerWidth * 0.8 && rect.height > window.innerHeight * 0.5) {
        return;
      }
      if (rect.width < minElementSize || rect.height < minElementSize) return;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const centerInside =
        centerX >= detectLeft &&
        centerX <= detectRight &&
        centerY >= detectTop &&
        centerY <= detectBottom;
      const overlapX = Math.min(rect.right, detectRight) - Math.max(rect.left, detectLeft);
      const overlapY = Math.min(rect.bottom, detectBottom) - Math.max(rect.top, detectTop);
      const overlapArea = overlapX > 0 && overlapY > 0 ? overlapX * overlapY : 0;
      const elementArea = rect.width * rect.height;
      const overlapRatio = elementArea > 0 ? overlapArea / elementArea : 0;
      const qualifiesByOverlap = isThinSelection
        ? overlapArea > 0
        : centerInside || overlapRatio > overlapThreshold;
      if (!qualifiesByOverlap) return;

      const tagName = element.tagName;
      let shouldInclude = MEANINGFUL_TAGS.has(tagName);
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
      refreshDragCandidates();
      updateDragUI();
    }

    if ((isDragging || distance >= thresholdSq) && dragStart) {
      dragPendingPoint = { x: event.clientX, y: event.clientY };
      scheduleDragUpdate();
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
      const candidates = getDragCandidates();

      candidates.forEach(function checkElement(el) {
        if (!FINAL_SELECTION_TAGS.has(el.tagName)) return;
        if (el.closest('[data-agent-snap]') || el.closest('[data-annotation-marker]')) return;
        const rect = el.getBoundingClientRect();
        if (rect.width > window.innerWidth * 0.8 && rect.height > window.innerHeight * 0.5) return;
        if (rect.width < minElementSize || rect.height < minElementSize) return;
        if (
          rect.left < detectRight &&
          rect.right > detectLeft &&
          rect.top < detectBottom &&
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
        const shouldCaptureDetailed = settings.outputDetail !== 'standard';
        const shouldCaptureForensic = settings.outputDetail === 'forensic';
        let firstCssClasses: string | undefined;
        let firstNearbyText: string | undefined;
        let firstFullPath: string | undefined;
        let firstAccessibility: string | undefined;
        let firstComputedStylesStr: string | undefined;
        let firstNearbyElements: string | undefined;
        if (shouldCaptureDetailed) {
          firstCssClasses = getElementClasses(firstElement);
          firstNearbyText = getNearbyText(firstElement);
        }
        if (shouldCaptureForensic) {
          firstFullPath = getFullElementPath(firstElement);
          firstAccessibility = getAccessibilityInfo(firstElement);
          const firstComputedStyles = getDetailedComputedStyles(firstElement);
          firstComputedStylesStr = Object.entries(firstComputedStyles)
            .map(function mapStyle([key, value]) {
              return `${key}: ${value}`;
            })
            .join('; ');
          firstNearbyElements = getNearbyElements(firstElement);
        }

        pendingAnnotation = {
          x: x,
          y: y,
          clientY: event.clientY,
          element: buildMultiSelectLabel(finalElements.length, elementNames, suffix),
          elementPath: MULTI_SELECT_PATH,
          dataTestId: getDataTestId(firstElement),
          boundingBox: {
            x: bounds.left + window.scrollX,
            y: bounds.top + window.scrollY,
            width: bounds.right - bounds.left,
            height: bounds.bottom - bounds.top,
          },
          isMultiSelect: true,
          fullPath: firstFullPath,
          accessibility: firstAccessibility,
          computedStyles: firstComputedStylesStr,
          nearbyElements: firstNearbyElements,
          cssClasses: firstCssClasses,
          nearbyText: firstNearbyText,
        };
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
              x: Math.round(left + window.scrollX),
              y: Math.round(top + window.scrollY),
            }),
            boundingBox: {
              x: left + window.scrollX,
              y: top + window.scrollY,
              width: width,
              height: height,
            },
            isMultiSelect: true,
          };
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
    dragPendingPoint = null;
    isDragging = false;
    if (dragUpdateFrame !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(dragUpdateFrame);
      dragUpdateFrame = null;
    }
    updateDragUI();
    highlightsContainer.innerHTML = '';
    clearDragCandidates();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (showShortcuts) {
        event.preventDefault();
        setShortcutsVisible(false);
        return;
      }
      if (pendingAnnotation) {
        return;
      }
      if (isActive) {
        setActive(false);
        updateCursorStyles();
      }
      return;
    }

    if (isEditableTarget(event.target)) return;

    if (event.key === '?') {
      event.preventDefault();
      toggleShortcuts();
      return;
    }

    if (event.altKey && event.key === 'ArrowRight') {
      event.preventDefault();
      focusMarkerByOffset(1);
      return;
    }

    if (event.altKey && event.key === 'ArrowLeft') {
      event.preventDefault();
      focusMarkerByOffset(-1);
      return;
    }

    const hasModifier = event.metaKey || event.ctrlKey;
    if (hasModifier && event.shiftKey) {
      const key = event.key.toLowerCase();
      if (key === 'a') {
        event.preventDefault();
        setActive(!isActive);
        updateCursorStyles();
        return;
      }
      if (key === 'c') {
        event.preventDefault();
        void copyOutput();
        return;
      }
      if (key === 'p') {
        event.preventDefault();
        toggleFreeze();
        return;
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        clearAll();
      }
    }
  }

  function setupSettingsPersistence(): void {
    try {
      const storedSettings = localStorage.getItem(SETTINGS_KEY);
      if (storedSettings) {
        const persisted = JSON.parse(storedSettings) as Partial<AgentSnapSettings>;
        // Never persist secrets like API keys. Always prefer the value provided at init.
        const initApiKey = options.settings?.uploadApiKey;
        settings = { ...DEFAULT_SETTINGS, ...persisted, uploadApiKey: initApiKey };
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

  function attachAnnotationListeners(): void {
    if (annotationListenersAttached) return;
    annotationListenersAttached = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseDrag, passiveListenerOptions);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, passiveListenerOptions);
    window.addEventListener('resize', updateToolbarPosition);
  }

  function detachAnnotationListeners(): void {
    if (!annotationListenersAttached) return;
    annotationListenersAttached = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseDrag, passiveListenerOptions);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('scroll', handleScroll, passiveListenerOptions);
    window.removeEventListener('resize', updateToolbarPosition);
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
      setSettings({ outputDetail: getNextOutputDetail(settings.outputDetail) });
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
    shortcutsButton.addEventListener('click', function handleShortcuts(event) {
      event.stopPropagation();
      toggleShortcuts();
    });
    shortcutsBackdrop.addEventListener('click', function handleShortcutsClose() {
      setShortcutsVisible(false);
    });
    shortcutsClose.addEventListener('click', function handleShortcutsClose(event) {
      event.stopPropagation();
      setShortcutsVisible(false);
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
    detachAnnotationListeners();
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
    annotationStore.setAnnotations(
      loadAnnotations(pathname, options.storageAdapter, options.storageRetentionDays),
    );
    setupSettingsPersistence();
    setupThemePreference();
    setAccentColor(settings.annotationColor);
    setupShadowObserver();
    setupDragCandidateObserver();
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
    events.clear();
    teardownShadowObserver();
    teardownDragCandidateObserver();
    root.remove();
    if (typeof document !== 'undefined') {
      delete document.documentElement.dataset.agentSnapActive;
    }
    if (isFrozen) unfreezeAnimations();
  }

  return {
    destroy: destroy,
    setSettings: setSettings,
    getAnnotations: function getAnnotations() {
      return getAnnotationsList();
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
