const globalKey = '__agentSnapInstance';
const hostKey = '__agentSnapHost';
let cachedCreate = null;

function waitForFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load captured tab image.'));
    image.src = src;
  });
}

function getViewportRect(request) {
  if (request.element instanceof HTMLElement && request.element.isConnected) {
    const rect = request.element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }

  return {
    left: request.bounds.x - window.scrollX,
    top: request.bounds.y - window.scrollY,
    width: request.bounds.width,
    height: request.bounds.height,
  };
}

async function cropVisibleTabScreenshot(dataUrl, request) {
  const image = await loadImage(dataUrl);
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scaleX = image.naturalWidth / viewportWidth;
  const scaleY = image.naturalHeight / viewportHeight;
  const rect = getViewportRect(request);
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(viewportWidth, rect.left + rect.width);
  const bottom = Math.min(viewportHeight, rect.top + rect.height);
  const width = Math.round((right - left) * scaleX);
  const height = Math.round((bottom - top) * scaleY);
  if (width <= 0 || height <= 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.drawImage(
    image,
    Math.round(left * scaleX),
    Math.round(top * scaleY),
    width,
    height,
    0,
    0,
    width,
    height,
  );

  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

async function captureScreenshot(request) {
  const host = globalThis[hostKey];
  const display = host?.style?.getPropertyValue('display');
  const priority = host?.style?.getPropertyPriority('display');

  if (host?.style) {
    host.style.setProperty('display', 'none', 'important');
    await waitForFrame();
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'AGENT_SNAP_CAPTURE_VISIBLE_TAB',
    });
    if (!response?.dataUrl) return null;
    return cropVisibleTabScreenshot(response.dataUrl, request);
  } finally {
    if (host?.style) {
      host.style.setProperty('display', display || 'block', priority || 'important');
    }
  }
}

async function getCreateAgentSnap() {
  if (cachedCreate) return cachedCreate;
  if (!globalThis.chrome?.runtime?.getURL) {
    throw new Error('Agent Snap: chrome.runtime.getURL is unavailable.');
  }
  const moduleUrl = chrome.runtime.getURL('dist/index.mjs');
  const module = await import(moduleUrl);
  cachedCreate = module.createAgentSnap;
  return cachedCreate;
}

async function toggleAnnotator() {
  const existing = globalThis[globalKey];
  const existingHost = globalThis[hostKey];
  if (existing && typeof existing.destroy === 'function') {
    existing.destroy();
    globalThis[globalKey] = null;
    if (existingHost && typeof existingHost.remove === 'function') {
      existingHost.remove();
    }
    globalThis[hostKey] = null;
    return;
  }

  const createAgentSnap = await getCreateAgentSnap();
  const host = document.createElement('div');
  host.id = 'agent-snap-extension-host';
  host.dataset.agentSnapHost = 'true';
  host.style.setProperty('all', 'initial', 'important');
  host.style.setProperty('position', 'fixed', 'important');
  host.style.setProperty('top', '0', 'important');
  host.style.setProperty('left', '0', 'important');
  host.style.setProperty('width', '0', 'important');
  host.style.setProperty('height', '0', 'important');
  host.style.setProperty('z-index', '2147483647', 'important');
  host.style.setProperty('display', 'block', 'important');

  const mountRoot = document.body || document.documentElement;
  mountRoot.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const instance = createAgentSnap({
    mount: shadow,
    captureScreenshot: captureScreenshot,
  });
  globalThis[globalKey] = instance;
  globalThis[hostKey] = host;
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'TOGGLE_AGENT_SNAP') return;
  toggleAnnotator().catch((error) => {
    console.error('Agent Snap toggle failed:', error);
  });
});
