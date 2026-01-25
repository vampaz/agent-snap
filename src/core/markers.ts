import type { Annotation } from '@/types';

type MarkerHoverOptions = {
  marker: HTMLDivElement;
  annotation: Annotation;
  annotations: Annotation[];
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
  annotations: Annotation[];
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
};

export type MarkerOutlineOptions = {
  editingAnnotation: Annotation | null;
  hoveredMarkerId: string | null;
  pendingAnnotation: { boundingBox?: { x: number; y: number; width: number; height: number } } | null;
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
  copyButton.appendChild(options.createIconCopyAnimated({ size: options.copySize }));
  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'as-marker-action';
  deleteButton.dataset.testid = 'marker-action-delete';
  deleteButton.dataset.action = 'delete';
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
  const { marker, annotation, isHovered, editingAnnotation, isDarkMode, getTooltipPosition, applyInlineStyles } =
    options;
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
    annotations,
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
    const index = annotations.findIndex(function findIndex(item) {
      return item.id === annotation.id;
    });
    const label = document.createElement('span');
    label.textContent = String(index + 1);
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
    annotations,
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
  } = options;

  markerElements.forEach(function updateMarker(marker, id) {
    const annotation = annotations.find(function findAnnotation(item) {
      return item.id === id;
    });
    if (!annotation) return;
    renderMarkerHoverState({
      marker: marker,
      annotation: annotation,
      annotations: annotations,
      markersExiting: markersExiting,
      hoveredMarkerId: hoveredMarkerId,
      deletingMarkerId: deletingMarkerId,
      editingAnnotation: editingAnnotation,
      isDarkMode: isDarkMode,
      copySize: 12,
      deleteIcon: createIconXmark,
      deleteSize: annotation.isMultiSelect ? 18 : 16,
      getTooltipPosition: getTooltipPosition,
      applyInlineStyles: applyInlineStyles,
      createIconCopyAnimated: createIconCopyAnimated,
    });
  });

  fixedMarkerElements.forEach(function updateFixed(marker, id) {
    const annotation = annotations.find(function findAnnotation(item) {
      return item.id === id;
    });
    if (!annotation) return;
    renderMarkerHoverState({
      marker: marker,
      annotation: annotation,
      annotations: annotations,
      markersExiting: markersExiting,
      hoveredMarkerId: hoveredMarkerId,
      deletingMarkerId: deletingMarkerId,
      editingAnnotation: editingAnnotation,
      isDarkMode: isDarkMode,
      copySize: 10,
      deleteIcon: createIconClose,
      deleteSize: annotation.isMultiSelect ? 12 : 10,
      getTooltipPosition: getTooltipPosition,
      applyInlineStyles: applyInlineStyles,
      createIconCopyAnimated: createIconCopyAnimated,
    });
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
  } = options;
  if (!markersVisible) return;

  markersLayer.innerHTML = '';
  fixedMarkersLayer.innerHTML = '';
  markerElements.clear();
  fixedMarkerElements.clear();

  const visibleAnnotations = annotations.filter(function filterAnnotation(item) {
    return !exitingMarkers.has(item.id);
  });

  visibleAnnotations.forEach(function renderAnnotation(annotation) {
    const marker = document.createElement('div');
    marker.className = 'as-marker';
    marker.dataset.annotationMarker = 'true';
    marker.style.left = `${annotation.x}%`;
    marker.style.top = `${annotation.isFixed ? annotation.y : annotation.y}px`;
    if (!annotation.isFixed) {
      marker.style.position = 'absolute';
    }
    if (annotation.isFixed) {
      marker.classList.add('as-fixed');
      marker.style.position = 'fixed';
    }
    if (annotation.isMultiSelect) {
      marker.classList.add('as-multi');
    }

    const markerColor = annotation.isMultiSelect ? '#34C759' : accentColor;
    marker.style.backgroundColor = markerColor;

    const globalIndex = annotations.findIndex(function findIndex(item) {
      return item.id === annotation.id;
    });
    marker.dataset.testid = `annotation-marker-${globalIndex + 1}`;
    const needsEnterAnimation = !animatedMarkers.has(annotation.id);
    if (markersExiting) {
      marker.classList.add('as-exit');
    } else if (isClearing) {
      marker.classList.add('as-clearing');
    } else if (needsEnterAnimation) {
      marker.classList.add('as-enter');
    }

    const label = document.createElement('span');
    label.textContent = String(globalIndex + 1);
    marker.appendChild(label);

    if (renumberFrom !== null && globalIndex >= renumberFrom) {
      marker.classList.add('as-renumber');
    }

    marker.addEventListener('mouseenter', function handleEnter() {
      if (getMarkersExiting()) return;
      if (annotation.id === getRecentlyAddedId()) return;
      onHoverMarker(annotation.id);
    });
    marker.addEventListener('mouseleave', function handleLeave() {
      onHoverMarker(null);
    });
    marker.addEventListener('click', function handleClick(event) {
      event.stopPropagation();
      if (getMarkersExiting()) return;
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
      if (!getMarkersExiting()) onEditAnnotation(annotation);
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
    updateMarkerHoverUI({
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
}
