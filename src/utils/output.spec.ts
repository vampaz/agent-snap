import { describe, expect, it } from 'vitest';

import type { Annotation } from '@/types';
import { generateOutput } from '@/utils/output';

describe('generateOutput', function () {
  it('returns empty output when no annotations', function () {
    expect(generateOutput([], '/empty')).toBe('');
  });

  it('renders compact output', function () {
    const annotations: Annotation[] = [
      {
        id: '1',
        x: 10,
        y: 20,
        comment: 'Update copy',
        element: 'button "Save"',
        elementPath: 'main > button',
        timestamp: 123,
        selectedText: 'Save changes',
      },
    ];

    const output = generateOutput(annotations, '/settings', 'compact');
    expect(output).toContain('## Page Feedback: /settings');
    expect(output).toContain('**button "Save"**: Update copy');
    expect(output).toContain('Save changes');
  });

  it('renders standard output', function () {
    const annotations: Annotation[] = [
      {
        id: '1',
        x: 10,
        y: 20,
        comment: 'Update copy',
        element: 'link "Docs"',
        elementPath: 'nav > a',
        timestamp: 123,
        selectedText: 'Docs',
      },
    ];

    const output = generateOutput(annotations, '/docs', 'standard');
    expect(output).toContain('**Viewport:**');
    expect(output).toContain('### 1. link "Docs"');
    expect(output).toContain('**Location:** nav > a');
    expect(output).toContain('**Feedback:** Update copy');
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
      },
    ];

    const output = generateOutput(annotations, '/home', 'detailed');
    expect(output).toContain('**Classes:** title');
    expect(output).toContain('**Position:** 10px, 20px (100x40px)');
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
      },
    ];

    const output = generateOutput(annotations, '/forensic', 'forensic');
    expect(output).toContain('**Environment:**');
    expect(output).toContain('**Full DOM Path:** html > body > main > button');
    expect(output).toContain('**Computed Styles:** color: red');
    expect(output).toContain('**Nearby Elements:** span, a');
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
    expect(output).toContain('**Context:** Context snippet');
  });
});
