import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readImageFiles } from '@/utils/attachments';

describe('readImageFiles', function () {
  const originalFileReader = globalThis.FileReader;
  const originalWindowFileReader = globalThis.window?.FileReader;
  const originalImage = globalThis.Image;

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

    const mockImage = class {
      public onload: (() => void) | null = null;
      public onerror: (() => void) | null = null;
      public src = '';
      public width = 100;
      public height = 100;
      constructor() {
        setTimeout(() => {
          if (this.src.includes('bad')) {
            this.onerror?.();
          } else {
            this.onload?.();
          }
        }, 0);
      }
    } as unknown as typeof Image;

    globalThis.Image = mockImage;
    if (globalThis.window) {
      globalThis.window.Image = mockImage;
    }

    // Mock Canvas toDataURL
    if (globalThis.HTMLCanvasElement) {
      globalThis.HTMLCanvasElement.prototype.getContext = (() => ({
        drawImage: () => {},
      })) as any;
      globalThis.HTMLCanvasElement.prototype.toDataURL = ((type: string) => {
        return `compressed:${type}`;
      }) as any;
    }
  });

  afterEach(function () {
    globalThis.FileReader = originalFileReader;
    if (globalThis.window) {
      globalThis.window.FileReader = originalWindowFileReader;
    }
    globalThis.Image = originalImage;
    if (globalThis.window) {
      globalThis.window.Image = originalImage;
    }
  });

  function createImageFile(name: string): File {
    const file = new File(['x'], name, { type: 'image/png' });
    Object.defineProperty(file, 'type', {
      value: 'image/png',
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
    expect(result).toEqual(['compressed:image/jpeg', 'compressed:image/jpeg']);
  });

  it('skips files that fail to read', async function () {
    const files = [createImageFile('bad-file.png')];
    const result = await readImageFiles(files, 5);
    expect(result).toEqual([]);
  });
});
