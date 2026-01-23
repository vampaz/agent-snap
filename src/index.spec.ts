import { describe, expect, it } from 'vitest';

import * as uiAnnotator from '@/index';

describe('index exports', function () {
  it('exposes public api', function () {
    expect(typeof uiAnnotator.createUiAnnotator).toBe('function');
    expect(typeof uiAnnotator.registerUiAnnotatorElement).toBe('function');
  });
});
