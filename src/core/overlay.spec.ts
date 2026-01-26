import { describe, expect, it } from 'vitest';

import type { Annotation } from '@/types';
import {
  createOverlayElements,
  updateDragUI,
  updateEditOutline,
  updateHoverOverlay,
  updatePendingUI,
} from '@/core/overlay';

function buildAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: overrides.id ?? 'a-1',
    x: overrides.x ?? 20,
    y: overrides.y ?? 120,
    comment: overrides.comment ?? 'Note',
    element: overrides.element ?? 'Button',
    elementPath: overrides.elementPath ?? 'body > button',
    timestamp: overrides.timestamp ?? Date.now(),
    isMultiSelect: overrides.isMultiSelect,
    boundingBox: overrides.boundingBox,
  };
}

describe('overlay helpers', function () {
  it('shows hover highlight and tooltip when active and idle', function () {
    const elements = createOverlayElements();
    const rect = {
      left: 20,
      top: 40,
      width: 100,
      height: 50,
    } as DOMRect;

    updateHoverOverlay({
      hoverInfo: { element: 'Button', rect: rect },
      hoverPosition: { x: 60, y: 80 },
      isActive: true,
      pendingAnnotation: null,
      isScrolling: false,
      isDragging: false,
      accentColor: '#3c82f7',
      hoverHighlight: elements.hoverHighlight,
      hoverTooltip: elements.hoverTooltip,
    });

    expect(elements.hoverHighlight.style.display).toBe('block');
    expect(elements.hoverHighlight.style.left).toBe('20px');
    expect(elements.hoverHighlight.style.top).toBe('40px');
    expect(elements.hoverHighlight.style.width).toBe('100px');
    expect(elements.hoverHighlight.style.height).toBe('50px');
    expect(elements.hoverTooltip.style.display).toBe('block');
    expect(elements.hoverTooltip.textContent).toBe('Button');
  });

  it('hides hover highlight and tooltip while dragging', function () {
    const elements = createOverlayElements();

    updateHoverOverlay({
      hoverInfo: { element: 'Card', rect: { left: 10, top: 10, width: 40, height: 20 } as DOMRect },
      hoverPosition: { x: 12, y: 20 },
      isActive: true,
      pendingAnnotation: null,
      isScrolling: false,
      isDragging: true,
      accentColor: '#3c82f7',
      hoverHighlight: elements.hoverHighlight,
      hoverTooltip: elements.hoverTooltip,
    });

    expect(elements.hoverHighlight.style.display).toBe('none');
    expect(elements.hoverTooltip.style.display).toBe('none');
  });

  it('hides hover UI when inactive', function () {
    const elements = createOverlayElements();

    updateHoverOverlay({
      hoverInfo: {
        element: 'Panel',
        rect: { left: 10, top: 10, width: 30, height: 20 } as DOMRect,
      },
      hoverPosition: { x: 50, y: 60 },
      isActive: false,
      pendingAnnotation: null,
      isScrolling: false,
      isDragging: false,
      accentColor: '#3c82f7',
      hoverHighlight: elements.hoverHighlight,
      hoverTooltip: elements.hoverTooltip,
    });

    expect(elements.hoverHighlight.style.display).toBe('none');
    expect(elements.hoverTooltip.style.display).toBe('block');
  });

  it('renders pending outline and marker when a pending annotation exists', function () {
    const elements = createOverlayElements();

    updatePendingUI({
      pendingAnnotation: {
        x: 25,
        clientY: 200,
        boundingBox: { x: 40, y: 300, width: 120, height: 60 },
      },
      scrollY: 100,
      accentColor: '#34C759',
      pendingExiting: false,
      pendingOutline: elements.pendingOutline,
      pendingMarker: elements.pendingMarker,
    });

    expect(elements.pendingOutline.style.display).toBe('block');
    expect(elements.pendingOutline.style.left).toBe('40px');
    expect(elements.pendingOutline.style.top).toBe('200px');
    expect(elements.pendingOutline.style.width).toBe('120px');
    expect(elements.pendingOutline.style.height).toBe('60px');
    expect(elements.pendingMarker.style.display).toBe('flex');
    expect(elements.pendingMarker.style.left).toBe('25%');
    expect(elements.pendingMarker.style.top).toBe('200px');
  });

  it('adds exit class to pending marker when exiting', function () {
    const elements = createOverlayElements();

    updatePendingUI({
      pendingAnnotation: {
        x: 10,
        clientY: 40,
      },
      scrollY: 0,
      accentColor: '#3c82f7',
      pendingExiting: true,
      pendingOutline: elements.pendingOutline,
      pendingMarker: elements.pendingMarker,
    });

    expect(elements.pendingMarker.classList.contains('as-exit')).toBe(true);
  });

  it('hides pending UI when no pending annotation is provided', function () {
    const elements = createOverlayElements();

    updatePendingUI({
      pendingAnnotation: null,
      scrollY: 0,
      accentColor: '#3c82f7',
      pendingExiting: false,
      pendingOutline: elements.pendingOutline,
      pendingMarker: elements.pendingMarker,
    });

    expect(elements.pendingOutline.style.display).toBe('none');
    expect(elements.pendingMarker.style.display).toBe('none');
  });

  it('updates edit outline based on the editing annotation', function () {
    const elements = createOverlayElements();
    const annotation = buildAnnotation({
      boundingBox: { x: 10, y: 80, width: 200, height: 40 },
    });

    updateEditOutline({
      editingAnnotation: annotation,
      scrollY: 30,
      accentColor: '#3c82f7',
      editOutline: elements.editOutline,
    });

    expect(elements.editOutline.style.display).toBe('block');
    expect(elements.editOutline.style.left).toBe('10px');
    expect(elements.editOutline.style.top).toBe('50px');
    expect(elements.editOutline.style.width).toBe('200px');
    expect(elements.editOutline.style.height).toBe('40px');
  });

  it('toggles drag UI visibility', function () {
    const elements = createOverlayElements();

    updateDragUI({
      isDragging: true,
      dragRect: elements.dragRect,
      highlightsContainer: elements.highlightsContainer,
    });

    expect(elements.dragRect.style.display).toBe('block');
    expect(elements.highlightsContainer.style.display).toBe('block');

    updateDragUI({
      isDragging: false,
      dragRect: elements.dragRect,
      highlightsContainer: elements.highlightsContainer,
    });

    expect(elements.dragRect.style.display).toBe('none');
    expect(elements.highlightsContainer.style.display).toBe('none');
  });
});
