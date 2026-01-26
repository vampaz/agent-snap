import { describe, expect, it } from 'vitest';

import { t } from '@/utils/i18n';

describe('t', function () {
  it('returns the key when missing', function () {
    expect(t('missing.key')).toBe('missing.key');
  });

  it('returns the template when values are not provided', function () {
    expect(t('settings.outputDetail')).toBe('Verbosity');
  });

  it('replaces tokens with provided values', function () {
    expect(
      t('annotation.multiSelectLabel', {
        count: 3,
        elements: 'button, input',
        suffix: ' +1 others',
      }),
    ).toBe('3 items: button, input +1 others');
  });

  it('replaces multiple occurrences of a token', function () {
    expect(t('annotation.regionAt', { x: 12, y: 34 })).toBe('zone @ (12, 34)');
  });
});
