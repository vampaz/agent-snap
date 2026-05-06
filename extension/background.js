function isRestrictedUrl(url) {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('devtools://') ||
    url.startsWith('about:')
  );
}

const DEBUGGER_PROTOCOL_VERSION = '1.3';

function getRuntimeError() {
  return chrome.runtime.lastError?.message || '';
}

function attachDebugger(target) {
  return new Promise((resolve, reject) => {
    if (!chrome.debugger?.attach) {
      reject(new Error('Chrome debugger API is unavailable.'));
      return;
    }

    chrome.debugger.attach(target, DEBUGGER_PROTOCOL_VERSION, () => {
      const message = getRuntimeError();
      if (message) {
        reject(new Error(message));
        return;
      }
      resolve();
    });
  });
}

function detachDebugger(target) {
  return new Promise((resolve) => {
    if (!chrome.debugger?.detach) {
      resolve();
      return;
    }

    chrome.debugger.detach(target, () => {
      resolve();
    });
  });
}

function sendDebuggerCommand(target, method, params) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(target, method, params, (result) => {
      const message = getRuntimeError();
      if (message) {
        reject(new Error(message));
        return;
      }
      resolve(result);
    });
  });
}

function getScreenshotClip(clip) {
  if (!clip) return null;
  const x = Number(clip.x);
  const y = Number(clip.y);
  const width = Number(clip.width);
  const height = Number(clip.height);
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    width: width,
    height: height,
    scale: 1,
  };
}

async function captureWithDebugger(tabId, clip) {
  const screenshotClip = getScreenshotClip(clip);
  if (!screenshotClip) return null;

  const target = { tabId };
  let attached = false;
  try {
    await attachDebugger(target);
    attached = true;
    const result = await sendDebuggerCommand(target, 'Page.captureScreenshot', {
      captureBeyondViewport: true,
      clip: screenshotClip,
      format: 'png',
      fromSurface: true,
    });
    if (!result?.data) return null;
    return `data:image/png;base64,${result.data}`;
  } catch {
    return null;
  } finally {
    if (attached) {
      await detachDebugger(target);
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (
    message?.type !== 'AGENT_SNAP_CAPTURE_NODE' &&
    message?.type !== 'AGENT_SNAP_CAPTURE_VISIBLE_TAB'
  ) {
    return;
  }

  const windowId = sender.tab?.windowId;
  const tabId = sender.tab?.id;

  async function capture() {
    if (typeof tabId === 'number' && message.type === 'AGENT_SNAP_CAPTURE_NODE') {
      const dataUrl = await captureWithDebugger(tabId, message.clip);
      if (dataUrl) {
        sendResponse({ dataUrl, kind: 'debugger' });
        return;
      }
    }

    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
      sendResponse({ dataUrl, kind: 'visible-tab' });
    } catch (error) {
      sendResponse({ error: error?.message || 'Unable to capture visible tab.' });
    }
  }

  capture();

  return true;
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  if (isRestrictedUrl(tab.url)) return;

  try {
    // Try to send a message first. If the content script is already there, it will toggle.
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_AGENT_SNAP' });
  } catch {
    // If sendMessage fails, the content script likely isn't injected yet.
    // Inject it now.
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['config.js', 'content-script.js'],
      });
      // After injection, the content script initiates automatically or we might need to toggle it.
      // Based on typical patterns, the content script might need an initial "kick" or it might run on load.
      // Let's send the toggle message again after a brief moment to ensure it catches it,
      // OR rely on the content script to auto-initialize if that's how it's written.
      // Looking at the previous pattern, it expects a TOGGLE_AGENT_SNAP message.

      // Let's retry the toggle message after injection
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_AGENT_SNAP' });
        } catch (e) {
          console.error('Failed to toggle after injection:', e);
        }
      }, 100);
    } catch (scriptError) {
      console.error('Failed to inject Agent Snap:', scriptError);
    }
  }
});
