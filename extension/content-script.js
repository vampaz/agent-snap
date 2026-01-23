const globalKey = "__uiAnnotatorInstance";
let cachedCreate = null;

async function getCreateUiAnnotator() {
  if (cachedCreate) return cachedCreate;
  if (!globalThis.chrome?.runtime?.getURL) {
    throw new Error("UI Annotator: chrome.runtime.getURL is unavailable.");
  }
  const moduleUrl = chrome.runtime.getURL("dist/index.mjs");
  const module = await import(moduleUrl);
  cachedCreate = module.createUiAnnotator;
  return cachedCreate;
}

async function toggleAnnotator() {
  const existing = globalThis[globalKey];
  if (existing && typeof existing.destroy === "function") {
    existing.destroy();
    globalThis[globalKey] = null;
    return;
  }

  const createUiAnnotator = await getCreateUiAnnotator();
  const instance = createUiAnnotator({
    mount: document.body,
  });
  globalThis[globalKey] = instance;
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "TOGGLE_UI_ANNOTATOR") return;
  toggleAnnotator().catch((error) => {
    console.error("UI Annotator toggle failed:", error);
  });
});
