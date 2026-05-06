import { snapdom } from '@zumer/snapdom';
import type { SnapdomOptions } from '@zumer/snapdom';

const MAX_SCREENSHOT_DIMENSION = 3000;
const MAX_SCREENSHOT_AREA = 9000000;
const MAX_DOCUMENT_DIMENSION = 6000;
const MAX_DOCUMENT_AREA = 36000000;
const MAX_SHADOW_DOM_NODES = 1000;
const OVERSIZED_SHADOW_ATTRIBUTE = 'data-agent-snap-oversized-shadow';

type ScreenshotBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function getDocumentSize(): { width: number; height: number } {
  const body = document.body;
  const doc = document.documentElement;
  return {
    width: Math.max(
      body.scrollWidth,
      body.offsetWidth,
      doc.clientWidth,
      doc.scrollWidth,
      doc.offsetWidth,
    ),
    height: Math.max(
      body.scrollHeight,
      body.offsetHeight,
      doc.clientHeight,
      doc.scrollHeight,
      doc.offsetHeight,
    ),
  };
}

function getPageBackgroundColor(): string {
  const bodyBackground = window.getComputedStyle(document.body).backgroundColor;
  if (bodyBackground && bodyBackground !== 'transparent' && bodyBackground !== 'rgba(0, 0, 0, 0)') {
    return bodyBackground;
  }
  const htmlBackground = window.getComputedStyle(document.documentElement).backgroundColor;
  if (htmlBackground && htmlBackground !== 'transparent' && htmlBackground !== 'rgba(0, 0, 0, 0)') {
    return htmlBackground;
  }
  return '#ffffff';
}

function countShadowRootNodes(root: ShadowRoot, limit: number): number {
  let count = 0;
  const stack: Node[] = Array.from(root.childNodes);
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    count += 1;
    if (count >= limit) return count;
    if (node instanceof Element || node instanceof DocumentFragment) {
      stack.push(...Array.from(node.childNodes));
    }
  }
  return count;
}

function createSnapdomCaptureContext(): {
  cleanup: () => void;
  filter: (element: Element) => boolean;
  plugins: SnapdomOptions['plugins'];
} {
  const oversizedShadowRoots = new WeakSet<ShadowRoot>();
  const oversizedHosts: HTMLElement[] = [];

  document.querySelectorAll('*').forEach(function trackOversizedShadowRoots(element) {
    if (!(element instanceof HTMLElement) || !element.shadowRoot) return;
    const count = countShadowRootNodes(element.shadowRoot, MAX_SHADOW_DOM_NODES + 1);
    if (count > MAX_SHADOW_DOM_NODES) {
      oversizedShadowRoots.add(element.shadowRoot);
      element.setAttribute(OVERSIZED_SHADOW_ATTRIBUTE, 'true');
      oversizedHosts.push(element);
    }
  });

  return {
    cleanup: function cleanupOversizedHostMarkers() {
      oversizedHosts.forEach(function removeMarker(host) {
        host.removeAttribute(OVERSIZED_SHADOW_ATTRIBUTE);
      });
    },
    filter: function shouldKeepSnapdomElement(element: Element): boolean {
      if (!(element instanceof HTMLElement)) return true;
      if (element.closest('[data-agent-snap]')) return false;
      const root = element.getRootNode();
      return !(root instanceof ShadowRoot && oversizedShadowRoots.has(root));
    },
    plugins: [
      {
        name: 'agent-snap-oversized-shadow-root',
        afterClone: function removeOversizedShadowRoots(context: { clone?: Element | null }) {
          if (!(context.clone instanceof Element)) return;
          context.clone
            .querySelectorAll(`[${OVERSIZED_SHADOW_ATTRIBUTE}]`)
            .forEach(function removeShadowRoot(host) {
              if (!(host instanceof HTMLElement) || !host.shadowRoot) return;
              while (host.shadowRoot.firstChild) {
                host.shadowRoot.firstChild.remove();
              }
              host.removeAttribute(OVERSIZED_SHADOW_ATTRIBUTE);
            });
        },
      },
    ],
  };
}

function cropCanvasToDataUrl(
  source: HTMLCanvasElement,
  bounds: ScreenshotBounds,
  docSize: { width: number; height: number },
): string | null {
  const scaleX = source.width / docSize.width;
  const scaleY = source.height / docSize.height;
  const width = Math.round(bounds.width * scaleX);
  const height = Math.round(bounds.height * scaleY);
  if (width <= 0 || height <= 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.drawImage(
    source,
    Math.round(bounds.x * scaleX),
    Math.round(bounds.y * scaleY),
    width,
    height,
    0,
    0,
    width,
    height,
  );

  try {
    return canvas.toDataURL('image/jpeg', 0.92);
  } catch {
    return null;
  }
}

async function renderPageAreaWithSnapdom(
  bounds: ScreenshotBounds,
  docSize: { width: number; height: number },
): Promise<string | null> {
  if (
    docSize.width <= 0 ||
    docSize.height <= 0 ||
    docSize.width > MAX_DOCUMENT_DIMENSION ||
    docSize.height > MAX_DOCUMENT_DIMENSION ||
    docSize.width * docSize.height > MAX_DOCUMENT_AREA
  ) {
    return null;
  }

  try {
    const captureContext = createSnapdomCaptureContext();
    const options: SnapdomOptions = {
      backgroundColor: getPageBackgroundColor(),
      cache: 'soft',
      dpr: window.devicePixelRatio || 1,
      embedFonts: false,
      exclude: ['[data-agent-snap]'],
      excludeMode: 'remove',
      fast: true,
      filter: captureContext.filter,
      filterMode: 'remove',
      height: docSize.height,
      placeholders: true,
      plugins: captureContext.plugins,
      width: docSize.width,
    };
    try {
      const canvas = await snapdom.toCanvas(document.body, options);
      return cropCanvasToDataUrl(canvas, bounds, docSize);
    } finally {
      captureContext.cleanup();
    }
  } catch {
    return null;
  }
}

function captureAnnotationScreenshot(bounds: ScreenshotBounds): Promise<string | null> {
  if (typeof window === 'undefined' || !document.body) {
    return Promise.resolve(null);
  }

  const roundedBounds = {
    x: Math.max(0, Math.round(bounds.x)),
    y: Math.max(0, Math.round(bounds.y)),
    width: Math.max(0, Math.floor(bounds.width)),
    height: Math.max(0, Math.ceil(bounds.height)),
  };

  const area = roundedBounds.width * roundedBounds.height;
  if (
    roundedBounds.width <= 0 ||
    roundedBounds.height <= 0 ||
    roundedBounds.width > MAX_SCREENSHOT_DIMENSION ||
    roundedBounds.height > MAX_SCREENSHOT_DIMENSION ||
    area > MAX_SCREENSHOT_AREA
  ) {
    return Promise.resolve(null);
  }

  return renderPageAreaWithSnapdom(roundedBounds, getDocumentSize());
}

export function deferAnnotationScreenshot(
  bounds: ScreenshotBounds,
  _isFixed?: boolean,
  _element?: HTMLElement,
): Promise<string | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!canRenderScreenshots()) return Promise.resolve(null);
  return new Promise(function resolveDeferred(resolve) {
    const runCapture = function runCapture() {
      captureAnnotationScreenshot(bounds).then(resolve);
    };
    const idle = (
      window as Window & {
        requestIdleCallback?: (callback: () => void) => number;
      }
    ).requestIdleCallback;
    if (typeof idle === 'function') {
      idle(runCapture);
    } else {
      setTimeout(runCapture, 0);
    }
  });
}

function canRenderScreenshots(): boolean {
  if (typeof Image === 'undefined') return false;
  if (!hasCanvasBackingStore()) return false;
  const canvas = document.createElement('canvas');
  if (typeof canvas.getContext !== 'function' || typeof canvas.toDataURL !== 'function') {
    return false;
  }
  try {
    return Boolean(canvas.getContext('2d'));
  } catch {
    return false;
  }
}

function hasCanvasBackingStore(): boolean {
  if (typeof HTMLCanvasElement === 'undefined') return false;
  const source = Function.prototype.toString.call(HTMLCanvasElement.prototype.getContext);
  return !source.includes('utils.tryWrapperForImpl');
}
