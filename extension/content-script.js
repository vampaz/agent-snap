const globalKey = "__agentSnapInstance";
let cachedCreate = null;

async function getCreateAgentSnap() {
  if (cachedCreate) return cachedCreate;
  if (!globalThis.chrome?.runtime?.getURL) {
    throw new Error("Agent Snap: chrome.runtime.getURL is unavailable.");
  }
  const moduleUrl = chrome.runtime.getURL("dist/index.mjs");
  const module = await import(moduleUrl);
  cachedCreate = module.createAgentSnap;
  return cachedCreate;
}

async function toggleAnnotator() {
  const existing = globalThis[globalKey];
  if (existing && typeof existing.destroy === "function") {
    existing.destroy();
    globalThis[globalKey] = null;
    return;
  }

  const createAgentSnap = await getCreateAgentSnap();
  const instance = createAgentSnap({
    mount: document.body,
  });
  globalThis[globalKey] = instance;
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "TOGGLE_AGENT_SNAP") return;
  toggleAnnotator().catch((error) => {
    console.error("Agent Snap toggle failed:", error);
  });
});
