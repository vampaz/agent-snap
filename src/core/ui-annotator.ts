import uiAnnotatorCss from "@/styles/ui-annotator.css?inline";
import type {
  Annotation,
  OutputDetailLevel,
  UiAnnotatorInstance,
  UiAnnotatorOptions,
  UiAnnotatorSettings,
} from "@/types";
import {
  getAccessibilityInfo,
  getDetailedComputedStyles,
  getElementClasses,
  getFullElementPath,
  getNearbyElements,
  getNearbyText,
  identifyElement,
} from "@/utils/element-identification";
import { generateOutput } from "@/utils/output";
import {
  clearAnnotations,
  loadAnnotations,
  saveAnnotations,
} from "@/utils/storage";
import { t } from "@/utils/i18n";
import {
  createIconCheckSmallAnimated,
  createIconClose,
  createIconCopyAnimated,
  createIconEyeAnimated,
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
} from "@/icons";
import { createAnnotationPopup } from "@/ui/popup";
import packageInfo from "../../package.json";

const DEFAULT_SETTINGS: UiAnnotatorSettings = {
  outputDetail: "standard",
  autoClearAfterCopy: false,
  annotationColor: "#3c82f7",
  blockInteractions: false,
  captureScreenshots: true,
};

const OUTPUT_DETAIL_OPTIONS: { value: OutputDetailLevel; label: string }[] = [
  { value: "compact", label: t("settings.outputDetail.compact") },
  { value: "standard", label: t("settings.outputDetail.standard") },
  { value: "detailed", label: t("settings.outputDetail.detailed") },
  { value: "forensic", label: t("settings.outputDetail.forensic") },
];

const COLOR_OPTIONS = [
  { value: "#AF52DE", label: t("settings.color.purple") },
  { value: "#3c82f7", label: t("settings.color.blue") },
  { value: "#5AC8FA", label: t("settings.color.cyan") },
  { value: "#34C759", label: t("settings.color.green") },
  { value: "#FFD60A", label: t("settings.color.yellow") },
  { value: "#FF9500", label: t("settings.color.orange") },
  { value: "#FF3B30", label: t("settings.color.red") },
];

const SETTINGS_KEY = "ui-annotator-settings";
const THEME_KEY = "ui-annotator-theme";

let hasPlayedEntranceAnimation = false;

const AREA_SELECTION_LABEL = t("annotation.areaSelection");
const MULTI_SELECT_PATH = t("annotation.multiSelectPath");

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

function resolveMountTarget(
  mount?: UiAnnotatorOptions["mount"],
): HTMLElement | ShadowRoot | null {
  if (typeof document === "undefined") return null;
  if (!mount) return document.body;
  if (typeof mount === "string") {
    const found = document.querySelector(mount);
    return found instanceof HTMLElement ? found : null;
  }
  if (mount instanceof HTMLElement) return mount;
  if (typeof ShadowRoot !== "undefined" && mount instanceof ShadowRoot) {
    return mount;
  }
  return null;
}

function injectStyles(target: HTMLElement | ShadowRoot | null): void {
  if (typeof document === "undefined") return;
  const rootNode =
    target && typeof ShadowRoot !== "undefined" && target instanceof ShadowRoot
      ? target
      : document.head;
  const existing = rootNode.querySelector("#ui-annotator-styles");
  if (existing) return;
  const style = document.createElement("style");
  style.id = "ui-annotator-styles";
  style.textContent = uiAnnotatorCss;
  rootNode.appendChild(style);
}

function isElementFixed(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    const position = style.position;
    if (position === "fixed" || position === "sticky") {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

function applyPositionStyles(
  element: HTMLElement,
  styles: Partial<CSSStyleDeclaration>,
): void {
  Object.entries(styles).forEach(function applyStyle([key, value]) {
    if (typeof value === "string") {
      element.style.setProperty(key, value);
    }
  });
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
    .join("");
}

function cloneWithInlineStyles(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement;
  const sourceElements = [element].concat(
    Array.from(element.querySelectorAll("*")),
  );
  const clonedElements = [clone].concat(
    Array.from(clone.querySelectorAll("*")),
  );

  sourceElements.forEach(function inlineStyles(source, index) {
    const cloned = clonedElements[index];
    if (!(cloned instanceof HTMLElement)) return;
    const computed = window.getComputedStyle(source);
    cloned.setAttribute("style", getComputedStyleText(computed));
  });

  return clone;
}

function stripAnnotatorNodes(root: HTMLElement): void {
  if (root.matches("[data-ui-annotator]")) {
    root.removeAttribute("data-ui-annotator");
  }
  root
    .querySelectorAll("[data-ui-annotator]")
    .forEach(function removeAnnotator(node) {
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
  if (typeof Image === "undefined") return Promise.resolve(null);
  stripAnnotatorNodes(clone);
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  if (offset) {
    clone.style.transform = `translate(${-offset.x}px, ${-offset.y}px)`;
    clone.style.transformOrigin = "top left";
  }
  const wrapper = document.createElement("div");
  wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.overflow = "hidden";
  wrapper.appendChild(clone);

  const serialized = new XMLSerializer().serializeToString(wrapper);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`;
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return new Promise(function resolveScreenshot(resolve) {
    const image = new Image();
    image.decoding = "async";
    image.onload = function handleLoad() {
      const canvas = document.createElement("canvas");
      const scale = window.devicePixelRatio || 1;
      canvas.width = width * scale;
      canvas.height = height * scale;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(null);
        return;
      }
      context.scale(scale, scale);
      context.drawImage(image, 0, 0);
      try {
        resolve(canvas.toDataURL("image/png"));
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
  if (typeof window === "undefined" || !document.body) {
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
  return Promise.resolve("");
}

function buildMultiSelectLabel(
  count: number,
  elements: string,
  suffix: string,
): string {
  return t("annotation.multiSelectLabel", {
    count: count,
    elements: elements,
    suffix: suffix,
  });
}

function createNoopInstance(): UiAnnotatorInstance {
  return {
    destroy: noop,
    setSettings: noop,
    getAnnotations: noopGetAnnotations,
    copyOutput: noopCopy,
  };
}

export function createUiAnnotator(
  options: UiAnnotatorOptions = {},
): UiAnnotatorInstance {
  const mountTarget = resolveMountTarget(options.mount);
  if (!mountTarget || typeof document === "undefined") {
    return createNoopInstance();
  }

  injectStyles(mountTarget);

  const root = document.createElement("div");
  root.dataset.uiAnnotatorRoot = "true";
  root.dataset.uiAnnotator = "true";
  if (typeof options.zIndex === "number") {
    root.style.zIndex = String(options.zIndex);
  }
  mountTarget.appendChild(root);

  let isActive = false;
  let showMarkers = true;
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

  const markerElements = new Map<string, HTMLDivElement>();
  const fixedMarkerElements = new Map<string, HTMLDivElement>();

  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

  const pathname = window.location.pathname;

  let settings: UiAnnotatorSettings = {
    ...DEFAULT_SETTINGS,
    ...options.settings,
  };
  const shouldCopyToClipboard = options.copyToClipboard !== false;

  const toolbar = document.createElement("div");
  toolbar.className = "ua-toolbar";
  toolbar.dataset.uiAnnotator = "true";
  toolbar.dataset.testid = "toolbar";

  const toolbarContainer = document.createElement("div");
  toolbarContainer.className = "ua-toolbar-container ua-collapsed";
  toolbarContainer.dataset.testid = "toolbar-container";
  toolbar.appendChild(toolbarContainer);

  const toggleContent = document.createElement("div");
  toggleContent.className = "ua-toggle-content ua-visible";
  toggleContent.dataset.testid = "toolbar-toggle";
  const toggleIcon = createIconListSparkle({ size: 24 });
  toggleContent.appendChild(toggleIcon);

  const badge = document.createElement("span");
  badge.className = "ua-badge";
  toggleContent.appendChild(badge);

  const controlsContent = document.createElement("div");
  controlsContent.className = "ua-controls-content ua-hidden";

  const pauseButton = document.createElement("button");
  pauseButton.type = "button";
  pauseButton.className = "ua-control-button";
  pauseButton.dataset.testid = "toolbar-pause-button";
  pauseButton.appendChild(createIconPausePlayAnimated({ size: 24 }));

  const markersButton = document.createElement("button");
  markersButton.type = "button";
  markersButton.className = "ua-control-button";
  markersButton.dataset.testid = "toolbar-markers-button";
  markersButton.appendChild(createIconEyeAnimated({ size: 24, isOpen: true }));

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "ua-control-button";
  copyButton.dataset.testid = "toolbar-copy-button";
  copyButton.appendChild(createIconCopyAnimated({ size: 24, copied: false }));

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "ua-control-button";
  clearButton.dataset.danger = "true";
  clearButton.dataset.testid = "toolbar-clear-button";
  clearButton.appendChild(createIconTrash({ size: 24 }));

  const settingsButton = document.createElement("button");
  settingsButton.type = "button";
  settingsButton.className = "ua-control-button";
  settingsButton.dataset.testid = "toolbar-settings-button";
  settingsButton.appendChild(createIconGear({ size: 24 }));

  const divider = document.createElement("div");
  divider.className = "ua-divider";

  const exitButton = document.createElement("button");
  exitButton.type = "button";
  exitButton.className = "ua-control-button";
  exitButton.dataset.testid = "toolbar-exit-button";
  exitButton.appendChild(createIconXmarkLarge({ size: 24 }));

  controlsContent.appendChild(pauseButton);
  controlsContent.appendChild(markersButton);
  controlsContent.appendChild(copyButton);
  controlsContent.appendChild(clearButton);
  controlsContent.appendChild(settingsButton);
  controlsContent.appendChild(divider);
  controlsContent.appendChild(exitButton);

  toolbarContainer.appendChild(toggleContent);
  toolbarContainer.appendChild(controlsContent);

  const settingsPanel = document.createElement("div");
  settingsPanel.className = "ua-settings-panel ua-exit";
  settingsPanel.dataset.uiAnnotator = "true";
  settingsPanel.dataset.testid = "settings-panel";
  toolbarContainer.appendChild(settingsPanel);

  const settingsHeader = document.createElement("div");
  settingsHeader.className = "ua-settings-header";
  const settingsBrand = document.createElement("span");
  settingsBrand.className = "ua-settings-brand";
  const settingsBrandSlash = document.createElement("span");
  settingsBrandSlash.className = "ua-settings-brand-slash";
  settingsBrandSlash.textContent = "/";
  settingsBrand.appendChild(settingsBrandSlash);
  settingsBrand.appendChild(
    document.createTextNode(` ${t("settings.brandName")}`),
  );
  const settingsVersion = document.createElement("span");
  settingsVersion.className = "ua-settings-version";
  settingsVersion.textContent = `${t("settings.versionLabel")} ${packageInfo.version}`;
  const themeToggle = document.createElement("button");
  themeToggle.className = "ua-theme-toggle";
  themeToggle.type = "button";
  themeToggle.dataset.testid = "settings-theme-toggle";
  themeToggle.appendChild(createIconSun({ size: 14 }));
  settingsHeader.appendChild(settingsBrand);
  settingsHeader.appendChild(settingsVersion);
  settingsHeader.appendChild(themeToggle);
  settingsPanel.appendChild(settingsHeader);

  const outputSection = document.createElement("div");
  outputSection.className = "ua-settings-section";
  const outputRow = document.createElement("div");
  outputRow.className = "ua-settings-row";
  const outputLabel = document.createElement("div");
  outputLabel.className = "ua-settings-label";
  outputLabel.textContent = t("settings.outputDetail");
  const outputHelp = document.createElement("span");
  outputHelp.className = "ua-help-icon";
  outputHelp.appendChild(createIconHelp({ size: 20 }));
  outputLabel.appendChild(outputHelp);
  const outputCycle = document.createElement("button");
  outputCycle.className = "ua-cycle-button";
  outputCycle.type = "button";
  outputCycle.dataset.testid = "settings-output-cycle";
  const outputCycleText = document.createElement("span");
  outputCycleText.className = "ua-cycle-button-text";
  outputCycle.appendChild(outputCycleText);
  const outputCycleDots = document.createElement("span");
  outputCycleDots.className = "ua-cycle-dots";
  outputCycle.appendChild(outputCycleDots);
  outputRow.appendChild(outputLabel);
  outputRow.appendChild(outputCycle);
  outputSection.appendChild(outputRow);
  settingsPanel.appendChild(outputSection);

  const colorSection = document.createElement("div");
  colorSection.className = "ua-settings-section";
  const colorLabel = document.createElement("div");
  colorLabel.className = "ua-settings-label ua-settings-label-marker";
  colorLabel.textContent = t("settings.markerColour");
  const colorOptions = document.createElement("div");
  colorOptions.className = "ua-color-options";
  colorSection.appendChild(colorLabel);
  colorSection.appendChild(colorOptions);
  settingsPanel.appendChild(colorSection);

  const togglesSection = document.createElement("div");
  togglesSection.className = "ua-settings-section";
  settingsPanel.appendChild(togglesSection);

  const clearToggle = document.createElement("label");
  clearToggle.className = "ua-settings-toggle";
  const clearCheckbox = document.createElement("input");
  clearCheckbox.type = "checkbox";
  clearCheckbox.id = "ua-auto-clear";
  clearCheckbox.dataset.testid = "settings-auto-clear";
  const clearCustom = document.createElement("label");
  clearCustom.className = "ua-custom-checkbox";
  clearCustom.setAttribute("for", clearCheckbox.id);
  const clearLabel = document.createElement("span");
  clearLabel.className = "ua-toggle-label";
  clearLabel.textContent = t("settings.clearAfterOutput");
  const clearHelp = document.createElement("span");
  clearHelp.className = "ua-help-icon";
  clearHelp.appendChild(createIconHelp({ size: 20 }));
  clearLabel.appendChild(clearHelp);
  clearToggle.appendChild(clearCheckbox);
  clearToggle.appendChild(clearCustom);
  clearToggle.appendChild(clearLabel);

  const blockToggle = document.createElement("label");
  blockToggle.className = "ua-settings-toggle";
  const blockCheckbox = document.createElement("input");
  blockCheckbox.type = "checkbox";
  blockCheckbox.id = "ua-block-interactions";
  blockCheckbox.dataset.testid = "settings-block-interactions";
  const blockCustom = document.createElement("label");
  blockCustom.className = "ua-custom-checkbox";
  blockCustom.setAttribute("for", blockCheckbox.id);
  const blockLabel = document.createElement("span");
  blockLabel.className = "ua-toggle-label";
  blockLabel.textContent = t("settings.blockInteractions");
  blockToggle.appendChild(blockCheckbox);
  blockToggle.appendChild(blockCustom);
  blockToggle.appendChild(blockLabel);

  const screenshotToggle = document.createElement("label");
  screenshotToggle.className = "ua-settings-toggle";
  const screenshotCheckbox = document.createElement("input");
  screenshotCheckbox.type = "checkbox";
  screenshotCheckbox.id = "ua-capture-screenshots";
  screenshotCheckbox.dataset.testid = "settings-capture-screenshots";
  const screenshotCustom = document.createElement("label");
  screenshotCustom.className = "ua-custom-checkbox";
  screenshotCustom.setAttribute("for", screenshotCheckbox.id);
  const screenshotLabel = document.createElement("span");
  screenshotLabel.className = "ua-toggle-label";
  screenshotLabel.textContent = t("settings.captureScreenshots");
  screenshotToggle.appendChild(screenshotCheckbox);
  screenshotToggle.appendChild(screenshotCustom);
  screenshotToggle.appendChild(screenshotLabel);

  togglesSection.appendChild(clearToggle);
  togglesSection.appendChild(blockToggle);
  togglesSection.appendChild(screenshotToggle);

  const markersLayer = document.createElement("div");
  markersLayer.className = "ua-markers-layer";
  markersLayer.dataset.uiAnnotator = "true";
  markersLayer.dataset.testid = "markers-layer";
  const fixedMarkersLayer = document.createElement("div");
  fixedMarkersLayer.className = "ua-fixed-markers-layer";
  fixedMarkersLayer.dataset.uiAnnotator = "true";
  fixedMarkersLayer.dataset.testid = "fixed-markers-layer";

  const overlay = document.createElement("div");
  overlay.className = "ua-overlay";
  overlay.dataset.uiAnnotator = "true";
  overlay.dataset.testid = "overlay";

  const hoverHighlight = document.createElement("div");
  hoverHighlight.className = "ua-hover-highlight";
  const hoverTooltip = document.createElement("div");
  hoverTooltip.className = "ua-hover-tooltip";

  const markerOutline = document.createElement("div");
  markerOutline.className = "ua-single-outline";

  const editOutline = document.createElement("div");
  editOutline.className = "ua-single-outline";

  const pendingOutline = document.createElement("div");
  pendingOutline.className = "ua-single-outline";

  const pendingMarker = document.createElement("div");
  pendingMarker.className = "ua-marker ua-pending";
  pendingMarker.appendChild(createIconPlus({ size: 12 }));

  const dragRect = document.createElement("div");
  dragRect.className = "ua-drag-selection";
  dragRect.dataset.testid = "drag-selection";

  const highlightsContainer = document.createElement("div");
  highlightsContainer.className = "ua-highlights-container";

  hoverHighlight.style.display = "none";
  hoverTooltip.style.display = "none";
  markerOutline.style.display = "none";
  editOutline.style.display = "none";
  pendingOutline.style.display = "none";
  pendingMarker.style.display = "none";
  dragRect.style.display = "none";
  highlightsContainer.style.display = "none";

  overlay.appendChild(hoverHighlight);
  overlay.appendChild(markerOutline);
  overlay.appendChild(hoverTooltip);
  overlay.appendChild(editOutline);
  overlay.appendChild(pendingOutline);
  overlay.appendChild(pendingMarker);
  overlay.appendChild(dragRect);
  overlay.appendChild(highlightsContainer);

  root.appendChild(toolbar);
  root.appendChild(markersLayer);
  root.appendChild(fixedMarkersLayer);
  root.appendChild(overlay);

  let annotations: Annotation[] = [];
  let pendingPopup: ReturnType<typeof createAnnotationPopup> | null = null;
  let editPopup: ReturnType<typeof createAnnotationPopup> | null = null;

  function setAccentColor(color: string): void {
    root.style.setProperty("--ua-accent", color);
    settingsBrandSlash.style.color = color;
  }

  function setTheme(mode: "dark" | "light"): void {
    isDarkMode = mode === "dark";
    toolbarContainer.classList.toggle("ua-light", !isDarkMode);
    settingsPanel.classList.toggle("ua-light", !isDarkMode);
    pauseButton.classList.toggle("ua-light", !isDarkMode);
    markersButton.classList.toggle("ua-light", !isDarkMode);
    copyButton.classList.toggle("ua-light", !isDarkMode);
    clearButton.classList.toggle("ua-light", !isDarkMode);
    settingsButton.classList.toggle("ua-light", !isDarkMode);
    exitButton.classList.toggle("ua-light", !isDarkMode);
    const toggleColor = isDarkMode
      ? "rgba(255, 255, 255, 0.9)"
      : "rgba(0, 0, 0, 0.7)";
    toggleContent.style.color = toggleColor;
    toggleIcon.style.color = toggleColor;
    toggleIcon.style.display = "block";
    while (themeToggle.firstChild) {
      themeToggle.removeChild(themeToggle.firstChild);
    }
    themeToggle.appendChild(
      isDarkMode ? createIconSun({ size: 14 }) : createIconMoon({ size: 14 }),
    );
  }

  function updateOutputDetailUI(): void {
    const activeOption = OUTPUT_DETAIL_OPTIONS.find(
      function findOption(option) {
        return option.value === settings.outputDetail;
      },
    );
    outputCycleText.textContent = activeOption ? activeOption.label : "";
    outputCycleDots.innerHTML = "";
    OUTPUT_DETAIL_OPTIONS.forEach(function addDot(option) {
      const dot = document.createElement("span");
      dot.className = "ua-cycle-dot";
      if (option.value === settings.outputDetail) {
        dot.classList.add("ua-active");
      }
      outputCycleDots.appendChild(dot);
    });
  }

  function updateColorOptionsUI(): void {
    colorOptions.innerHTML = "";
    COLOR_OPTIONS.forEach(function addColorOption(option, index) {
      const ring = document.createElement("div");
      ring.className = "ua-color-option-ring";
      ring.dataset.testid = `settings-color-option-${index}`;
      if (settings.annotationColor === option.value) {
        ring.style.borderColor = option.value;
      }
      const dot = document.createElement("div");
      dot.className = "ua-color-option";
      dot.style.backgroundColor = option.value;
      ring.appendChild(dot);
      ring.title = option.label;
      ring.addEventListener("click", function handleColorClick() {
        setSettings({ annotationColor: option.value });
      });
      colorOptions.appendChild(ring);
    });
  }

  function updateToggleUI(): void {
    clearCheckbox.checked = settings.autoClearAfterCopy;
    clearCustom.classList.toggle("ua-checked", settings.autoClearAfterCopy);
    clearCustom.innerHTML = "";
    if (settings.autoClearAfterCopy) {
      clearCustom.appendChild(createIconCheckSmallAnimated({ size: 14 }));
    }
    blockCheckbox.checked = settings.blockInteractions;
    blockCustom.classList.toggle("ua-checked", settings.blockInteractions);
    blockCustom.innerHTML = "";
    if (settings.blockInteractions) {
      blockCustom.appendChild(createIconCheckSmallAnimated({ size: 14 }));
    }
    screenshotCheckbox.checked = settings.captureScreenshots;
    screenshotCustom.classList.toggle("ua-checked", settings.captureScreenshots);
    screenshotCustom.innerHTML = "";
    if (settings.captureScreenshots) {
      screenshotCustom.appendChild(createIconCheckSmallAnimated({ size: 14 }));
    }
  }

  function updateSettingsUI(): void {
    updateOutputDetailUI();
    updateColorOptionsUI();
    updateToggleUI();
  }

  function updateToolbarUI(): void {
    badge.textContent = String(annotations.length);
    badge.style.display = annotations.length > 0 ? "inline-flex" : "none";
    badge.style.backgroundColor = settings.annotationColor;

    if (isActive) {
      toolbarContainer.classList.remove("ua-collapsed");
      toolbarContainer.classList.add("ua-expanded");
      toggleContent.classList.remove("ua-visible");
      toggleContent.classList.add("ua-hidden");
      controlsContent.classList.remove("ua-hidden");
      controlsContent.classList.add("ua-visible");
    } else {
      toolbarContainer.classList.add("ua-collapsed");
      toolbarContainer.classList.remove("ua-expanded");
      toggleContent.classList.add("ua-visible");
      toggleContent.classList.remove("ua-hidden");
      controlsContent.classList.add("ua-hidden");
      controlsContent.classList.remove("ua-visible");
    }

    toolbarContainer.classList.toggle("ua-entrance", showEntranceAnimation);

    markersButton.disabled = annotations.length === 0;
    copyButton.disabled = annotations.length === 0;
    clearButton.disabled = annotations.length === 0;

    pauseButton.dataset.active = isFrozen ? "true" : "false";
    copyButton.dataset.active = copied ? "true" : "false";

    markersButton.replaceChildren(
      createIconEyeAnimated({ size: 24, isOpen: showMarkers }),
    );
    pauseButton.replaceChildren(
      createIconPausePlayAnimated({ size: 24, isPaused: isFrozen }),
    );
    copyButton.replaceChildren(
      createIconCopyAnimated({ size: 24, copied: copied }),
    );
  }

  function updateSettingsPanelVisibility(): void {
    if (toolbarPosition && toolbarPosition.y < 230) {
      settingsPanel.style.bottom = "auto";
      settingsPanel.style.top = "calc(100% + 0.5rem)";
    } else {
      settingsPanel.style.bottom = "calc(100% + 0.5rem)";
      settingsPanel.style.top = "auto";
    }
    if (showSettings) {
      showSettingsVisible = true;
      settingsPanel.classList.remove("ua-exit");
      settingsPanel.classList.add("ua-enter");
    } else if (showSettingsVisible) {
      settingsPanel.classList.remove("ua-enter");
      settingsPanel.classList.add("ua-exit");
      setTimeout(function hidePanel() {
        showSettingsVisible = false;
      }, 0);
    }
  }

  function updateToolbarPosition(): void {
    if (!toolbarPosition) return;
    const padding = 20;
    const containerRect = toolbarContainer.getBoundingClientRect();
    const containerWidth = containerRect.width || 257;
    const containerHeight = containerRect.height || 44;
    let newX = toolbarPosition.x;
    let newY = toolbarPosition.y;

    newX = Math.max(
      padding,
      Math.min(window.innerWidth - containerWidth - padding, newX),
    );
    newY = Math.max(
      padding,
      Math.min(window.innerHeight - containerHeight - padding, newY),
    );

    toolbarPosition = { x: newX, y: newY };
    toolbar.style.left = `${newX}px`;
    toolbar.style.top = `${newY}px`;
    toolbar.style.right = "auto";
    toolbar.style.bottom = "auto";
    updateSettingsPanelVisibility();
  }

  function updateMarkerVisibility(): void {
    const shouldShow = isActive && showMarkers;
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
        markersLayer.innerHTML = "";
        fixedMarkersLayer.innerHTML = "";
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
    function buildMarkerActions(options: {
      copySize: number;
      deleteIcon: (opts: { size: number }) => SVGSVGElement;
      deleteSize: number;
    }): HTMLDivElement {
      const actions = document.createElement("div");
      actions.className = "ua-marker-actions";
      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "ua-marker-action";
      copyButton.dataset.testid = "marker-action-copy";
      copyButton.dataset.action = "copy";
      copyButton.dataset.copySize = String(options.copySize);
      copyButton.appendChild(createIconCopyAnimated({ size: options.copySize }));
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "ua-marker-action";
      deleteButton.dataset.testid = "marker-action-delete";
      deleteButton.dataset.action = "delete";
      deleteButton.appendChild(options.deleteIcon({ size: options.deleteSize }));
      actions.appendChild(copyButton);
      actions.appendChild(deleteButton);
      return actions;
    }

    markerElements.forEach(function updateMarker(marker, id) {
      const annotation = annotations.find(function findAnnotation(item) {
        return item.id === id;
      });
      if (!annotation) return;
      const isHovered = !markersExiting && hoveredMarkerId === id;
      const isDeleting = deletingMarkerId === id;
      const showDeleteState = isHovered || isDeleting;
      const showActions = isHovered && !isDeleting;
      marker.classList.toggle("ua-hovered", showDeleteState);
      marker.classList.toggle("ua-actions-visible", showActions);
      marker.innerHTML = "";
      if (showActions) {
        marker.appendChild(
          buildMarkerActions({
            copySize: 12,
            deleteIcon: createIconXmark,
            deleteSize: annotation.isMultiSelect ? 18 : 16,
          }),
        );
      } else if (showDeleteState) {
        marker.appendChild(
          createIconXmark({ size: annotation.isMultiSelect ? 18 : 16 }),
        );
      } else {
        const index = annotations.findIndex(function findIndex(item) {
          return item.id === annotation.id;
        });
        const label = document.createElement("span");
        label.textContent = String(index + 1);
        marker.appendChild(label);
      }

      const existingTooltip = marker.querySelector(".ua-marker-tooltip");
      if (isHovered && !editingAnnotation) {
        if (!existingTooltip) {
          const tooltip = document.createElement("div");
          tooltip.className = "ua-marker-tooltip";
          if (!isDarkMode) tooltip.classList.add("ua-light");
          const quote = document.createElement("span");
          quote.className = "ua-marker-quote";
          const snippet = annotation.selectedText
            ? ` "${annotation.selectedText.slice(0, 30)}${annotation.selectedText.length > 30 ? "..." : ""}"`
            : "";
          quote.textContent = `${annotation.element}${snippet}`;
          const note = document.createElement("span");
          note.className = "ua-marker-note";
          note.textContent = annotation.comment;
          tooltip.appendChild(quote);
          tooltip.appendChild(note);
          marker.appendChild(tooltip);
          applyPositionStyles(tooltip, getTooltipPosition(annotation));
        }
      } else if (existingTooltip) {
        existingTooltip.remove();
      }
    });

    fixedMarkerElements.forEach(function updateFixed(marker, id) {
      const annotation = annotations.find(function findAnnotation(item) {
        return item.id === id;
      });
      if (!annotation) return;
      const isHovered = !markersExiting && hoveredMarkerId === id;
      const isDeleting = deletingMarkerId === id;
      const showDeleteState = isHovered || isDeleting;
      const showActions = isHovered && !isDeleting;
      marker.classList.toggle("ua-hovered", showDeleteState);
      marker.classList.toggle("ua-actions-visible", showActions);
      marker.innerHTML = "";
      if (showActions) {
        marker.appendChild(
          buildMarkerActions({
            copySize: 10,
            deleteIcon: createIconClose,
            deleteSize: annotation.isMultiSelect ? 12 : 10,
          }),
        );
      } else if (showDeleteState) {
        marker.appendChild(
          createIconClose({ size: annotation.isMultiSelect ? 12 : 10 }),
        );
      } else {
        const index = annotations.findIndex(function findIndex(item) {
          return item.id === annotation.id;
        });
        const label = document.createElement("span");
        label.textContent = String(index + 1);
        marker.appendChild(label);
      }

      const existingTooltip = marker.querySelector(".ua-marker-tooltip");
      if (isHovered && !editingAnnotation) {
        if (!existingTooltip) {
          const tooltip = document.createElement("div");
          tooltip.className = "ua-marker-tooltip";
          if (!isDarkMode) tooltip.classList.add("ua-light");
          const quote = document.createElement("span");
          quote.className = "ua-marker-quote";
          const snippet = annotation.selectedText
            ? ` "${annotation.selectedText.slice(0, 30)}${annotation.selectedText.length > 30 ? "..." : ""}"`
            : "";
          quote.textContent = `${annotation.element}${snippet}`;
          const note = document.createElement("span");
          note.className = "ua-marker-note";
          note.textContent = annotation.comment;
          tooltip.appendChild(quote);
          tooltip.appendChild(note);
          marker.appendChild(tooltip);
          applyPositionStyles(tooltip, getTooltipPosition(annotation));
        }
      } else if (existingTooltip) {
        existingTooltip.remove();
      }
    });
  }

  function updateMarkerOutline(): void {
    if (editingAnnotation) {
      editOutline.style.display = "none";
      return;
    }
    if (!hoveredMarkerId || pendingAnnotation || isDragging) {
      editOutline.style.display = "none";
      return;
    }
    const hoveredAnnotation = annotations.find(function findAnnotation(item) {
      return item.id === hoveredMarkerId;
    });
    if (!hoveredAnnotation || !hoveredAnnotation.boundingBox) {
      markerOutline.style.display = "none";
      return;
    }

    const box = hoveredAnnotation.boundingBox;
    markerOutline.className = hoveredAnnotation.isMultiSelect
      ? "ua-multi-outline ua-enter"
      : "ua-single-outline ua-enter";
    markerOutline.style.display = "block";
    markerOutline.style.left = `${box.x}px`;
    markerOutline.style.top = `${box.y - scrollY}px`;
    markerOutline.style.width = `${box.width}px`;
    markerOutline.style.height = `${box.height}px`;
    if (!hoveredAnnotation.isMultiSelect) {
      markerOutline.style.borderColor = `${settings.annotationColor}99`;
      markerOutline.style.backgroundColor = `${settings.annotationColor}0D`;
    }
  }

  function renderMarkers(): void {
    if (!markersVisible) return;

    markersLayer.innerHTML = "";
    fixedMarkersLayer.innerHTML = "";
    markerElements.clear();
    fixedMarkerElements.clear();

    const visibleAnnotations = annotations.filter(
      function filterAnnotation(item) {
        return !exitingMarkers.has(item.id);
      },
    );

    visibleAnnotations.forEach(function renderAnnotation(annotation, index) {
      const marker = document.createElement("div");
      marker.className = "ua-marker";
      marker.dataset.annotationMarker = "true";
      marker.style.left = `${annotation.x}%`;
      marker.style.top = `${annotation.isFixed ? annotation.y : annotation.y}px`;
      if (!annotation.isFixed) {
        marker.style.position = "absolute";
      }
      if (annotation.isFixed) {
        marker.classList.add("ua-fixed");
        marker.style.position = "fixed";
      }
      if (annotation.isMultiSelect) {
        marker.classList.add("ua-multi");
      }

      const markerColor = annotation.isMultiSelect
        ? "#34C759"
        : settings.annotationColor;
      marker.style.backgroundColor = markerColor;

      const globalIndex = annotations.findIndex(function findIndex(item) {
        return item.id === annotation.id;
      });
      marker.dataset.testid = `annotation-marker-${globalIndex + 1}`;
      const needsEnterAnimation = !animatedMarkers.has(annotation.id);
      if (markersExiting) {
        marker.classList.add("ua-exit");
      } else if (isClearing) {
        marker.classList.add("ua-clearing");
      } else if (needsEnterAnimation) {
        marker.classList.add("ua-enter");
      }

      const label = document.createElement("span");
      label.textContent = String(globalIndex + 1);
      marker.appendChild(label);

      if (renumberFrom !== null && globalIndex >= renumberFrom) {
        marker.classList.add("ua-renumber");
      }

      marker.addEventListener("mouseenter", function handleEnter() {
        if (markersExiting) return;
        if (annotation.id === recentlyAddedId) return;
        setHoverMarker(annotation.id);
      });
      marker.addEventListener("mouseleave", function handleLeave() {
        setHoverMarker(null);
      });
      marker.addEventListener("click", function handleClick(event) {
        event.stopPropagation();
        if (markersExiting) return;
        const target = event.target as HTMLElement;
        const action = target.closest(".ua-marker-action") as HTMLElement | null;
        if (action) {
          const markerAction = action.dataset.action;
          if (markerAction === "copy") {
            copySingleAnnotation(annotation);
          }
          if (markerAction === "delete") {
            deleteAnnotation(annotation.id);
          }
          return;
        }
        deleteAnnotation(annotation.id);
      });
      marker.addEventListener("contextmenu", function handleContext(event) {
        event.preventDefault();
        event.stopPropagation();
        if (!markersExiting) startEditAnnotation(annotation);
      });

      if (annotation.isFixed) {
        fixedMarkersLayer.appendChild(marker);
        fixedMarkerElements.set(annotation.id, marker);
      } else {
        markersLayer.appendChild(marker);
        markerElements.set(annotation.id, marker);
      }
    });

    if (!markersExiting) {
      updateMarkerHoverUI();
    }
  }

  function updateHoverOverlay(): void {
    if (
      hoverInfo &&
      hoverInfo.rect &&
      isActive &&
      !pendingAnnotation &&
      !isScrolling &&
      !isDragging
    ) {
      hoverHighlight.style.display = "block";
      hoverHighlight.classList.add("ua-enter");
      hoverHighlight.style.left = `${hoverInfo.rect.left}px`;
      hoverHighlight.style.top = `${hoverInfo.rect.top}px`;
      hoverHighlight.style.width = `${hoverInfo.rect.width}px`;
      hoverHighlight.style.height = `${hoverInfo.rect.height}px`;
      hoverHighlight.style.borderColor = `${settings.annotationColor}80`;
      hoverHighlight.style.backgroundColor = `${settings.annotationColor}0A`;
    } else {
      hoverHighlight.style.display = "none";
    }

    if (hoverInfo && !pendingAnnotation && !isScrolling && !isDragging) {
      hoverTooltip.style.display = "block";
      hoverTooltip.textContent = hoverInfo.element;
      hoverTooltip.style.left = `${Math.max(
        8,
        Math.min(hoverPosition.x, window.innerWidth - 100),
      )}px`;
      hoverTooltip.style.top = `${Math.max(hoverPosition.y - 32, 8)}px`;
    } else {
      hoverTooltip.style.display = "none";
    }
  }

  function updatePendingUI(): void {
    if (!pendingAnnotation) {
      pendingOutline.style.display = "none";
      pendingMarker.style.display = "none";
      return;
    }

    if (pendingAnnotation.boundingBox) {
      pendingOutline.style.display = "block";
      pendingOutline.className = pendingAnnotation.isMultiSelect
        ? "ua-multi-outline"
        : "ua-single-outline";
      pendingOutline.style.left = `${pendingAnnotation.boundingBox.x}px`;
      pendingOutline.style.top = `${pendingAnnotation.boundingBox.y - scrollY}px`;
      pendingOutline.style.width = `${pendingAnnotation.boundingBox.width}px`;
      pendingOutline.style.height = `${pendingAnnotation.boundingBox.height}px`;
      if (!pendingAnnotation.isMultiSelect) {
        pendingOutline.style.borderColor = `${settings.annotationColor}99`;
        pendingOutline.style.backgroundColor = `${settings.annotationColor}0D`;
      }
    } else {
      pendingOutline.style.display = "none";
    }

    pendingMarker.style.display = "flex";
    pendingMarker.style.left = `${pendingAnnotation.x}%`;
    pendingMarker.style.top = `${pendingAnnotation.clientY}px`;
    pendingMarker.style.backgroundColor = pendingAnnotation.isMultiSelect
      ? "#34C759"
      : settings.annotationColor;
    if (pendingExiting) {
      pendingMarker.classList.add("ua-exit");
    } else {
      pendingMarker.classList.remove("ua-exit");
    }
  }

  function queuePendingScreenshot(): void {
    if (!pendingAnnotation?.boundingBox) return;
    if (!settings.captureScreenshots) return;
    const pendingRef = pendingAnnotation;
    const screenshotPromise = captureAnnotationScreenshot(
      pendingAnnotation.boundingBox,
    );
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
          ? t("popup.placeholderArea")
          : pendingAnnotation.isMultiSelect
            ? t("popup.placeholderGroup")
            : t("popup.placeholder"),
      onSubmit: addAnnotation,
      onCancel: cancelAnnotation,
      accentColor: pendingAnnotation.isMultiSelect
        ? "#34C759"
        : settings.annotationColor,
      lightMode: !isDarkMode,
      style: {
        left: `${Math.max(
          160,
          Math.min(
            window.innerWidth - 160,
            (pendingAnnotation.x / 100) * window.innerWidth,
          ),
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
      placeholder: t("popup.placeholderEdit"),
      initialValue: editingAnnotation.comment,
      submitLabel: t("popup.submitSave"),
      onSubmit: updateAnnotation,
      onCancel: cancelEditAnnotation,
      accentColor: editingAnnotation.isMultiSelect
        ? "#34C759"
        : settings.annotationColor,
      lightMode: !isDarkMode,
      style: {
        left: `${Math.max(
          160,
          Math.min(
            window.innerWidth - 160,
            (editingAnnotation.x / 100) * window.innerWidth,
          ),
        )}px`,
        top: `${Math.max(
          20,
          Math.min(
            (editingAnnotation.isFixed
              ? editingAnnotation.y
              : editingAnnotation.y - scrollY) + 20,
            window.innerHeight - 180,
          ),
        )}px`,
      },
    });
    overlay.appendChild(editPopup.root);
  }

  function updateEditOutline(): void {
    if (!editingAnnotation || !editingAnnotation.boundingBox) {
      editOutline.style.display = "none";
      return;
    }
    const box = editingAnnotation.boundingBox;
    editOutline.className = editingAnnotation.isMultiSelect
      ? "ua-multi-outline"
      : "ua-single-outline";
    editOutline.style.display = "block";
    editOutline.style.left = `${box.x}px`;
    editOutline.style.top = `${box.y - scrollY}px`;
    editOutline.style.width = `${box.width}px`;
    editOutline.style.height = `${box.height}px`;
    if (!editingAnnotation.isMultiSelect) {
      editOutline.style.borderColor = `${settings.annotationColor}99`;
      editOutline.style.backgroundColor = `${settings.annotationColor}0D`;
    }
  }

  function updateDragUI(): void {
    if (isDragging) {
      dragRect.style.display = "block";
      highlightsContainer.style.display = "block";
    } else {
      dragRect.style.display = "none";
      highlightsContainer.style.display = "none";
    }
  }

  function setSettings(next: Partial<UiAnnotatorSettings>): void {
    settings = { ...settings, ...next };
    setAccentColor(settings.annotationColor);
    updateSettingsUI();
    updateToolbarUI();
    if (typeof window !== "undefined") {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
  }

  function setActive(next: boolean): void {
    isActive = next;
    if (!isActive) {
      pendingAnnotation = null;
      editingAnnotation = null;
      hoverInfo = null;
      showSettings = false;
      updateSettingsPanelVisibility();
      if (isFrozen) unfreezeAnimations();
      pendingPopup?.destroy();
      pendingPopup = null;
      editPopup?.destroy();
      editPopup = null;
      markerOutline.style.display = "none";
      editOutline.style.display = "none";
      pendingOutline.style.display = "none";
      pendingMarker.style.display = "none";
      overlay.style.display = "none";
    }
    if (isActive) {
      overlay.style.display = "block";
    }
    updateToolbarUI();
    updateToolbarPosition();
    updateMarkerVisibility();
    updateHoverOverlay();
    updateCursorStyles();
  }

  function freezeAnimations(): void {
    if (isFrozen) return;
    const style = document.createElement("style");
    style.id = "ui-annotator-freeze-styles";
    style.textContent =
      "*:not([data-ui-annotator]):not([data-ui-annotator] *),*:not([data-ui-annotator]):not([data-ui-annotator] *)::before,*:not([data-ui-annotator]):not([data-ui-annotator] *)::after{animation-play-state: paused !important;transition: none !important;}";
    document.head.appendChild(style);
    document.querySelectorAll("video").forEach(function pauseVideo(video) {
      if (!video.paused) {
        video.dataset.wasPaused = "false";
        video.pause();
      }
    });
    isFrozen = true;
    updateToolbarUI();
  }

  function unfreezeAnimations(): void {
    if (!isFrozen) return;
    const style = document.getElementById("ui-annotator-freeze-styles");
    if (style) style.remove();
    document.querySelectorAll("video").forEach(function resumeVideo(video) {
      if (video.dataset.wasPaused === "false") {
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
    const screenshotPromise = allowScreenshots
      ? pendingAnnotation.screenshotPromise
      : undefined;
    const newAnnotation: Annotation = {
      id: Date.now().toString(),
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
    const deletedAnnotation =
      deletedIndex >= 0 ? annotations[deletedIndex] : null;
    deletingMarkerId = id;
    exitingMarkers.add(id);
    const marker = markerElements.get(id) || fixedMarkerElements.get(id);
    if (marker) {
      marker.classList.add("ua-exit");
      marker.classList.add("ua-hovered");
      marker.classList.remove("ua-actions-visible");
      marker.innerHTML = "";
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
      editOutline.style.display = "none";
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
      editOutline.style.display = "none";
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
    if (!output) return "";

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
      '.ua-marker-action[data-action="copy"]',
    ) as HTMLButtonElement | null;
    let copyIconSize = 12;
    if (copyButton && copyButton.dataset.copySize) {
      const parsed = Number(copyButton.dataset.copySize);
      if (!Number.isNaN(parsed)) {
        copyIconSize = parsed;
      }
      copyButton.replaceChildren(
        createIconCheckSmallAnimated({ size: copyIconSize }),
      );
    }
    marker.classList.add("ua-copied");
    setTimeout(function clearCopiedMarker() {
      marker.classList.remove("ua-copied");
      if (copyButton) {
        copyButton.replaceChildren(
          createIconCopyAnimated({ size: copyIconSize }),
        );
      }
    }, 1200);
  }

  async function copySingleAnnotation(annotation: Annotation): Promise<string> {
    const output = generateOutput([annotation], pathname, settings.outputDetail);
    if (!output) return "";

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
    const existingStyle = document.getElementById("ui-annotator-cursor-styles");
    if (existingStyle) existingStyle.remove();
    if (!isActive) return;
    const style = document.createElement("style");
    style.id = "ui-annotator-cursor-styles";
    style.textContent =
      "body *{cursor:crosshair !important;}body p,body span,body h1,body h2,body h3,body h4,body h5,body h6,body li,body td,body th,body label,body blockquote,body figcaption,body caption,body legend,body dt,body dd,body pre,body code,body em,body strong,body b,body i,body u,body s,body a,body time,body address,body cite,body q,body abbr,body dfn,body mark,body small,body sub,body sup,body [contenteditable],body p *,body span *,body h1 *,body h2 *,body h3 *,body h4 *,body h5 *,body h6 *,body li *,body a *,body label *,body pre *,body code *,body blockquote *,body [contenteditable] *{cursor:text !important;}[data-ui-annotator],[data-ui-annotator] *{cursor:default !important;}[data-annotation-marker],[data-annotation-marker] *{cursor:pointer !important;}";
    document.head.appendChild(style);
  }

  function getTooltipPosition(
    annotation: Annotation,
  ): Partial<CSSStyleDeclaration> {
    const tooltipMaxWidth = 200;
    const tooltipEstimatedHeight = 80;
    const markerSize = 22;
    const gap = 10;
    const markerX = (annotation.x / 100) * window.innerWidth;
    const markerY = annotation.y;
    const styles: Partial<CSSStyleDeclaration> = {};

    const spaceBelow = window.innerHeight - markerY - markerSize - gap;
    if (spaceBelow < tooltipEstimatedHeight) {
      styles.top = "auto";
      styles.bottom = `calc(100% + ${gap}px)`;
    }

    const centerX = markerX - tooltipMaxWidth / 2;
    const edgePadding = 10;

    if (centerX < edgePadding) {
      const offset = edgePadding - centerX;
      styles.left = `calc(50% + ${offset}px)`;
    } else if (centerX + tooltipMaxWidth > window.innerWidth - edgePadding) {
      const overflow =
        centerX + tooltipMaxWidth - (window.innerWidth - edgePadding);
      styles.left = `calc(50% - ${overflow}px)`;
    }

    return styles;
  }

  function handleToolbarMouseDown(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest("button") || target.closest(".ua-settings-panel")) {
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
      toolbarContainer.classList.add("ua-dragging");
      toolbarContainer.style.transform = `scale(1.05) rotate(${dragRotation}deg)`;
      toolbarContainer.style.cursor = "grabbing";
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
    toolbarContainer.classList.remove("ua-dragging");
    toolbarContainer.style.transform = "";
    toolbarContainer.style.cursor = "";
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

  function handleMouseMove(event: MouseEvent): void {
    if (!isActive || pendingAnnotation) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-ui-annotator]")) {
      hoverInfo = null;
      updateHoverOverlay();
      return;
    }

    const elementUnder = document.elementFromPoint(
      event.clientX,
      event.clientY,
    ) as HTMLElement | null;
    if (!elementUnder || elementUnder.closest("[data-ui-annotator]")) {
      hoverInfo = null;
      updateHoverOverlay();
      return;
    }

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
    const target = event.target as HTMLElement;
    if (target.closest("[data-ui-annotator]")) return;

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

    const elementUnder = document.elementFromPoint(
      event.clientX,
      event.clientY,
    ) as HTMLElement | null;
    if (!elementUnder) return;

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
      .join("; ");

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
    const target = event.target as HTMLElement;
    if (target.closest("[data-ui-annotator]")) return;

    const textTags = new Set([
      "P",
      "SPAN",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6",
      "LI",
      "TD",
      "TH",
      "LABEL",
      "BLOCKQUOTE",
      "FIGCAPTION",
      "CAPTION",
      "LEGEND",
      "DT",
      "DD",
      "PRE",
      "CODE",
      "EM",
      "STRONG",
      "B",
      "I",
      "U",
      "S",
      "A",
      "TIME",
      "ADDRESS",
      "CITE",
      "Q",
      "ABBR",
      "DFN",
      "MARK",
      "SMALL",
      "SUB",
      "SUP",
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
      const left = Math.min(dragStart.x, event.clientX);
      const top = Math.min(dragStart.y, event.clientY);
      const width = Math.abs(event.clientX - dragStart.x);
      const height = Math.abs(event.clientY - dragStart.y);
      dragRect.style.transform = `translate(${left}px, ${top}px)`;
      dragRect.style.width = `${width}px`;
      dragRect.style.height = `${height}px`;

      const now = Date.now();
      if (now - lastElementUpdate < ELEMENT_UPDATE_THROTTLE) return;
      lastElementUpdate = now;

      const right = Math.max(dragStart.x, event.clientX);
      const bottom = Math.max(dragStart.y, event.clientY);
      const midX = (left + right) / 2;
      const midY = (top + bottom) / 2;

      const candidateElements = new Set<HTMLElement>();
      const points = [
        [left, top],
        [right, top],
        [left, bottom],
        [right, bottom],
        [midX, midY],
        [midX, top],
        [midX, bottom],
        [left, midY],
        [right, midY],
      ];

      points.forEach(function addPoint(point) {
        const elements = document.elementsFromPoint(point[0], point[1]);
        elements.forEach(function addElement(element) {
          if (element instanceof HTMLElement) {
            candidateElements.add(element);
          }
        });
      });

      const nearbyElements = document.querySelectorAll(
        "button, a, input, img, p, h1, h2, h3, h4, h5, h6, li, label, td, th, div, span, section, article, aside, nav",
      );

      nearbyElements.forEach(function addNearby(element) {
        if (!(element instanceof HTMLElement)) return;
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const centerInside =
          centerX >= left &&
          centerX <= right &&
          centerY >= top &&
          centerY <= bottom;
        const overlapX =
          Math.min(rect.right, right) - Math.max(rect.left, left);
        const overlapY =
          Math.min(rect.bottom, bottom) - Math.max(rect.top, top);
        const overlapArea =
          overlapX > 0 && overlapY > 0 ? overlapX * overlapY : 0;
        const elementArea = rect.width * rect.height;
        const overlapRatio = elementArea > 0 ? overlapArea / elementArea : 0;
        if (centerInside || overlapRatio > 0.5) {
          candidateElements.add(element);
        }
      });

      const allMatching: DOMRect[] = [];
      const meaningfulTags = new Set([
        "BUTTON",
        "A",
        "INPUT",
        "IMG",
        "P",
        "H1",
        "H2",
        "H3",
        "H4",
        "H5",
        "H6",
        "LI",
        "LABEL",
        "TD",
        "TH",
        "SECTION",
        "ARTICLE",
        "ASIDE",
        "NAV",
      ]);

      candidateElements.forEach(function addCandidate(element) {
        if (
          element.closest("[data-ui-annotator]") ||
          element.closest("[data-annotation-marker]")
        ) {
          return;
        }

        const rect = element.getBoundingClientRect();
        if (
          rect.width > window.innerWidth * 0.8 &&
          rect.height > window.innerHeight * 0.5
        ) {
          return;
        }
        if (rect.width < 10 || rect.height < 10) return;

        if (
          rect.left < right &&
          rect.right > left &&
          rect.top < bottom &&
          rect.bottom > top
        ) {
          const tagName = element.tagName;
          let shouldInclude = meaningfulTags.has(tagName);
          if (!shouldInclude && (tagName === "DIV" || tagName === "SPAN")) {
            const hasText = element.textContent
              ? element.textContent.trim().length > 0
              : false;
            const isInteractive =
              element.onclick !== null ||
              element.getAttribute("role") === "button" ||
              element.getAttribute("role") === "link" ||
              element.classList.contains("clickable") ||
              element.hasAttribute("data-clickable");
            if (
              (hasText || isInteractive) &&
              !element.querySelector("p, h1, h2, h3, h4, h5, h6, button, a")
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
        let highlight = highlightsContainer.children[
          index
        ] as HTMLDivElement | null;
        if (!highlight) {
          highlight = document.createElement("div");
          highlight.className = "ua-selected-element-highlight";
          highlightsContainer.appendChild(highlight);
        }
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
      const left = Math.min(dragStartPoint.x, event.clientX);
      const top = Math.min(dragStartPoint.y, event.clientY);
      const right = Math.max(dragStartPoint.x, event.clientX);
      const bottom = Math.max(dragStartPoint.y, event.clientY);
      const allMatching: { element: HTMLElement; rect: DOMRect }[] = [];
      const selector =
        "button, a, input, img, p, h1, h2, h3, h4, h5, h6, li, label, td, th";

      document.querySelectorAll(selector).forEach(function checkElement(el) {
        if (!(el instanceof HTMLElement)) return;
        if (
          el.closest("[data-ui-annotator]") ||
          el.closest("[data-annotation-marker]")
        )
          return;
        const rect = el.getBoundingClientRect();
        if (
          rect.width > window.innerWidth * 0.8 &&
          rect.height > window.innerHeight * 0.5
        )
          return;
        if (rect.width < 10 || rect.height < 10) return;
        if (
          rect.left < right &&
          rect.right > left &&
          rect.top < bottom &&
          rect.bottom > top
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
          .join(", ");
        const suffix =
          finalElements.length > 5
            ? t("annotation.multiSelectSuffix", {
                count: finalElements.length - 5,
              })
            : "";
        const firstElement = finalElements[0].element;
        const firstComputedStyles = getDetailedComputedStyles(firstElement);
        const firstComputedStylesStr = Object.entries(firstComputedStyles)
          .map(function mapStyle([key, value]) {
            return `${key}: ${value}`;
          })
          .join("; ");

        pendingAnnotation = {
          x: x,
          y: y,
          clientY: event.clientY,
          element: buildMultiSelectLabel(
            finalElements.length,
            elementNames,
            suffix,
          ),
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
        const width = Math.abs(right - left);
        const height = Math.abs(bottom - top);
        if (width > 20 && height > 20) {
          pendingAnnotation = {
            x: x,
            y: y,
            clientY: event.clientY,
            element: AREA_SELECTION_LABEL,
            elementPath: t("annotation.regionAt", {
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
    highlightsContainer.innerHTML = "";
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
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

  function setupThemePreference(): void {
    try {
      const savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme) {
        setTheme(savedTheme === "dark" ? "dark" : "light");
      } else if (options.initialTheme) {
        setTheme(options.initialTheme);
      } else {
        setTheme("dark");
      }
    } catch {
      setTheme(options.initialTheme || "dark");
    }
  }

  function handleToolbarClick(event: MouseEvent): void {
    if (isActive) return;
    if (justFinishedToolbarDrag) {
      event.preventDefault();
      return;
    }
    setActive(true);
    updateCursorStyles();
  }

  function attachListeners(): void {
    toolbarContainer.addEventListener("click", handleToolbarClick);
    toolbarContainer.addEventListener("mousedown", handleToolbarMouseDown);
    document.addEventListener("mousemove", handleToolbarMouseMove);
    document.addEventListener("mouseup", handleToolbarMouseUp);
    pauseButton.addEventListener("click", function handlePause(event) {
      event.stopPropagation();
      toggleFreeze();
    });
    markersButton.addEventListener("click", function handleMarkers(event) {
      event.stopPropagation();
      showMarkers = !showMarkers;
      updateMarkerVisibility();
      updateToolbarUI();
    });
    copyButton.addEventListener("click", function handleCopy(event) {
      event.stopPropagation();
      copyOutput();
    });
    clearButton.addEventListener("click", function handleClear(event) {
      event.stopPropagation();
      clearAll();
    });
    settingsButton.addEventListener("click", function handleSettings(event) {
      event.stopPropagation();
      showSettings = !showSettings;
      updateSettingsPanelVisibility();
    });
    exitButton.addEventListener("click", function handleExit(event) {
      event.stopPropagation();
      setActive(false);
      updateCursorStyles();
    });
    outputCycle.addEventListener("click", function handleOutputCycle() {
      const currentIndex = OUTPUT_DETAIL_OPTIONS.findIndex(
        function findIndex(option) {
          return option.value === settings.outputDetail;
        },
      );
      const nextIndex = (currentIndex + 1) % OUTPUT_DETAIL_OPTIONS.length;
      setSettings({ outputDetail: OUTPUT_DETAIL_OPTIONS[nextIndex].value });
    });
    clearCheckbox.addEventListener("change", function handleClearToggle() {
      setSettings({ autoClearAfterCopy: clearCheckbox.checked });
    });
    blockCheckbox.addEventListener("change", function handleBlockToggle() {
      setSettings({ blockInteractions: blockCheckbox.checked });
    });
    screenshotCheckbox.addEventListener(
      "change",
      function handleScreenshotToggle() {
        setSettings({ captureScreenshots: screenshotCheckbox.checked });
      },
    );
    themeToggle.addEventListener("click", function handleThemeToggle() {
      setTheme(isDarkMode ? "light" : "dark");
      localStorage.setItem(THEME_KEY, isDarkMode ? "dark" : "light");
      updateToolbarUI();
      updateSettingsUI();
    });
    settingsPanel.addEventListener("click", function stopPropagation(event) {
      event.stopPropagation();
    });

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseDrag, { passive: true });
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updateToolbarPosition);
  }

  function detachListeners(): void {
    toolbarContainer.removeEventListener("click", handleToolbarClick);
    toolbarContainer.removeEventListener("mousedown", handleToolbarMouseDown);
    document.removeEventListener("mousemove", handleToolbarMouseMove);
    document.removeEventListener("mouseup", handleToolbarMouseUp);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("click", handleClick, true);
    document.removeEventListener("mousedown", handleMouseDown);
    document.removeEventListener("mousemove", handleMouseDrag);
    document.removeEventListener("mouseup", handleMouseUp);
    document.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("scroll", handleScroll);
    window.removeEventListener("resize", updateToolbarPosition);
  }

  function initialize(): void {
    scrollY = window.scrollY;
    annotations = loadAnnotations(pathname, options.storageAdapter);
    setupSettingsPersistence();
    setupThemePreference();
    setAccentColor(settings.annotationColor);
    updateSettingsUI();
    updateToolbarUI();
    renderMarkers();
    updateMarkerVisibility();
    updatePendingUI();
    updateHoverOverlay();
    updateEditOutline();
    overlay.style.display = "none";

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
    root.remove();
    const cursorStyle = document.getElementById("ui-annotator-cursor-styles");
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

export function registerUiAnnotatorElement(): void {
  if (typeof customElements === "undefined") return;
  if (customElements.get("ui-annotator")) return;

  class UiAnnotatorElement extends HTMLElement {
    private instance?: UiAnnotatorInstance;

    static get observedAttributes(): string[] {
      return [
        "theme",
        "annotation-color",
        "output-detail",
        "auto-clear-after-copy",
        "block-interactions",
        "capture-screenshots",
        "z-index",
      ];
    }

    connectedCallback(): void {
      const mountTarget = document.body;
      const nextSettings: Partial<UiAnnotatorSettings> = {};
      const annotationColor = this.getAttribute("annotation-color");
      if (annotationColor) {
        nextSettings.annotationColor = annotationColor;
      }
      const outputDetail = this.getAttribute("output-detail");
      if (outputDetail) {
        nextSettings.outputDetail = outputDetail as OutputDetailLevel;
      }
      if (this.hasAttribute("auto-clear-after-copy")) {
        nextSettings.autoClearAfterCopy = true;
      }
      if (this.hasAttribute("block-interactions")) {
        nextSettings.blockInteractions = true;
      }
      const captureScreenshots = this.getAttribute("capture-screenshots");
      if (captureScreenshots !== null) {
        nextSettings.captureScreenshots = captureScreenshots !== "false";
      }
      this.instance = createUiAnnotator({
        mount: mountTarget,
        initialTheme: this.getAttribute("theme") === "light" ? "light" : "dark",
        settings: nextSettings,
        zIndex: this.getAttribute("z-index")
          ? Number(this.getAttribute("z-index"))
          : undefined,
      });
    }

    attributeChangedCallback(
      name: string,
      _oldValue: string | null,
      newValue: string | null,
    ): void {
      if (!this.instance) return;
      if (name === "annotation-color" && newValue) {
        this.instance.setSettings({ annotationColor: newValue });
      }
      if (name === "output-detail" && newValue) {
        this.instance.setSettings({
          outputDetail: newValue as OutputDetailLevel,
        });
      }
      if (name === "auto-clear-after-copy") {
        this.instance.setSettings({
          autoClearAfterCopy: this.hasAttribute("auto-clear-after-copy"),
        });
      }
      if (name === "block-interactions") {
        this.instance.setSettings({
          blockInteractions: this.hasAttribute("block-interactions"),
        });
      }
      if (name === "capture-screenshots") {
        this.instance.setSettings({
          captureScreenshots: newValue !== "false",
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

  customElements.define("ui-annotator", UiAnnotatorElement);
}
