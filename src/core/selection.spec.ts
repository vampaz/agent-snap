import { describe, expect, it } from 'vitest';

import {
  getSelectionConfig,
  getSelectionMetrics,
  MIN_ELEMENT_SIZE,
  MIN_ELEMENT_SIZE_THIN,
  OVERLAP_THRESHOLD,
  OVERLAP_THRESHOLD_THIN,
  THIN_SELECTION_PADDING,
  THIN_SELECTION_THRESHOLD,
} from '@/core/selection';

describe('selection helpers', function () {
  it('computes selection metrics for a standard selection', function () {
    const metrics = getSelectionMetrics(10, 20, 90, 140);

    expect(metrics.left).toBe(10);
    expect(metrics.top).toBe(20);
    expect(metrics.right).toBe(90);
    expect(metrics.bottom).toBe(140);
    expect(metrics.width).toBe(80);
    expect(metrics.height).toBe(120);
    expect(metrics.isThinSelection).toBe(false);
    expect(metrics.detectionPadding).toBe(0);
    expect(metrics.detectLeft).toBe(10);
    expect(metrics.detectTop).toBe(20);
    expect(metrics.detectRight).toBe(90);
    expect(metrics.detectBottom).toBe(140);
  });

  it('computes selection metrics for thin selections with padding', function () {
    const metrics = getSelectionMetrics(10, 20, 20, 30);

    expect(metrics.width).toBe(10);
    expect(metrics.height).toBe(10);
    expect(metrics.isThinSelection).toBe(true);
    expect(metrics.detectionPadding).toBe(THIN_SELECTION_PADDING);
    expect(metrics.detectLeft).toBe(10 - THIN_SELECTION_PADDING);
    expect(metrics.detectTop).toBe(20 - THIN_SELECTION_PADDING);
    expect(metrics.detectRight).toBe(20 + THIN_SELECTION_PADDING);
    expect(metrics.detectBottom).toBe(30 + THIN_SELECTION_PADDING);
  });

  it('marks selections as thin when width or height is below threshold', function () {
    const thinWidth = getSelectionMetrics(0, 0, THIN_SELECTION_THRESHOLD - 1, 40);
    const thinHeight = getSelectionMetrics(0, 0, 40, THIN_SELECTION_THRESHOLD - 1);

    expect(thinWidth.isThinSelection).toBe(true);
    expect(thinHeight.isThinSelection).toBe(true);
  });

  it('returns non-thin config values for standard selection', function () {
    const metrics = getSelectionMetrics(10, 20, 90, 140);
    const config = getSelectionConfig(metrics);

    expect(config.minElementSize).toBe(MIN_ELEMENT_SIZE);
    expect(config.overlapThreshold).toBe(OVERLAP_THRESHOLD);
  });

  it('returns thin config values for thin selection', function () {
    const metrics = getSelectionMetrics(10, 20, 20, 30);
    const config = getSelectionConfig(metrics);

    expect(config.minElementSize).toBe(MIN_ELEMENT_SIZE_THIN);
    expect(config.overlapThreshold).toBe(OVERLAP_THRESHOLD_THIN);
  });
});
