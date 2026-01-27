import { describe, expect, it } from 'vitest';

import type { Annotation } from '@/types';
import { renderMarkers, updateMarkerHoverUI, updateMarkerOutline } from '@/core/markers';

function buildAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: overrides.id ?? 'a-1',
    x: overrides.x ?? 25,
    y: overrides.y ?? 120,
    comment: overrides.comment ?? 'Note',
    element: overrides.element ?? 'Button',
    elementPath: overrides.elementPath ?? 'body > button',
    timestamp: overrides.timestamp ?? Date.now(),
    isMultiSelect: overrides.isMultiSelect,
    isFixed: overrides.isFixed,
    boundingBox: overrides.boundingBox,
    selectedText: overrides.selectedText,
  };
}

function createSvgIcon(): SVGSVGElement {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
}

describe('markers', function () {
  it('hides the marker outline when it should not render', function () {
    const markerOutline = document.createElement('div');
    markerOutline.style.display = 'block';

    updateMarkerOutline({
      editingAnnotation: buildAnnotation({ id: 'edit' }),
      hoveredMarkerId: 'edit',
      pendingAnnotation: null,
      isDragging: false,
      annotations: [buildAnnotation({ id: 'edit' })],
      markerOutline: markerOutline,
      scrollY: 0,
      accentColor: '#3c82f7',
    });

    expect(markerOutline.style.display).toBe('none');

    updateMarkerOutline({
      editingAnnotation: null,
      hoveredMarkerId: 'hover',
      pendingAnnotation: { boundingBox: { x: 0, y: 0, width: 10, height: 10 } },
      isDragging: false,
      annotations: [buildAnnotation({ id: 'hover' })],
      markerOutline: markerOutline,
      scrollY: 0,
      accentColor: '#3c82f7',
    });

    expect(markerOutline.style.display).toBe('none');
  });

  it('positions the marker outline based on the hovered annotation', function () {
    const markerOutline = document.createElement('div');
    const annotation = buildAnnotation({
      id: 'hovered',
      boundingBox: { x: 40, y: 300, width: 120, height: 50 },
    });

    updateMarkerOutline({
      editingAnnotation: null,
      hoveredMarkerId: 'hovered',
      pendingAnnotation: null,
      isDragging: false,
      annotations: [annotation],
      markerOutline: markerOutline,
      scrollY: 100,
      accentColor: '#34C759',
    });

    expect(markerOutline.style.display).toBe('block');
    expect(markerOutline.style.left).toBe('40px');
    expect(markerOutline.style.top).toBe('200px');
    expect(markerOutline.style.width).toBe('120px');
    expect(markerOutline.style.height).toBe('50px');
    expect(markerOutline.classList.contains('as-single-outline')).toBe(true);
  });

  it('uses the multi-select outline styling when hovering a group', function () {
    const markerOutline = document.createElement('div');
    const annotation = buildAnnotation({
      id: 'group',
      isMultiSelect: true,
      boundingBox: { x: 12, y: 24, width: 90, height: 40 },
    });

    updateMarkerOutline({
      editingAnnotation: null,
      hoveredMarkerId: 'group',
      pendingAnnotation: null,
      isDragging: false,
      annotations: [annotation],
      markerOutline: markerOutline,
      scrollY: 0,
      accentColor: '#3c82f7',
    });

    expect(markerOutline.classList.contains('as-multi-outline')).toBe(true);
    expect(markerOutline.style.display).toBe('block');
  });

  it('renders hover actions and tooltip for the hovered marker', function () {
    const annotations = [
      buildAnnotation({
        id: 'first',
        element: 'Button',
        comment: 'Click me',
        selectedText: 'Save',
      }),
      buildAnnotation({ id: 'second', element: 'Input', comment: 'Type here' }),
    ];

    const markerElements = new Map<string, HTMLDivElement>();
    const fixedMarkerElements = new Map<string, HTMLDivElement>();
    const marker = document.createElement('div');
    const otherMarker = document.createElement('div');
    markerElements.set('first', marker);
    markerElements.set('second', otherMarker);

    updateMarkerHoverUI({
      markersExiting: false,
      hoveredMarkerId: 'first',
      deletingMarkerId: null,
      editingAnnotation: null,
      isDarkMode: true,
      markerElements: markerElements,
      fixedMarkerElements: fixedMarkerElements,
      getTooltipPosition: function getTooltipPosition() {
        return { top: '4px', left: '8px' };
      },
      applyInlineStyles: function applyInlineStyles(element, styles) {
        if (!styles) return;
        Object.entries(styles).forEach(function applyStyle([key, value]) {
          if (typeof value === 'string') {
            element.style.setProperty(key, value);
          }
        });
      },
      createIconCopyAnimated: function createIconCopyAnimated() {
        return createSvgIcon();
      },
      createIconXmark: function createIconXmark() {
        return createSvgIcon();
      },
      createIconClose: function createIconClose() {
        return createSvgIcon();
      },
      getAnnotationById: function getAnnotationById(id) {
        return (
          annotations.find(function findAnnotation(item) {
            return item.id === id;
          }) || null
        );
      },
      getAnnotationIndex: function getAnnotationIndex(id) {
        return annotations.findIndex(function findIndex(item) {
          return item.id === id;
        });
      },
    });

    const actions = marker.querySelector('.as-marker-actions');
    const tooltip = marker.querySelector('.as-marker-tooltip');

    expect(actions).not.toBeNull();
    expect(tooltip).not.toBeNull();
    expect(marker.classList.contains('as-actions-visible')).toBe(true);
    expect(marker.classList.contains('as-hovered')).toBe(true);

    const quote = tooltip?.querySelector('.as-marker-quote');
    const note = tooltip?.querySelector('.as-marker-note');
    expect(quote?.textContent).toContain('Button');
    expect(quote?.textContent).toContain('Save');
    expect(note?.textContent).toBe('Click me');

    const otherLabel = otherMarker.querySelector('span');
    expect(otherLabel?.textContent).toBe('2');
  });

  it('renders fixed and document markers into the correct layers', function () {
    const markersLayer = document.createElement('div');
    const fixedMarkersLayer = document.createElement('div');

    const annotations = [
      buildAnnotation({ id: 'doc', x: 10, y: 220 }),
      buildAnnotation({ id: 'fixed', x: 80, y: 60, isFixed: true }),
    ];

    const markerElements = new Map<string, HTMLDivElement>();
    const fixedMarkerElements = new Map<string, HTMLDivElement>();

    renderMarkers({
      annotations: annotations,
      markersVisible: true,
      markersExiting: false,
      getMarkersExiting: function getMarkersExiting() {
        return false;
      },
      exitingMarkers: new Set(),
      animatedMarkers: new Set(['doc', 'fixed']),
      isClearing: false,
      renumberFrom: null,
      recentlyAddedId: null,
      getRecentlyAddedId: function getRecentlyAddedId() {
        return null;
      },
      markerElements: markerElements,
      fixedMarkerElements: fixedMarkerElements,
      markersLayer: markersLayer,
      fixedMarkersLayer: fixedMarkersLayer,
      onHoverMarker: function onHoverMarker() {},
      onCopyAnnotation: function onCopyAnnotation() {},
      onDeleteAnnotation: function onDeleteAnnotation() {},
      onEditAnnotation: function onEditAnnotation() {},
      getTooltipPosition: function getTooltipPosition() {
        return {};
      },
      applyInlineStyles: function applyInlineStyles() {},
      createIconCopyAnimated: function createIconCopyAnimated() {
        return createSvgIcon();
      },
      createIconXmark: function createIconXmark() {
        return createSvgIcon();
      },
      createIconClose: function createIconClose() {
        return createSvgIcon();
      },
      accentColor: '#3c82f7',
      isDarkMode: true,
      hoveredMarkerId: null,
      deletingMarkerId: null,
      editingAnnotation: null,
      getAnnotationById: function getAnnotationById(id) {
        return (
          annotations.find(function findAnnotation(item) {
            return item.id === id;
          }) || null
        );
      },
      getAnnotationIndex: function getAnnotationIndex(id) {
        return annotations.findIndex(function findIndex(item) {
          return item.id === id;
        });
      },
    });

    expect(markersLayer.querySelectorAll('.as-marker').length).toBe(1);
    expect(fixedMarkersLayer.querySelectorAll('.as-marker').length).toBe(1);
    expect(markerElements.has('doc')).toBe(true);
    expect(fixedMarkerElements.has('fixed')).toBe(true);

    const docMarker = markerElements.get('doc') as HTMLDivElement;
    const fixedMarker = fixedMarkerElements.get('fixed') as HTMLDivElement;

    expect(docMarker.style.position).toBe('absolute');
    expect(docMarker.style.top).toBe('220px');
    expect(fixedMarker.style.position).toBe('fixed');
    expect(fixedMarker.classList.contains('as-fixed')).toBe(true);
  });
});
