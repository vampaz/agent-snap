function isRestrictedUrl(url) {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('devtools://') ||
    url.startsWith('about:')
  );
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  if (isRestrictedUrl(tab.url)) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_AGENT_SNAP' });
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['config.js', 'content-script.js'],
      });

      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_AGENT_SNAP' });
        } catch (error) {
          console.error('Failed to toggle after injection:', error);
        }
      }, 100);
    } catch (error) {
      console.error('Failed to inject Agent Snap:', error);
    }
  }
});
