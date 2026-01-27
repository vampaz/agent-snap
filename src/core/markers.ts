import type { Annotation } from '@/types';
import { t } from '@/utils/i18n';

type MarkerHoverOptions = {
  marker: HTMLDivElement;
  annotation: Annotation;
  annotationIndex: number;
  markersExiting: boolean;
  hoveredMarkerId: string | null;
  deletingMarkerId: string | null;
  editingAnnotation: Annotation | null;
  isDarkMode: boolean;
  copySize: number;
  deleteSize: number;
  deleteIcon: (opts: { size: number }) => SVGSVGElement;
  getTooltipPosition: (annotation: Annotation) => Partial<CSSStyleDeclaration>;
  applyInlineStyles: (element: HTMLElement, styles: Partial<CSSStyleDeclaration>) => void;
  createIconCopyAnimated: (opts: { size: number }) => SVGSVGElement;
};

export type MarkerHoverUIOptions = {
  markersExiting: boolean;
  hoveredMarkerId: string | null;
  deletingMarkerId: string | null;
  editingAnnotation: Annotation | null;
  isDarkMode: boolean;
  markerElements: Map<string, HTMLDivElement>;
  fixedMarkerElements: Map<string, HTMLDivElement>;
  getTooltipPosition: (annotation: Annotation) => Partial<CSSStyleDeclaration>;
  applyInlineStyles: (element: HTMLElement, styles: Partial<CSSStyleDeclaration>) => void;
  createIconCopyAnimated: (opts: { size: number }) => SVGSVGElement;
  createIconXmark: (opts: { size: number }) => SVGSVGElement;
  createIconClose: (opts: { size: number }) => SVGSVGElement;
  getAnnotationById: (id: string) => Annotation | null;
  getAnnotationIndex: (id: string) => number;
  markerIds?: string[];
};

export type MarkerOutlineOptions = {
  editingAnnotation: Annotation | null;
  hoveredMarkerId: string | null;
  pendingAnnotation: {
    boundingBox?: { x: number; y: number; width: number; height: number };
  } | null;
  isDragging: boolean;
  annotations: Annotation[];
  markerOutline: HTMLDivElement;
  scrollY: number;
  accentColor: string;
};

export type RenderMarkersOptions = {
  annotations: Annotation[];
  markersVisible: boolean;
  markersExiting: boolean;
  getMarkersExiting: () => boolean;
  exitingMarkers: Set<string>;
  animatedMarkers: Set<string>;
  isClearing: boolean;
  renumberFrom: number | null;
  recentlyAddedId: string | null;
  getRecentlyAddedId: () => string | null;
  markerElements: Map<string, HTMLDivElement>;
  fixedMarkerElements: Map<string, HTMLDivElement>;
  markersLayer: HTMLDivElement;
  fixedMarkersLayer: HTMLDivElement;
  onHoverMarker: (id: string | null) => void;
  onCopyAnnotation: (annotation: Annotation) => void | Promise<unknown>;
  onDeleteAnnotation: (id: string) => void;
  onEditAnnotation: (annotation: Annotation) => void;
  getTooltipPosition: (annotation: Annotation) => Partial<CSSStyleDeclaration>;
  applyInlineStyles: (element: HTMLElement, styles: Partial<CSSStyleDeclaration>) => void;
  createIconCopyAnimated: (opts: { size: number }) => SVGSVGElement;
  createIconXmark: (opts: { size: number }) => SVGSVGElement;
  createIconClose: (opts: { size: number }) => SVGSVGElement;
  accentColor: string;
  isDarkMode: boolean;
  hoveredMarkerId: string | null;
  deletingMarkerId: string | null;
  editingAnnotation: Annotation | null;
  getAnnotationById: (id: string) => Annotation | null;
  getAnnotationIndex: (id: string) => number;
};

function buildMarkerActions(options: {
  copySize: number;
  deleteIcon: (opts: { size: number }) => SVGSVGElement;
  deleteSize: number;
  createIconCopyAnimated: (opts: { size: number }) => SVGSVGElement;
}): HTMLDivElement {
  const actions = document.createElement('div');
  actions.className = 'as-marker-actions';
  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'as-marker-action';
  copyButton.dataset.testid = 'marker-action-copy';
  copyButton.dataset.action = 'copy';
  copyButton.dataset.copySize = String(options.copySize);
  copyButton.setAttribute('aria-label', t('marker.copy'));
  copyButton.appendChild(options.createIconCopyAnimated({ size: options.copySize }));
  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'as-marker-action';
  deleteButton.dataset.testid = 'marker-action-delete';
  deleteButton.dataset.action = 'delete';
  deleteButton.setAttribute('aria-label', t('marker.delete'));
  deleteButton.appendChild(options.deleteIcon({ size: options.deleteSize }));
  actions.appendChild(copyButton);
  actions.appendChild(deleteButton);
  return actions;
}

function updateMarkerTooltip(options: {
  marker: HTMLDivElement;
  annotation: Annotation;
  isHovered: boolean;
  editingAnnotation: Annotation | null;
  isDarkMode: boolean;
  getTooltipPosition: (annotation: Annotation) => Partial<CSSStyleDeclaration>;
  applyInlineStyles: (element: HTMLElement, styles: Partial<CSSStyleDeclaration>) => void;
}): void {
  const {
    marker,
    annotation,
    isHovered,
    editingAnnotation,
    isDarkMode,
    getTooltipPosition,
    applyInlineStyles,
  } = options;
  const existingTooltip = marker.querySelector('.as-marker-tooltip');
  if (isHovered && !editingAnnotation) {
    if (!existingTooltip) {
      const tooltip = document.createElement('div');
      tooltip.className = 'as-marker-tooltip';
      if (!isDarkMode) tooltip.classList.add('as-light');
      const quote = document.createElement('span');
      quote.className = 'as-marker-quote';
      const snippet = annotation.selectedText
        ? ` "${annotation.selectedText.slice(0, 30)}${annotation.selectedText.length > 30 ? '...' : ''}"`
        : '';
      quote.textContent = `${annotation.element}${snippet}`;
      const note = document.createElement('span');
      note.className = 'as-marker-note';
      note.textContent = annotation.comment;
      tooltip.appendChild(quote);
      tooltip.appendChild(note);
      marker.appendChild(tooltip);
      applyInlineStyles(tooltip, getTooltipPosition(annotation));
    }
  } else if (existingTooltip) {
    existingTooltip.remove();
  }
}

function renderMarkerHoverState(options: MarkerHoverOptions): void {
  const {
    marker,
    annotation,
    annotationIndex,
    markersExiting,
    hoveredMarkerId,
    deletingMarkerId,
    editingAnnotation,
    isDarkMode,
    copySize,
    deleteSize,
    deleteIcon,
    getTooltipPosition,
    applyInlineStyles,
    createIconCopyAnimated,
  } = options;
  const isHovered = !markersExiting && hoveredMarkerId === annotation.id;
  const isDeleting = deletingMarkerId === annotation.id;
  const showDeleteState = isHovered || isDeleting;
  const showActions = isHovered && !isDeleting;
  marker.classList.toggle('as-hovered', showDeleteState);
  marker.classList.toggle('as-actions-visible', showActions);
  marker.innerHTML = '';
  if (showActions) {
    marker.appendChild(
      buildMarkerActions({
        copySize: copySize,
        deleteIcon: deleteIcon,
        deleteSize: deleteSize,
        createIconCopyAnimated: createIconCopyAnimated,
      }),
    );
  } else if (showDeleteState) {
    marker.appendChild(deleteIcon({ size: deleteSize }));
  } else {
    const label = document.createElement('span');
    label.textContent = String(annotationIndex + 1);
    marker.appendChild(label);
  }

  updateMarkerTooltip({
    marker: marker,
    annotation: annotation,
    isHovered: isHovered,
    editingAnnotation: editingAnnotation,
    isDarkMode: isDarkMode,
    getTooltipPosition: getTooltipPosition,
    applyInlineStyles: applyInlineStyles,
  });
}

export function updateMarkerHoverUI(options: MarkerHoverUIOptions): void {
  const {
    markersExiting,
    hoveredMarkerId,
    deletingMarkerId,
    editingAnnotation,
    isDarkMode,
    markerElements,
    fixedMarkerElements,
    getTooltipPosition,
    applyInlineStyles,
    createIconCopyAnimated,
    createIconXmark,
    createIconClose,
    getAnnotationById,
    getAnnotationIndex,
    markerIds,
  } = options;

  function updateMarkerState(
    marker: HTMLDivElement,
    id: string,
    copySize: number,
    deleteIcon: (opts: { size: number }) => SVGSVGElement,
    deleteSize: number,
  ): void {
    const annotation = getAnnotationById(id);
    if (!annotation) return;
    const annotationIndex = getAnnotationIndex(id);
    if (annotationIndex < 0) return;
    renderMarkerHoverState({
      marker: marker,
      annotation: annotation,
      annotationIndex: annotationIndex,
      markersExiting: markersExiting,
      hoveredMarkerId: hoveredMarkerId,
      deletingMarkerId: deletingMarkerId,
      editingAnnotation: editingAnnotation,
      isDarkMode: isDarkMode,
      copySize: copySize,
      deleteIcon: deleteIcon,
      deleteSize: deleteSize,
      getTooltipPosition: getTooltipPosition,
      applyInlineStyles: applyInlineStyles,
      createIconCopyAnimated: createIconCopyAnimated,
    });
  }

  if (markerIds && markerIds.length > 0) {
    markerIds.forEach(function updateMarkerById(id) {
      const marker = markerElements.get(id);
      if (marker) {
        const annotation = getAnnotationById(id);
        if (!annotation) return;
        updateMarkerState(marker, id, 12, createIconXmark, annotation.isMultiSelect ? 18 : 16);
        return;
      }
      const fixedMarker = fixedMarkerElements.get(id);
      if (fixedMarker) {
        const annotation = getAnnotationById(id);
        if (!annotation) return;
        updateMarkerState(fixedMarker, id, 10, createIconClose, annotation.isMultiSelect ? 12 : 10);
      }
    });
    return;
  }

  markerElements.forEach(function updateMarker(marker, id) {
    const annotation = getAnnotationById(id);
    if (!annotation) return;
    updateMarkerState(marker, id, 12, createIconXmark, annotation.isMultiSelect ? 18 : 16);
  });

  fixedMarkerElements.forEach(function updateFixed(marker, id) {
    const annotation = getAnnotationById(id);
    if (!annotation) return;
    updateMarkerState(marker, id, 10, createIconClose, annotation.isMultiSelect ? 12 : 10);
  });
}

export function updateMarkerOutline(options: MarkerOutlineOptions): void {
  const {
    editingAnnotation,
    hoveredMarkerId,
    pendingAnnotation,
    isDragging,
    annotations,
    markerOutline,
    scrollY,
    accentColor,
  } = options;
  if (editingAnnotation) {
    markerOutline.style.display = 'none';
    return;
  }
  if (!hoveredMarkerId || pendingAnnotation || isDragging) {
    markerOutline.style.display = 'none';
    return;
  }
  const hoveredAnnotation = annotations.find(function findAnnotation(item) {
    return item.id === hoveredMarkerId;
  });
  if (!hoveredAnnotation || !hoveredAnnotation.boundingBox) {
    markerOutline.style.display = 'none';
    return;
  }

  const box = hoveredAnnotation.boundingBox;
  markerOutline.className = hoveredAnnotation.isMultiSelect
    ? 'as-multi-outline as-enter'
    : 'as-single-outline as-enter';
  markerOutline.style.display = 'block';
  markerOutline.style.left = `${box.x}px`;
  markerOutline.style.top = `${box.y - scrollY}px`;
  markerOutline.style.width = `${box.width}px`;
  markerOutline.style.height = `${box.height}px`;
  if (!hoveredAnnotation.isMultiSelect) {
    markerOutline.style.borderColor = `${accentColor}99`;
    markerOutline.style.backgroundColor = `${accentColor}0D`;
  }
}

export function renderMarkers(options: RenderMarkersOptions): void {
  const {
    annotations,
    markersVisible,
    markersExiting,
    getMarkersExiting,
    exitingMarkers,
    animatedMarkers,
    isClearing,
    renumberFrom,
    recentlyAddedId,
    getRecentlyAddedId,
    markerElements,
    fixedMarkerElements,
    markersLayer,
    fixedMarkersLayer,
    onHoverMarker,
    onCopyAnnotation,
    onDeleteAnnotation,
    onEditAnnotation,
    getTooltipPosition,
    applyInlineStyles,
    createIconCopyAnimated,
    createIconXmark,
    createIconClose,
    accentColor,
    isDarkMode,
    hoveredMarkerId,
    deletingMarkerId,
    editingAnnotation,
    getAnnotationById,
    getAnnotationIndex,
  } = options;
  if (!markersVisible) return;

  const visibleAnnotations = annotations.filter(function filterAnnotation(item) {
    return !exitingMarkers.has(item.id);
  });
  const visibleIds = new Set(
    visibleAnnotations.map(function mapAnnotation(annotation) {
      return annotation.id;
    }),
  );

  markerElements.forEach(function removeMarker(marker, id) {
    if (!visibleIds.has(id)) {
      marker.remove();
      markerElements.delete(id);
    }
  });
  fixedMarkerElements.forEach(function removeFixed(marker, id) {
    if (!visibleIds.has(id)) {
      marker.remove();
      fixedMarkerElements.delete(id);
    }
  });

  function ensureMarker(annotationId: string): HTMLDivElement {
    const existing = markerElements.get(annotationId) || fixedMarkerElements.get(annotationId);
    if (existing) return existing;
    const marker = document.createElement('div');
    marker.className = 'as-marker';
    marker.dataset.annotationMarker = 'true';
    marker.dataset.annotationId = annotationId;
    marker.addEventListener('mouseenter', function handleEnter() {
      if (getMarkersExiting()) return;
      if (annotationId === getRecentlyAddedId()) return;
      onHoverMarker(annotationId);
    });
    marker.addEventListener('mouseleave', function handleLeave() {
      onHoverMarker(null);
    });
    marker.addEventListener('click', function handleClick(event) {
      event.stopPropagation();
      if (getMarkersExiting()) return;
      const annotation = getAnnotationById(annotationId);
      if (!annotation) return;
      const target = event.target as HTMLElement;
      const action = target.closest('.as-marker-action') as HTMLElement | null;
      if (action) {
        const markerAction = action.dataset.action;
        if (markerAction === 'copy') {
          onCopyAnnotation(annotation);
        }
        if (markerAction === 'delete') {
          onDeleteAnnotation(annotation.id);
        }
        return;
      }
      onDeleteAnnotation(annotation.id);
    });
    marker.addEventListener('contextmenu', function handleContext(event) {
      event.preventDefault();
      event.stopPropagation();
      if (getMarkersExiting()) return;
      const annotation = getAnnotationById(annotationId);
      if (!annotation) return;
      onEditAnnotation(annotation);
    });
    return marker;
  }

  visibleAnnotations.forEach(function renderAnnotation(annotation) {
    const marker = ensureMarker(annotation.id);
    const targetMap = annotation.isFixed ? fixedMarkerElements : markerElements;
    const otherMap = annotation.isFixed ? markerElements : fixedMarkerElements;
    if (otherMap.has(annotation.id)) {
      otherMap.delete(annotation.id);
    }
    if (!targetMap.has(annotation.id)) {
      targetMap.set(annotation.id, marker);
      if (annotation.isFixed) {
        fixedMarkersLayer.appendChild(marker);
      } else {
        markersLayer.appendChild(marker);
      }
    }

    const markerColor = annotation.isMultiSelect ? '#34C759' : accentColor;
    marker.style.left = `${annotation.x}%`;
    marker.style.top = `${annotation.y}px`;
    marker.style.position = annotation.isFixed ? 'fixed' : 'absolute';
    marker.style.backgroundColor = markerColor;
    marker.classList.toggle('as-fixed', annotation.isFixed);
    marker.classList.toggle('as-multi', Boolean(annotation.isMultiSelect));

    const globalIndex = getAnnotationIndex(annotation.id);
    const displayIndex = globalIndex >= 0 ? globalIndex : annotations.indexOf(annotation);
    marker.dataset.testid = `annotation-marker-${displayIndex + 1}`;

    marker.classList.toggle('as-exit', markersExiting);
    marker.classList.toggle('as-clearing', isClearing);
    marker.classList.toggle(
      'as-enter',
      !markersExiting && !isClearing && !animatedMarkers.has(annotation.id),
    );
    marker.classList.toggle('as-renumber', renumberFrom !== null && displayIndex >= renumberFrom);

    marker.innerHTML = '';
    const label = document.createElement('span');
    label.textContent = String(displayIndex + 1);
    marker.appendChild(label);
  });

  if (!markersExiting) {
    updateMarkerHoverUI({
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
      getAnnotationById: getAnnotationById,
      getAnnotationIndex: getAnnotationIndex,
    });
  }
}
