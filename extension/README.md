# Extension Build Notes

The extension version is synced from the root `package.json` when packaging a release.

- `npm run build:ext` builds the unpacked extension in `extension/dist`.
- `npm run build:ext:env` builds the unpacked extension using `EXT_UPLOAD_PUBLIC_KEY` from `.env`.
- `npm run package:ext` syncs the manifest version, builds the extension, and writes `agent-snap-extension-v<version>.zip`.
