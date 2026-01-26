import type { AgentSnapSettings, OutputDetailLevel } from '@/types';
import { t } from '@/utils/i18n';
import {
  createIconCheckSmall,
  createIconCheckSmallAnimated,
  createIconCopyAnimated,
  createIconGear,
  createIconHelp,
  createIconListSparkle,
  createIconMoon,
  createIconPausePlayAnimated,
  createIconSun,
  createIconTrash,
  createIconXmarkLarge,
} from '@/icons';
import packageInfo from '../../package.json';

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

export type ToggleState = {
  autoClearAfterCopy: boolean;
  blockInteractions: boolean;
  captureScreenshots: boolean;
};

export type ToolbarElements = {
  toolbar: HTMLDivElement;
  toolbarContainer: HTMLDivElement;
  toggleContent: HTMLDivElement;
  toggleIconWrap: HTMLButtonElement;
  controlsContent: HTMLDivElement;
  badge: HTMLSpanElement;
  controlsInner: HTMLDivElement;
  pauseButton: HTMLButtonElement;
  copyButton: HTMLButtonElement;
  clearButton: HTMLButtonElement;
  settingsButton: HTMLButtonElement;
  settingsPanel: HTMLDivElement;
  outputCycle: HTMLButtonElement;
  outputCycleText: HTMLSpanElement;
  outputCycleDots: HTMLSpanElement;
  outputHelp: HTMLSpanElement;
  colorOptions: HTMLDivElement;
  themeToggle: HTMLButtonElement;
  settingsBrandSlash: HTMLSpanElement;
  clearCheckbox: HTMLInputElement;
  clearCustom: HTMLLabelElement;
  clearHelp?: HTMLSpanElement;
  blockCheckbox: HTMLInputElement;
  blockCustom: HTMLLabelElement;
  screenshotCheckbox: HTMLInputElement;
  screenshotCustom: HTMLLabelElement;
};

function createControlButton(options: {
  testid: string;
  icon: SVGSVGElement;
  danger?: boolean;
  title: string;
}): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'as-control-button';
  button.dataset.testid = options.testid;
  button.title = options.title;
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

export function createToolbarElements(): ToolbarElements {
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
  toggleIconWrap.className = 'as-toggle-button';
  toggleIconWrap.dataset.testid = 'as-toggle';
  toggleIconWrap.title = t('toolbar.toggle.open');
  toggleIconWrap.setAttribute('aria-label', t('toolbar.toggle.open'));
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
    title: t('toolbar.pause'),
    icon: createIconPausePlayAnimated({ size: 24 }),
  });
  const copyButton = createControlButton({
    testid: 'toolbar-copy-button',
    title: t('toolbar.copy'),
    icon: createIconCopyAnimated({ size: 24, copied: false }),
  });
  const clearButton = createControlButton({
    testid: 'toolbar-clear-button',
    title: t('toolbar.clear'),
    danger: true,
    icon: createIconTrash({ size: 24 }),
  });
  const settingsButton = createControlButton({
    testid: 'toolbar-settings-button',
    title: t('toolbar.settings.open'),
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
  themeToggle.title = t('toolbar.theme.light');
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
  outputCycle.title = t('toolbar.output.cycle');
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

  togglesSection.appendChild(clearToggle.wrapper);
  togglesSection.appendChild(blockToggle.wrapper);
  togglesSection.appendChild(screenshotToggle.wrapper);

  return {
    toolbar: toolbar,
    toolbarContainer: toolbarContainer,
    toggleContent: toggleContent,
    toggleIconWrap: toggleIconWrap,
    controlsContent: controlsContent,
    badge: badge,
    controlsInner: controlsInner,
    pauseButton: pauseButton,
    copyButton: copyButton,
    clearButton: clearButton,
    settingsButton: settingsButton,
    settingsPanel: settingsPanel,
    outputCycle: outputCycle,
    outputCycleText: outputCycleText,
    outputCycleDots: outputCycleDots,
    outputHelp: outputHelp,
    colorOptions: colorOptions,
    themeToggle: themeToggle,
    settingsBrandSlash: settingsBrandSlash,
    clearCheckbox: clearToggle.checkbox,
    clearCustom: clearToggle.custom,
    clearHelp: clearToggle.help,
    blockCheckbox: blockToggle.checkbox,
    blockCustom: blockToggle.custom,
    screenshotCheckbox: screenshotToggle.checkbox,
    screenshotCustom: screenshotToggle.custom,
  };
}

export function applyToolbarTheme(options: {
  elements: ToolbarElements;
  isDarkMode: boolean;
}): void {
  const { elements, isDarkMode } = options;
  elements.toolbarContainer.classList.toggle('as-light', !isDarkMode);
  elements.settingsPanel.classList.toggle('as-light', !isDarkMode);
  elements.pauseButton.classList.toggle('as-light', !isDarkMode);
  elements.copyButton.classList.toggle('as-light', !isDarkMode);
  elements.clearButton.classList.toggle('as-light', !isDarkMode);
  elements.settingsButton.classList.toggle('as-light', !isDarkMode);
  const toggleColor = isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.7)';
  elements.toggleContent.style.color = toggleColor;
  while (elements.themeToggle.firstChild) {
    elements.themeToggle.removeChild(elements.themeToggle.firstChild);
  }
  elements.themeToggle.appendChild(
    isDarkMode ? createIconSun({ size: 14 }) : createIconMoon({ size: 14 }),
  );
  elements.themeToggle.title = isDarkMode ? t('toolbar.theme.light') : t('toolbar.theme.dark');
}

export function updateOutputDetailUI(options: {
  elements: ToolbarElements;
  settings: AgentSnapSettings;
}): void {
  const { elements, settings } = options;
  const activeOption = OUTPUT_DETAIL_OPTIONS.find(function findOption(option) {
    return option.value === settings.outputDetail;
  });
  elements.outputCycleText.textContent = activeOption ? activeOption.label : '';
  elements.outputCycleDots.innerHTML = '';
  OUTPUT_DETAIL_OPTIONS.forEach(function addDot(option) {
    const dot = document.createElement('span');
    dot.className = 'as-cycle-dot';
    if (option.value === settings.outputDetail) {
      dot.classList.add('as-active');
    }
    elements.outputCycleDots.appendChild(dot);
  });
}

export function updateColorOptionsUI(options: {
  elements: ToolbarElements;
  settings: AgentSnapSettings;
  onSelectColor: (color: string) => void;
}): void {
  const { elements, settings, onSelectColor } = options;
  elements.colorOptions.innerHTML = '';
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
      onSelectColor(option.value);
    });
    elements.colorOptions.appendChild(ring);
  });
}

export function updateToggleUI(options: {
  elements: ToolbarElements;
  settings: AgentSnapSettings;
  lastToggleState: ToggleState;
}): ToggleState {
  const { elements, settings, lastToggleState } = options;
  elements.clearCheckbox.checked = settings.autoClearAfterCopy;
  elements.clearCustom.classList.toggle('as-checked', settings.autoClearAfterCopy);
  elements.clearCustom.innerHTML = '';
  if (settings.autoClearAfterCopy) {
    elements.clearCustom.appendChild(
      lastToggleState.autoClearAfterCopy
        ? createIconCheckSmall({ size: 14 })
        : createIconCheckSmallAnimated({ size: 14 }),
    );
  }
  elements.blockCheckbox.checked = settings.blockInteractions;
  elements.blockCustom.classList.toggle('as-checked', settings.blockInteractions);
  elements.blockCustom.innerHTML = '';
  if (settings.blockInteractions) {
    elements.blockCustom.appendChild(
      lastToggleState.blockInteractions
        ? createIconCheckSmall({ size: 14 })
        : createIconCheckSmallAnimated({ size: 14 }),
    );
  }
  elements.screenshotCheckbox.checked = settings.captureScreenshots;
  elements.screenshotCustom.classList.toggle('as-checked', settings.captureScreenshots);
  elements.screenshotCustom.innerHTML = '';
  if (settings.captureScreenshots) {
    elements.screenshotCustom.appendChild(
      lastToggleState.captureScreenshots
        ? createIconCheckSmall({ size: 14 })
        : createIconCheckSmallAnimated({ size: 14 }),
    );
  }
  return {
    autoClearAfterCopy: settings.autoClearAfterCopy,
    blockInteractions: settings.blockInteractions,
    captureScreenshots: settings.captureScreenshots,
  };
}

export function updateSettingsUI(options: {
  elements: ToolbarElements;
  settings: AgentSnapSettings;
  lastToggleState: ToggleState;
  onSelectColor: (color: string) => void;
}): ToggleState {
  updateOutputDetailUI({ elements: options.elements, settings: options.settings });
  updateColorOptionsUI({
    elements: options.elements,
    settings: options.settings,
    onSelectColor: options.onSelectColor,
  });
  return updateToggleUI({
    elements: options.elements,
    settings: options.settings,
    lastToggleState: options.lastToggleState,
  });
}

export function updateToolbarUI(options: {
  elements: ToolbarElements;
  annotationsCount: number;
  isActive: boolean;
  showEntranceAnimation: boolean;
  isFrozen: boolean;
  copied: boolean;
  accentColor: string;
}): void {
  const {
    elements,
    annotationsCount,
    isActive,
    showEntranceAnimation,
    isFrozen,
    copied,
    accentColor,
  } = options;
  elements.badge.textContent = String(annotationsCount);
  elements.badge.style.display = annotationsCount > 0 ? 'inline-flex' : 'none';
  elements.badge.style.backgroundColor = accentColor;

  if (isActive) {
    elements.toolbarContainer.classList.remove('as-collapsed');
    elements.toolbarContainer.classList.add('as-expanded');
    elements.toggleContent.classList.add('as-visible');
    elements.toggleContent.classList.remove('as-hidden');
    elements.controlsContent.classList.remove('as-hidden');
    elements.controlsContent.classList.add('as-visible');
  } else {
    elements.toolbarContainer.classList.add('as-collapsed');
    elements.toolbarContainer.classList.remove('as-expanded');
    elements.toggleContent.classList.add('as-visible');
    elements.toggleContent.classList.remove('as-hidden');
    elements.controlsContent.classList.add('as-hidden');
    elements.controlsContent.classList.remove('as-visible');
  }

  elements.toolbarContainer.classList.toggle('as-entrance', showEntranceAnimation);

  elements.copyButton.disabled = annotationsCount === 0;
  elements.clearButton.disabled = annotationsCount === 0;

  elements.toggleIconWrap.replaceChildren(
    isActive ? createIconXmarkLarge({ size: 24 }) : createIconListSparkle({ size: 24 }),
  );

  elements.pauseButton.dataset.active = isFrozen ? 'true' : 'false';
  elements.copyButton.dataset.active = copied ? 'true' : 'false';
  elements.pauseButton.title = isFrozen ? t('toolbar.resume') : t('toolbar.pause');
  const toggleLabel = isActive ? t('toolbar.toggle.close') : t('toolbar.toggle.open');
  elements.toggleIconWrap.title = toggleLabel;
  elements.toggleIconWrap.setAttribute('aria-label', toggleLabel);

  elements.pauseButton.replaceChildren(
    createIconPausePlayAnimated({ size: 24, isPaused: isFrozen }),
  );
  elements.copyButton.replaceChildren(createIconCopyAnimated({ size: 24, copied: copied }));
}

export function updateSettingsPanelVisibility(options: {
  elements: ToolbarElements;
  showSettings: boolean;
  showSettingsVisible: boolean;
  onHideComplete?: () => void;
}): boolean {
  const { elements, showSettings, showSettingsVisible, onHideComplete } = options;
  elements.settingsButton.dataset.active = showSettings ? 'true' : 'false';
  elements.settingsButton.title = showSettings
    ? t('toolbar.settings.close')
    : t('toolbar.settings.open');

  const rect = elements.toolbarContainer.getBoundingClientRect();
  const panelWidth = 280;
  const spaceLeft = rect.left;

  elements.settingsPanel.style.top = '';
  elements.settingsPanel.style.bottom = '';
  elements.settingsPanel.style.left = '';
  elements.settingsPanel.style.right = '';

  const placeLeft = spaceLeft > panelWidth;
  if (placeLeft) {
    elements.settingsPanel.style.right = 'calc(100% + 12px)';
  } else {
    elements.settingsPanel.style.left = 'calc(100% + 12px)';
  }

  const isMenuUp = elements.toolbarContainer.dataset.menu === 'up';
  if (isMenuUp) {
    elements.settingsPanel.style.bottom = '0';
    elements.settingsPanel.style.top = 'auto';
    elements.settingsPanel.style.transformOrigin = placeLeft ? 'bottom right' : 'bottom left';
  } else {
    elements.settingsPanel.style.top = '0';
    elements.settingsPanel.style.bottom = 'auto';
    elements.settingsPanel.style.transformOrigin = placeLeft ? 'top right' : 'top left';
  }

  if (showSettings) {
    elements.settingsPanel.style.display = 'block';
    elements.settingsPanel.classList.remove('as-exit');
    elements.settingsPanel.classList.add('as-enter');
    return true;
  }

  if (showSettingsVisible) {
    elements.settingsPanel.classList.remove('as-enter');
    elements.settingsPanel.classList.add('as-exit');
    setTimeout(function hidePanel() {
      if (!showSettings) {
        elements.settingsPanel.style.display = 'none';
        if (onHideComplete) {
          onHideComplete();
        }
      }
    }, 120);
    return true;
  }

  return false;
}

export function updateToolbarMenuDirection(options: { elements: ToolbarElements }): void {
  const { elements } = options;
  const rect = elements.toolbarContainer.getBoundingClientRect();
  const toolbarHeight = rect.height || 44;
  const menuGap = 8;
  const menuPadding = 8;
  const itemCount = elements.controlsInner.children.length;
  const estimatedItemsHeight =
    itemCount * 34 + Math.max(0, itemCount - 1) * menuGap + menuPadding * 2;
  const estimatedHeight = toolbarHeight + estimatedItemsHeight;
  const spaceAbove = rect.top;
  const spaceBelow = window.innerHeight - rect.bottom;
  const shouldOpenUp = spaceBelow < estimatedHeight + 16 && spaceAbove > spaceBelow;
  elements.toolbarContainer.dataset.menu = shouldOpenUp ? 'up' : 'down';
  elements.toolbarContainer.style.setProperty('--as-toolbar-menu-size', `${estimatedHeight}px`);
  elements.toolbarContainer.style.setProperty(
    '--as-toolbar-menu-items-max',
    `${estimatedItemsHeight}px`,
  );
  elements.toolbarContainer.style.setProperty('--as-toolbar-menu-cap', '0px');
}

export function getNextOutputDetail(current: OutputDetailLevel): OutputDetailLevel {
  const currentIndex = OUTPUT_DETAIL_OPTIONS.findIndex(function findIndex(option) {
    return option.value === current;
  });
  const nextIndex = (currentIndex + 1) % OUTPUT_DETAIL_OPTIONS.length;
  return OUTPUT_DETAIL_OPTIONS[nextIndex].value;
}
