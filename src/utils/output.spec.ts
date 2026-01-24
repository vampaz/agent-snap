import { describe, expect, it } from 'vitest';

import type { Annotation } from '@/types';
import { generateOutput } from '@/utils/output';

describe('generateOutput', function () {
  it('returns empty output when no annotations', function () {
    expect(generateOutput([], '/empty')).toBe('');
  });

  it('renders standard output', function () {
    const annotations: Annotation[] = [
      {
        id: '1',
        x: 10,
        y: 20,
        comment: 'Update copy',
        element: 'anchor "Docs"',
        elementPath: 'nav > a',
        timestamp: 123,
        selectedText: 'Docs',
        screenshot: 'data:image/png;base64,abc123',
      },
    ];

    const output = generateOutput(annotations, '/docs', 'standard');
    expect(output).toContain('**Screen Size:**');
    expect(output).toContain('### 1. anchor "Docs"');
    expect(output).toContain('**Loc:** nav > a');
    expect(output).toContain('**Screenshot:**');
    expect(output).toContain('![Annotation 1 screenshot](data:image/png;base64,abc123)');
    expect(output).toContain('**Note:** Update copy');
  });

  it('renders detailed output', function () {
    const annotations: Annotation[] = [
      {
        id: '1',
        x: 10,
        y: 20,
        comment: 'Update copy',
        element: 'heading',
        elementPath: 'section > h2',
        timestamp: 123,
        cssClasses: 'title',
        nearbyText: 'Welcome',
        boundingBox: { x: 10, y: 20, width: 100, height: 40 },
        screenshot: 'data:image/png;base64,detailed',
      },
    ];

    const output = generateOutput(annotations, '/home', 'detailed');
    expect(output).toContain('**Classes:** title');
    expect(output).toContain('**Coords:** 10px, 20px (100x40px)');
    expect(output).toContain('**Screenshot:**');
    expect(output).toContain(
      '![Annotation 1 screenshot](data:image/png;base64,detailed)',
    );
  });

  it('renders forensic output', function () {
    const annotations: Annotation[] = [
      {
        id: '1',
        x: 10,
        y: 20,
        comment: 'Update copy',
        element: 'button',
        elementPath: 'main > button',
        timestamp: 123,
        isMultiSelect: true,
        fullPath: 'html > body > main > button',
        cssClasses: 'primary',
        nearbyText: 'Hello',
        selectedText: 'Click',
        computedStyles: 'color: red',
        accessibility: 'role="button"',
        nearbyElements: 'span, a',
        boundingBox: { x: 10, y: 20, width: 100, height: 40 },
        screenshot: 'data:image/png;base64,forensic',
      },
    ];

    const output = generateOutput(annotations, '/forensic', 'forensic');
    expect(output).toContain('**System Info:**');
    expect(output).toContain('**DOM Path:** html > body > main > button');
    expect(output).toContain('**Styles:** color: red');
    expect(output).toContain('**Siblings:** span, a');
    expect(output).toContain('**Screenshot:**');
    expect(output).toContain('![Annotation 1 screenshot](data:image/png;base64,forensic)');
  });

  it('renders forensic context without selected text', function () {
    const annotations: Annotation[] = [
      {
        id: '1',
        x: 10,
        y: 20,
        comment: 'Update copy',
        element: 'section',
        elementPath: 'main > section',
        timestamp: 123,
        nearbyText: 'Context snippet',
      },
    ];

    const output = generateOutput(annotations, '/context', 'forensic');
    expect(output).toContain('**Surroundings:** Context snippet');
  });
});
