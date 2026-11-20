/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SYNC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** App version from apps/web/package.json, injected by Vite. */
declare const __APP_VERSION__: string
