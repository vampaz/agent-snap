export const THIN_SELECTION_THRESHOLD = 18;
export const THIN_SELECTION_PADDING = 8;
export const MIN_AREA_SELECTION_SIZE = 12;
export const MIN_ELEMENT_SIZE = 10;
export const MIN_ELEMENT_SIZE_THIN = 6;
export const OVERLAP_THRESHOLD = 0.5;
export const OVERLAP_THRESHOLD_THIN = 0.2;

export type SelectionMetrics = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  isThinSelection: boolean;
  detectionPadding: number;
  detectLeft: number;
  detectTop: number;
  detectRight: number;
  detectBottom: number;
};

export type SelectionConfig = {
  minElementSize: number;
  overlapThreshold: number;
};

export function getSelectionMetrics(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): SelectionMetrics {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const right = Math.max(startX, endX);
  const bottom = Math.max(startY, endY);
  const width = right - left;
  const height = bottom - top;
  const isThinSelection = width < THIN_SELECTION_THRESHOLD || height < THIN_SELECTION_THRESHOLD;
  const detectionPadding = isThinSelection ? THIN_SELECTION_PADDING : 0;

  return {
    left,
    top,
    right,
    bottom,
    width,
    height,
    isThinSelection,
    detectionPadding,
    detectLeft: left - detectionPadding,
    detectTop: top - detectionPadding,
    detectRight: right + detectionPadding,
    detectBottom: bottom + detectionPadding,
  };
}

export function getSelectionConfig(metrics: SelectionMetrics): SelectionConfig {
  return {
    minElementSize: metrics.isThinSelection ? MIN_ELEMENT_SIZE_THIN : MIN_ELEMENT_SIZE,
    overlapThreshold: metrics.isThinSelection ? OVERLAP_THRESHOLD_THIN : OVERLAP_THRESHOLD,
  };
}
