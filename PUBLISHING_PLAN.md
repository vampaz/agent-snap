# Chrome Web Store Publishing Plan

This document outlines the steps required to publish the **UI Annotator** extension to the Chrome Web Store.

## 1. Prerequisites

- **Google Developer Account**: required to publish items to the Chrome Web Store (One-time $5 fee).
  - [Register here](https://chrome.google.com/webstore/dev/register)

## 2. Prepare Extension Assets

The extension currently lacks specific image assets required by the Chrome Web Store and the manifest.

### 2.1. Generate Icons
Create the following PNG icons and place them in `extension/assets/icons/`:
- `icon-16.png` (16x16)
- `icon-32.png` (32x32)
- `icon-48.png` (48x48)
- `icon-128.png` (128x128)

*Tip: You can export one of the SVGs from `src/icons` to PNG format.*

### 2.2. Store Listing Images
Prepare the following promotional images for the store listing:
- **Screenshots**: At least one (1280x800 or 640x400). Show the annotator in action on a page.
- **Small Tile**: 440x280 px (JPEG or PNG).
- **Marquee Tile**: 920x680 px (JPEG or PNG).

## 3. Update Code & Configuration

### 3.1. Update `manifest.json`
Update `extension/manifest.json` to include the icons and ensure metadata is correct.

```json
{
  "manifest_version": 3,
  "name": "UI Annotator",
  "version": "0.1.0",
  "description": "Framework-agnostic UI annotation for agents",
  "icons": {
    "16": "assets/icons/icon-16.png",
    "32": "assets/icons/icon-32.png",
    "48": "assets/icons/icon-48.png",
    "128": "assets/icons/icon-128.png"
  },
  "action": {
    "default_title": "Toggle UI Annotator",
    "default_icon": {
      "16": "assets/icons/icon-16.png",
      "32": "assets/icons/icon-32.png",
      "48": "assets/icons/icon-48.png",
      "128": "assets/icons/icon-128.png"
    }
  },
  // ... existing configuration
}
```

### 3.2. Versioning
Ensure the `version` in `extension/manifest.json` is correct. It should be incremented for every new publication.

## 4. Build & Package

### 4.1. Build Script
The current `build:ext` script in `package.json` builds the code but doesn't zip it.
Add a `package:ext` script to `package.json` to create the zip file required for upload.

```json
"scripts": {
  "package:ext": "npm run build:ext && cd extension && zip -r ../extension.zip . -x '*.git*' -x '*.DS_Store*'"
}
```

### 4.2. Create the Zip
Run the command:
```bash
npm run package:ext
```
This will generate `extension.zip` in the root directory.

## 5. Submission Process

1.  **Go to Developer Dashboard**: [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/dev/home)
2.  **Add New Item**: Click "New Item" and upload `extension.zip`.
3.  **Fill Listing Details**:
    -   **Description**: Explain what the tool does (e.g., "A lightweight, framework-agnostic toolbar for annotating UI elements directly in the browser...").
    -   **Category**: Developer Tools.
    -   **Language**: English.
    -   **Graphic Assets**: Upload the Screenshots and Tiles prepared in Step 2.
4.  **Privacy Practices**:
    -   **Permissions**: Justify `activeTab` (for inserting the script) and `scripting` (for executing the code).
    -   **Data Usage**: Disclose if you collect any data (current implementation seems local-only, so verify "No" for collection if true).
5.  **Submit for Review**: Click "Submit for Review".
    -   Review usually takes 24-48 hours.

## 6. Post-Publishing
-   Update `README.md` with the Chrome Web Store link.
-   Tag the release in Git.
