import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ATTACHMENT_COMPRESSION_THRESHOLD_BYTES,
  ATTACHMENT_JPEG_QUALITY,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  readImageFiles,
} from '@/utils/attachments';

describe('readImageFiles', function () {
  const originalFileReader = globalThis.FileReader;
  const originalWindowFileReader = globalThis.window?.FileReader;

  beforeEach(function () {
    const mockReader = class MockFileReader {
      public onload: ((event: { target: { result: string } }) => void) | null = null;
      public onerror: (() => void) | null = null;
      public onabort: (() => void) | null = null;

      readAsDataURL(file: File): void {
        if (file.name.startsWith('bad')) {
          this.onerror?.();
          return;
        }
        this.onload?.({ target: { result: `data:${file.name}` } });
      }
    } as unknown as typeof FileReader;

    globalThis.FileReader = mockReader;
    if (globalThis.window) {
      globalThis.window.FileReader = mockReader;
    }
  });

  afterEach(function () {
    globalThis.FileReader = originalFileReader;
    if (globalThis.window) {
      globalThis.window.FileReader = originalWindowFileReader;
    }
  });

  function createImageFile(name: string, size: number = 1): File {
    const file = new File(['x'], name, { type: 'image/png' });
    Object.defineProperty(file, 'type', {
      value: 'image/png',
      configurable: true,
      writable: true,
    });
    Object.defineProperty(file, 'size', {
      value: size,
      configurable: true,
      writable: true,
    });
    return file;
  }

  function createTextFile(name: string): File {
    const file = new File(['x'], name, { type: 'text/plain' });
    Object.defineProperty(file, 'type', {
      value: 'text/plain',
      configurable: true,
      writable: true,
    });
    return file;
  }

  it('reads up to the maximum number of image files', async function () {
    const files = [
      createImageFile('one.png'),
      createTextFile('notes.txt'),
      createImageFile('two.png'),
      createImageFile('three.png'),
    ];

    const result = await readImageFiles(files, 2);
    expect(result).toEqual(['data:one.png', 'data:two.png']);
  });

  it('caps the maximum number of image files read', async function () {
    const files = Array.from({ length: MAX_ATTACHMENTS + 2 }, (_, index) =>
      createImageFile(`image-${index}.png`),
    );

    const result = await readImageFiles(files, MAX_ATTACHMENTS + 4);
    expect(result).toHaveLength(MAX_ATTACHMENTS);
  });

  it('skips image files that exceed the byte limit', async function () {
    const files = [
      createImageFile('large.png', MAX_ATTACHMENT_BYTES + 1),
      createImageFile('small.png', ATTACHMENT_COMPRESSION_THRESHOLD_BYTES - 1),
    ];

    const result = await readImageFiles(files, 5);
    expect(result).toEqual(['data:small.png']);
  });

  it('compresses large image attachments to jpeg', async function () {
    const originalToDataUrl = HTMLCanvasElement.prototype.toDataURL;
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalImage = globalThis.Image;

    HTMLCanvasElement.prototype.getContext = function getContext() {
      return {
        drawImage: () => undefined,
      } as unknown as CanvasRenderingContext2D;
    };
    HTMLCanvasElement.prototype.toDataURL = function toDataURL(type?: string, quality?: number) {
      if (type !== 'image/jpeg') {
        throw new Error('Unexpected image type');
      }
      if (quality !== ATTACHMENT_JPEG_QUALITY) {
        throw new Error('Unexpected jpeg quality');
      }
      return 'data:image/jpeg;base64,compressed';
    };

    const mockImage = class MockImage {
      public onload: (() => void) | null = null;
      public onerror: (() => void) | null = null;
      public decoding = '';
      public naturalWidth = 10;
      public naturalHeight = 10;

      set src(_value: string) {
        this.onload?.();
      }
    };

    globalThis.Image = mockImage as unknown as typeof Image;

    try {
      const files = [createImageFile('large.png', ATTACHMENT_COMPRESSION_THRESHOLD_BYTES + 1)];
      const result = await readImageFiles(files, 1);
      expect(result).toEqual(['data:image/jpeg;base64,compressed']);
    } finally {
      globalThis.Image = originalImage;
      HTMLCanvasElement.prototype.toDataURL = originalToDataUrl;
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }
  });

  it('skips files that fail to read', async function () {
    const files = [createImageFile('bad-file.png')];
    const result = await readImageFiles(files, 5);
    expect(result).toEqual([]);
  });
});
