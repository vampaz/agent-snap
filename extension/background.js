chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_UI_ANNOTATOR" });
  } catch (error) {
    console.error("Failed to toggle UI annotator:", error);
  }
});
