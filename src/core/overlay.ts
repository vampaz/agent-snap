import type { Annotation } from '@/types';

export type HoverInfo = {
  element: string;
  rect: DOMRect | null;
};

export type OverlayPendingAnnotation = {
  x: number;
  clientY: number;
  isMultiSelect?: boolean;
  boundingBox?: { x: number; y: number; width: number; height: number };
};

export type OverlayElements = {
  overlay: HTMLDivElement;
  hoverHighlight: HTMLDivElement;
  hoverTooltip: HTMLDivElement;
  markerOutline: HTMLDivElement;
  editOutline: HTMLDivElement;
  pendingOutline: HTMLDivElement;
  pendingMarker: HTMLDivElement;
  dragRect: HTMLDivElement;
  highlightsContainer: HTMLDivElement;
};

export function createOverlayElements(): OverlayElements {
  const overlay = document.createElement('div');
  overlay.className = 'as-overlay';

  const hoverHighlight = document.createElement('div');
  hoverHighlight.className = 'as-hover-highlight';

  const hoverTooltip = document.createElement('div');
  hoverTooltip.className = 'as-hover-tooltip';

  const markerOutline = document.createElement('div');
  markerOutline.className = 'as-single-outline';

  const editOutline = document.createElement('div');
  editOutline.className = 'as-single-outline';

  const pendingOutline = document.createElement('div');
  pendingOutline.className = 'as-single-outline';

  const pendingMarker = document.createElement('div');
  pendingMarker.className = 'as-marker as-pending';

  const dragRect = document.createElement('div');
  dragRect.className = 'as-drag-selection';

  const highlightsContainer = document.createElement('div');
  highlightsContainer.className = 'as-highlights-container';

  hoverHighlight.style.display = 'none';
  hoverTooltip.style.display = 'none';
  markerOutline.style.display = 'none';
  editOutline.style.display = 'none';
  pendingOutline.style.display = 'none';
  pendingMarker.style.display = 'none';
  dragRect.style.display = 'none';
  highlightsContainer.style.display = 'none';

  overlay.appendChild(hoverHighlight);
  overlay.appendChild(markerOutline);
  overlay.appendChild(hoverTooltip);
  overlay.appendChild(editOutline);
  overlay.appendChild(pendingOutline);
  overlay.appendChild(pendingMarker);
  overlay.appendChild(dragRect);
  overlay.appendChild(highlightsContainer);

  return {
    overlay,
    hoverHighlight,
    hoverTooltip,
    markerOutline,
    editOutline,
    pendingOutline,
    pendingMarker,
    dragRect,
    highlightsContainer,
  };
}

export function updateHoverOverlay(options: {
  hoverInfo: HoverInfo | null;
  hoverPosition: { x: number; y: number };
  isActive: boolean;
  pendingAnnotation: OverlayPendingAnnotation | null;
  isScrolling: boolean;
  isDragging: boolean;
  accentColor: string;
  hoverHighlight: HTMLDivElement;
  hoverTooltip: HTMLDivElement;
}): void {
  const {
    hoverInfo,
    hoverPosition,
    isActive,
    pendingAnnotation,
    isScrolling,
    isDragging,
    accentColor,
    hoverHighlight,
    hoverTooltip,
  } = options;

  if (
    hoverInfo &&
    hoverInfo.rect &&
    isActive &&
    !pendingAnnotation &&
    !isScrolling &&
    !isDragging
  ) {
    hoverHighlight.style.display = 'block';
    hoverHighlight.classList.add('as-enter');
    hoverHighlight.style.left = `${hoverInfo.rect.left}px`;
    hoverHighlight.style.top = `${hoverInfo.rect.top}px`;
    hoverHighlight.style.width = `${hoverInfo.rect.width}px`;
    hoverHighlight.style.height = `${hoverInfo.rect.height}px`;
    hoverHighlight.style.borderColor = `${accentColor}80`;
    hoverHighlight.style.backgroundColor = `${accentColor}0A`;
  } else {
    hoverHighlight.style.display = 'none';
  }

  if (hoverInfo && !pendingAnnotation && !isScrolling && !isDragging) {
    hoverTooltip.style.display = 'block';
    hoverTooltip.textContent = hoverInfo.element;
    hoverTooltip.style.left = `${Math.max(8, Math.min(hoverPosition.x, window.innerWidth - 100))}px`;
    hoverTooltip.style.top = `${Math.max(hoverPosition.y - 32, 8)}px`;
  } else {
    hoverTooltip.style.display = 'none';
  }
}

export function updatePendingUI(options: {
  pendingAnnotation: OverlayPendingAnnotation | null;
  scrollY: number;
  accentColor: string;
  pendingExiting: boolean;
  pendingOutline: HTMLDivElement;
  pendingMarker: HTMLDivElement;
}): void {
  const { pendingAnnotation, scrollY, accentColor, pendingExiting, pendingOutline, pendingMarker } =
    options;

  if (!pendingAnnotation) {
    pendingOutline.style.display = 'none';
    pendingMarker.style.display = 'none';
    return;
  }

  if (pendingAnnotation.boundingBox) {
    pendingOutline.style.display = 'block';
    pendingOutline.className = pendingAnnotation.isMultiSelect
      ? 'as-multi-outline'
      : 'as-single-outline';
    pendingOutline.style.left = `${pendingAnnotation.boundingBox.x}px`;
    pendingOutline.style.top = `${pendingAnnotation.boundingBox.y - scrollY}px`;
    pendingOutline.style.width = `${pendingAnnotation.boundingBox.width}px`;
    pendingOutline.style.height = `${pendingAnnotation.boundingBox.height}px`;
    if (!pendingAnnotation.isMultiSelect) {
      pendingOutline.style.borderColor = `${accentColor}99`;
      pendingOutline.style.backgroundColor = `${accentColor}0D`;
    }
  } else {
    pendingOutline.style.display = 'none';
  }

  pendingMarker.style.display = 'flex';
  pendingMarker.style.left = `${pendingAnnotation.x}%`;
  pendingMarker.style.top = `${pendingAnnotation.clientY}px`;
  pendingMarker.style.backgroundColor = pendingAnnotation.isMultiSelect ? '#34C759' : accentColor;
  if (pendingExiting) {
    pendingMarker.classList.add('as-exit');
  } else {
    pendingMarker.classList.remove('as-exit');
  }
}

export function updateEditOutline(options: {
  editingAnnotation: Annotation | null;
  scrollY: number;
  accentColor: string;
  editOutline: HTMLDivElement;
}): void {
  const { editingAnnotation, scrollY, accentColor, editOutline } = options;
  if (!editingAnnotation || !editingAnnotation.boundingBox) {
    editOutline.style.display = 'none';
    return;
  }
  const box = editingAnnotation.boundingBox;
  editOutline.className = editingAnnotation.isMultiSelect
    ? 'as-multi-outline'
    : 'as-single-outline';
  editOutline.style.display = 'block';
  editOutline.style.left = `${box.x}px`;
  editOutline.style.top = `${box.y - scrollY}px`;
  editOutline.style.width = `${box.width}px`;
  editOutline.style.height = `${box.height}px`;
  if (!editingAnnotation.isMultiSelect) {
    editOutline.style.borderColor = `${accentColor}99`;
    editOutline.style.backgroundColor = `${accentColor}0D`;
  }
}

export function updateDragUI(options: {
  isDragging: boolean;
  dragRect: HTMLDivElement;
  highlightsContainer: HTMLDivElement;
}): void {
  const { isDragging, dragRect, highlightsContainer } = options;
  if (isDragging) {
    dragRect.style.display = 'block';
    highlightsContainer.style.display = 'block';
  } else {
    dragRect.style.display = 'none';
    highlightsContainer.style.display = 'none';
  }
}
