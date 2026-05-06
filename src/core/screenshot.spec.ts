import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { snapdom } from '@zumer/snapdom';

import { deferAnnotationScreenshot } from '@/core/screenshot';

vi.mock('@zumer/snapdom', function mockSnapdom() {
  return {
    snapdom: {
      toCanvas: vi.fn(),
    },
  };
});

function setDocumentSize(width: number, height: number): void {
  Object.defineProperty(document.body, 'scrollWidth', { value: width, configurable: true });
  Object.defineProperty(document.body, 'offsetWidth', { value: width, configurable: true });
  Object.defineProperty(document.body, 'scrollHeight', { value: height, configurable: true });
  Object.defineProperty(document.body, 'offsetHeight', { value: height, configurable: true });
  Object.defineProperty(document.documentElement, 'clientWidth', {
    value: width,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, 'scrollWidth', {
    value: width,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, 'offsetWidth', {
    value: width,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    value: height,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: height,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, 'offsetHeight', {
    value: height,
    configurable: true,
  });
}

describe('deferAnnotationScreenshot', function () {
  let originalImage: typeof Image | undefined;
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
  let originalToDataUrl: typeof HTMLCanvasElement.prototype.toDataURL;
  let drawArgs: unknown[] = [];

  beforeEach(function () {
    document.body.innerHTML = '';
    setDocumentSize(800, 600);
    drawArgs = [];

    originalImage = globalThis.Image;
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    originalToDataUrl = HTMLCanvasElement.prototype.toDataURL;

    globalThis.Image = class MockImage {} as unknown as typeof Image;

    HTMLCanvasElement.prototype.getContext = function getContext() {
      return {
        drawImage: function drawImage(...args: unknown[]) {
          drawArgs = args;
        },
      } as unknown as CanvasRenderingContext2D;
    } as unknown as typeof HTMLCanvasElement.prototype.getContext;

    HTMLCanvasElement.prototype.toDataURL = function toDataURL(type?: string, quality?: number) {
      if (type !== 'image/jpeg' || quality !== 0.92) {
        return 'data:unexpected';
      }
      return 'data:image/jpeg;base64,test';
    };

    const source = document.createElement('canvas');
    source.width = 1600;
    source.height = 1200;
    vi.mocked(snapdom.toCanvas).mockClear();
    vi.mocked(snapdom.toCanvas).mockResolvedValue(source);
  });

  afterEach(function () {
    vi.restoreAllMocks();
    globalThis.Image = originalImage as typeof Image;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toDataURL = originalToDataUrl;
    vi.useRealTimers();
  });

  it('captures the page with snapdom and crops to the annotation bounds', async function () {
    vi.useFakeTimers();
    const promise = deferAnnotationScreenshot({ x: 10.4, y: 20.4, width: 100.9, height: 50.2 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('data:image/jpeg;base64,test');
    expect(snapdom.toCanvas).toHaveBeenCalledTimes(1);
    expect(snapdom.toCanvas).toHaveBeenCalledWith(
      document.body,
      expect.objectContaining({
        cache: 'soft',
        dpr: window.devicePixelRatio || 1,
        embedFonts: false,
        exclude: ['[data-agent-snap]'],
        excludeMode: 'remove',
        fast: true,
        filterMode: 'remove',
        height: 600,
        placeholders: true,
        width: 800,
      }),
    );
    expect(drawArgs).toEqual([expect.any(HTMLCanvasElement), 20, 40, 200, 102, 0, 0, 200, 102]);
  });

  it('excludes agent-snap UI from snapdom capture', async function () {
    vi.useFakeTimers();
    const promise = deferAnnotationScreenshot({ x: 0, y: 0, width: 100, height: 100 });
    await vi.runAllTimersAsync();
    await promise;

    const options = vi.mocked(snapdom.toCanvas).mock.calls[0]?.[1];
    const keepNode = document.createElement('div');
    const toolNode = document.createElement('div');
    toolNode.dataset.agentSnap = 'true';
    document.body.appendChild(toolNode);

    expect(options?.filter?.(keepNode)).toBe(true);
    expect(options?.filter?.(toolNode)).toBe(false);
  });

  it('removes oversized shadow roots from snapdom capture', async function () {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    for (let index = 0; index < 1001; index += 1) {
      shadow.appendChild(document.createElement('span'));
    }
    document.body.appendChild(host);

    vi.useFakeTimers();
    const promise = deferAnnotationScreenshot({ x: 0, y: 0, width: 100, height: 100 });
    await vi.runAllTimersAsync();
    await promise;

    const shadowNode = shadow.querySelector('span') as HTMLElement;
    const options = vi.mocked(snapdom.toCanvas).mock.calls[0]?.[1];
    expect(options?.filter?.(host)).toBe(true);
    expect(options?.filter?.(shadowNode)).toBe(false);
  });

  it('returns null without calling snapdom for invalid bounds', async function () {
    vi.useFakeTimers();
    const promise = deferAnnotationScreenshot({ x: 0, y: 0, width: 0, height: 100 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBeNull();
    expect(snapdom.toCanvas).not.toHaveBeenCalled();
  });

  it('returns null when the document is too large for capture', async function () {
    setDocumentSize(7000, 600);

    vi.useFakeTimers();
    const promise = deferAnnotationScreenshot({ x: 0, y: 0, width: 100, height: 100 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBeNull();
    expect(snapdom.toCanvas).not.toHaveBeenCalled();
  });
});
