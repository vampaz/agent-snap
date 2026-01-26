import { describe, expect, it } from 'vitest';

import { applyInlineStyles } from '@/utils/styles';

describe('applyInlineStyles', function () {
  it('applies only string style values', function () {
    const element = document.createElement('div');

    applyInlineStyles(element, {
      color: 'red',
      'background-color': 'blue',
      opacity: '0.5',
    } as Partial<CSSStyleDeclaration>);

    expect(element.style.color).toBe('red');
    expect(element.style.backgroundColor).toBe('blue');
    expect(element.style.opacity).toBe('0.5');
  });

  it('ignores non-string values', function () {
    const element = document.createElement('div');

    applyInlineStyles(element, {
      color: 'green',
      'z-index': 5 as unknown as string,
    } as Partial<CSSStyleDeclaration>);

    expect(element.style.color).toBe('green');
    expect(element.style.zIndex).toBe('');
  });

  it('no-ops when styles are missing', function () {
    const element = document.createElement('div');

    applyInlineStyles(element, undefined);

    expect(element.getAttribute('style')).toBeNull();
  });
});
