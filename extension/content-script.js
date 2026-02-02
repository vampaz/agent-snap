const globalKey = '__agentSnapInstance';
const hostKey = '__agentSnapHost';
let cachedCreate = null;

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
  const uploadApiKey = String(globalThis.__agentSnapUploadKey || '');
  const instance = createAgentSnap({
    mount: shadow,
    settings: {
      uploadApiKey: uploadApiKey,
      uploadScreenshots: Boolean(uploadApiKey),
    },
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
