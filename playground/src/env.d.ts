/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGENT_SNAP_UPLOAD_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
