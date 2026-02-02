# Extension Build Notes

The extension can embed an upload key at build time.

1. Set `EXT_UPLOAD_PUBLIC_KEY` in your environment (or put it in `.env`).
2. Run `npm run build:ext`, `npm run build:ext:env`, or `npm run package:ext`.

The build writes `extension/config.js` (ignored by git) and injects it before
`content-script.js` so uploads are enabled only when the key is present.
