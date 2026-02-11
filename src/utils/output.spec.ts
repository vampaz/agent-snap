import { describe, expect, it } from 'vitest';

import type { Annotation } from '@/types';
import { generateOutput } from '@/utils/output';

describe('generateOutput', function () {
  it('returns empty output when no annotations', function () {
    expect(generateOutput([], '/empty')).toBe('');
  });

  it('includes an agent-snap-v3 payload for annotated output', function () {
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
    expect(output).toContain('```agent-snap-v3');
    expect(output).toContain('"version": 3');
    expect(output).toContain('"reportId": "snap_');
    expect(output).toContain('"capturedAt": "');
    expect(output).toContain('"capabilities": {');
    expect(output).toContain('"assetTransport": "inline_base64"');
    expect(output).toContain('"supportsExternalUrls": false');
    expect(output).toContain('"supportsOcr": false');
    expect(output).toContain('"tasks": [');
    expect(output).toContain('"type": "find_visual_issue"');
    expect(output).toContain('"targetAssetId": "asset_ann_1_target"');
    expect(output).toContain('**Agent Tips:**');
    expect(output).toContain('Images live in the agent-snap-v3 payload');
  });

  it('renders standard output with screenshot refs', function () {
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
    expect(output).toContain('**Screenshot:** ref: asset_ann_1_target');
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
    expect(output).toContain('**Screenshot:** ref: asset_ann_1_target');
    expect(output).not.toContain('data:image/png;base64,detailed');
  });

  it('renders output with attachment refs', function () {
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
    expect(output).toContain('ref: asset_ann_1_attachment_1');
    expect(output).toContain('ref: asset_ann_1_attachment_2');
    expect(output).toContain('"relatedAssetIds": [');
    expect(output).not.toContain('data:image/png;base64,att1');
    expect(output).not.toContain('data:image/png;base64,att2');
  });

  it('includes v3 asset metadata and provenance', function () {
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
        boundingBox: { x: 1, y: 2, width: 30, height: 40 },
      },
    ];

    const output = generateOutput(annotations, '/manifest', 'standard');
    expect(output).toContain('"id": "asset_ann_1_target"');
    expect(output).toContain('"kind": "element_crop"');
    expect(output).toContain('"transport": {');
    expect(output).toContain('"type": "inline_base64"');
    expect(output).toContain('"data": "abc123"');
    expect(output).toContain('"meta": {');
    expect(output).toContain('"filename": "asset_ann_1_target.png"');
    expect(output).toContain('"bytes": 4');
    expect(output).toContain('"base64Length": 6');
    expect(output).toContain('"sha256": "');
    expect(output).toContain('"width": 30');
    expect(output).toContain('"height": 40');
    expect(output).toContain('"provenance": {');
    expect(output).toContain('"annotationId": "ann_1"');
    expect(output).toContain('"captureMethod": "agent-snap"');
  });

  it('computes real sha256 for inline base64 payload', function () {
    const annotations: Annotation[] = [
      {
        id: '1',
        x: 10,
        y: 20,
        comment: 'Hash test',
        element: 'div',
        elementPath: 'div',
        timestamp: 123,
        screenshot: 'data:image/png;base64,YWJj',
      },
    ];

    const output = generateOutput(annotations, '/hash', 'standard');
    expect(output).toContain(
      '"sha256": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"',
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
    expect(output).toContain('**Screenshot:** ref: asset_ann_1_target');
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
    expect(output).toContain('"viewport": {');
    expect(output).toContain('"width": 0');
    expect(output).toContain('"height": 0');

    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
    });
  });

  it('ignores remote screenshot urls and uses local inline base64', function () {
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
    expect(output).toContain('"data": "local"');
    expect(output).not.toContain('https://example.com/file/asset.jpg');
    expect(output).not.toContain('https://example.com/viewer/asset.html');
  });

  it('uses only local attachment payloads when remote urls exist', function () {
    const annotations: Annotation[] = [
      {
        id: '1',
        x: 10,
        y: 20,
        comment: 'Mixed',
        element: 'div',
        elementPath: 'div',
        timestamp: 123,
        attachments: ['data:image/png;base64,att1', 'data:image/png;base64,att2'],
        remoteAttachments: ['https://example.com/asset1.png', 'data:image/png;base64,att2'],
      },
    ];

    const output = generateOutput(annotations, '/mixed', 'standard');
    expect(output).toContain('"data": "att1"');
    expect(output).toContain('"data": "att2"');
    expect(output).not.toContain('https://example.com/asset1.png');
  });
});
