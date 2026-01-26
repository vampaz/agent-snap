chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  try {
    // Try to send a message first. If the content script is already there, it will toggle.
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_AGENT_SNAP' });
  } catch (error) {
    // If sendMessage fails, the content script likely isn't injected yet.
    // Inject it now.
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-script.js'],
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
