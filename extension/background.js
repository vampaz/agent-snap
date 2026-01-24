chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_AGENT_SNAP" });
  } catch (error) {
    console.error("Failed to toggle Agent Snap:", error);
  }
});
