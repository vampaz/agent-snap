import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deferAnnotationScreenshot } from '@/core/screenshot';

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

function setRect(element: HTMLElement, rect: Rect): void {
  element.getBoundingClientRect = function getBoundingClientRect() {
    return rect as DOMRect;
  };
}

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
  let lastSvgUrl = '';
  let drawArgs: unknown[] = [];

  beforeEach(function () {
    document.body.innerHTML = '';
    setDocumentSize(800, 600);
    lastSvgUrl = '';
    drawArgs = [];

    originalImage = globalThis.Image;
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    originalToDataUrl = HTMLCanvasElement.prototype.toDataURL;

    class MockImage {
      public onload: (() => void) | null = null;
      public onerror: (() => void) | null = null;
      public decoding = '';
      private currentSrc = '';
      public get src(): string {
        return this.currentSrc;
      }
      public set src(value: string) {
        this.currentSrc = value;
        lastSvgUrl = value;
        this.onload?.();
      }
    }

    globalThis.Image = MockImage as unknown as typeof Image;

    HTMLCanvasElement.prototype.getContext = function getContext() {
      return {
        drawImage: function drawImage(image: unknown) {
          drawArgs.push(image);
        },
        scale: function scale() {},
      } as unknown as CanvasRenderingContext2D;
    };

    HTMLCanvasElement.prototype.toDataURL = function toDataURL(type?: string, quality?: number) {
      if (type !== 'image/jpeg') {
        return 'data:unexpected';
      }
      if (quality !== 0.9) {
        return 'data:quality-mismatch';
      }
      return 'data:image/jpeg;base64,test';
    };
  });

  afterEach(function () {
    vi.restoreAllMocks();
    globalThis.Image = originalImage as typeof Image;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toDataURL = originalToDataUrl;
    vi.useRealTimers();
  });

  it('serializes form values and copies canvas content into the clone', async function () {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'Hello';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;

    const textarea = document.createElement('textarea');
    textarea.value = 'Notes';

    const select = document.createElement('select');
    const optionOne = document.createElement('option');
    optionOne.value = 'one';
    optionOne.textContent = 'One';
    const optionTwo = document.createElement('option');
    optionTwo.value = 'two';
    optionTwo.textContent = 'Two';
    optionTwo.selected = true;
    select.appendChild(optionOne);
    select.appendChild(optionTwo);

    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 10;

    document.body.appendChild(input);
    document.body.appendChild(checkbox);
    document.body.appendChild(textarea);
    document.body.appendChild(select);
    document.body.appendChild(canvas);

    setRect(input, { left: 10, top: 10, right: 110, bottom: 40, width: 100, height: 30 });
    setRect(checkbox, { left: 10, top: 50, right: 30, bottom: 70, width: 20, height: 20 });
    setRect(textarea, { left: 10, top: 80, right: 210, bottom: 140, width: 200, height: 60 });
    setRect(select, { left: 10, top: 150, right: 110, bottom: 180, width: 100, height: 30 });
    setRect(canvas, { left: 10, top: 190, right: 110, bottom: 240, width: 100, height: 50 });

    vi.useFakeTimers();
    const promise = deferAnnotationScreenshot({ x: 0, y: 0, width: 300, height: 260 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('data:image/jpeg;base64,test');
    expect(lastSvgUrl).toContain('data:image/svg+xml');

    const svgMarkup = decodeURIComponent(lastSvgUrl.split(',')[1]);
    expect(svgMarkup).toContain('value="Hello"');
    expect(svgMarkup).toMatch(/<input[^>]*checked/);
    expect(svgMarkup).toContain('>Notes</textarea>');
    expect(svgMarkup).toMatch(/<option[^>]*selected/);
    expect(
      drawArgs.some(function hasCanvas(arg) {
        return arg === canvas;
      }),
    ).toBe(true);
  });
});
