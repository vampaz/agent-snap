# Agent Snap Chrome Extension

Loads the Agent Snap on the current page only when you click the extension button.

## Build

1. Build the library:
   ```bash
   npm run build
   ```
2. Copy the build output into the extension folder:
   ```bash
   rm -rf extension/dist
   cp -R dist extension/dist
   ```

## Load unpacked

1. Open Chrome → Extensions → Enable Developer Mode.
2. Click **Load unpacked** and select the `extension` folder.
3. Click the extension button on any page to toggle the annotator on/off.
