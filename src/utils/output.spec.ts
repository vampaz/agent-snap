import { describe, expect, it } from 'vitest';

import type { Annotation } from '@/types';
import { generateOutput } from '@/utils/output';

describe('generateOutput', function () {
  it('returns empty output when no annotations', function () {
    expect(generateOutput([], '/empty')).toBe('');
  });

  it('does not include agent-snap-assets when no screenshots or attachments', function () {
    const annotations: Annotation[] = [
      {
        id: '1',
        x: 10,
        y: 20,
        comment: 'No assets',
        element: 'div',
        elementPath: 'main > div',
        timestamp: 123,
      },
    ];

    const output = generateOutput(annotations, '/no-assets', 'standard');
    expect(output).not.toContain('```agent-snap-assets');
    expect(output).not.toContain('**Agent Tips:**');
    expect(output).toContain('### 1. div');
    expect(output).toContain('**What needs to be done:** No assets');
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
        dataTestId: 'nav-docs-link',
        selectedText: 'Docs',
        screenshot: 'data:image/png;base64,abc123',
      },
    ];

    const output = generateOutput(annotations, '/docs', 'standard');
    expect(output).toContain('**Screen Size:**');
    expect(output).toContain('### 1. anchor "Docs"');
    expect(output).toContain('**Loc:** nav > a');
    expect(output).toContain('**Test Id:** nav-docs-link');
    expect(output).toContain('**Screenshot:**');
    expect(output).toContain('**Screenshot:** ref: agent-snap-annotation-1-screenshot');
    expect(output).not.toContain('data:image/png;base64,abc123');
    expect(output).toContain('**What needs to be done:** Update copy');
    expect(output).not.toContain('**System Info:**');
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
        dataTestId: 'home-hero-title',
        cssClasses: 'title',
        nearbyText: 'Welcome',
        boundingBox: { x: 10, y: 20, width: 100, height: 40 },
        screenshot: 'data:image/png;base64,detailed',
      },
    ];

    const output = generateOutput(annotations, '/home', 'detailed');
    expect(output).toContain('**Test Id:** home-hero-title');
    expect(output).toContain('**Classes:** title');
    expect(output).toContain('**Coords:** 10px, 20px (100x40px)');
    expect(output).toContain('**Screenshot:**');
    expect(output).toContain('**Screenshot:** ref: agent-snap-annotation-1-screenshot');
    expect(output).not.toContain('data:image/png;base64,detailed');
  });

  it('renders output with attachments', function () {
    const annotations: Annotation[] = [
      {
        id: '1',
        x: 10,
        y: 20,
        comment: 'Check this',
        element: 'div',
        elementPath: 'div',
        timestamp: 123,
        attachments: ['data:image/png;base64,att1', 'data:image/png;base64,att2'],
      },
    ];

    const output = generateOutput(annotations, '/att', 'standard');
    expect(output).toContain('**Attachments:**');
    expect(output).toContain('ref: agent-snap-annotation-1-attachment-1');
    expect(output).toContain('ref: agent-snap-annotation-1-attachment-2');
    expect(output).not.toContain('data:image/png;base64,att1');
    expect(output).not.toContain('data:image/png;base64,att2');
  });

  it('includes an asset manifest for TUI agents', function () {
    const annotations: Annotation[] = [
      {
        id: '1',
        x: 10,
        y: 20,
        comment: 'Manifest',
        element: 'div',
        elementPath: 'div',
        timestamp: 123,
        screenshot: 'data:image/png;base64,abc123',
        attachments: ['data:image/png;base64,att1'],
      },
    ];

    const output = generateOutput(annotations, '/manifest', 'standard');
    expect(output).toContain('```agent-snap-assets');
    expect(output).toContain('"imageOutputMode": "base64"');
    expect(output).toContain('"assetDirectory": "./agent-snap-downloads"');
    expect(output).toContain('"actions": [');
    expect(output).toContain('"type": "materialize-asset"');
    expect(output).toContain('"assetId": "agent-snap-annotation-1-screenshot"');
    expect(output).toContain('"data": "abc123"');
    expect(output).toContain('"id": "agent-snap-annotation-1-screenshot"');
    expect(output).toContain('"id": "agent-snap-annotation-1-attachment-1"');
    expect(output).toContain('"data": "att1"');
    expect(output).toContain('**Agent Tips:**');
    expect(output).toContain('Images live in the agent-snap-assets manifest');
    expect(output).not.toContain('**Download all:**');
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
        dataTestId: 'cta-primary',
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
    expect(output).toContain('**Test Id:** cta-primary');
    expect(output).toContain('**Styles:** color: red');
    expect(output).toContain('**Siblings:** span, a');
    expect(output).toContain('**Screenshot:**');
    expect(output).toContain('**Screenshot:** ref: agent-snap-annotation-1-screenshot');
    expect(output).not.toContain('data:image/png;base64,forensic');
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

  it('uses unknown viewport when window is missing', function () {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
    });

    const annotations: Annotation[] = [
      {
        id: '1',
        x: 10,
        y: 20,
        comment: 'Note',
        element: 'div',
        elementPath: 'main > div',
        timestamp: 123,
      },
    ];

    const output = generateOutput(annotations, '/no-window', 'standard');
    expect(output).toContain('**Screen Size:** n/a');

    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
    });
  });

  it('uses base64 assets when image output mode is base64', function () {
    const annotations: Annotation[] = [
      {
        id: '1',
        x: 10,
        y: 20,
        comment: 'Base64 test',
        element: 'div',
        elementPath: 'div',
        timestamp: 123,
        screenshot: 'data:image/png;base64,local',
        attachments: ['data:image/png;base64,att1'],
      },
    ];

    const output = generateOutput(annotations, '/remote', 'standard');
    expect(output).toContain('"data": "local"');
    expect(output).toContain('"data": "att1"');
    expect(output).toContain('**Screenshot:** ref: agent-snap-annotation-1-screenshot');
    expect(output).toContain('ref: agent-snap-annotation-1-attachment-1');
    expect(output).not.toContain('data:image/png;base64,local');
    expect(output).not.toContain('data:image/png;base64,att1');
    expect(output).not.toContain('**Download all:**');
    expect(output).not.toContain('**Download:**');
  });

  it('uses url strategy when viewer URLs are present', function () {
    const annotations: Annotation[] = [
      {
        id: '1',
        x: 10,
        y: 20,
        comment: 'Viewer test',
        element: 'div',
        elementPath: 'div',
        timestamp: 123,
        screenshot: 'data:image/png;base64,local',
        remoteScreenshot: 'https://example.com/file/asset.jpg',
        remoteScreenshotViewer: 'https://example.com/viewer/asset.html',
      },
    ];

    const output = generateOutput(annotations, '/viewer', 'standard');
    expect(output).toContain('"strategy": "url"');
    expect(output).toContain('"url": "https://example.com/file/asset.jpg"');
  });
});
