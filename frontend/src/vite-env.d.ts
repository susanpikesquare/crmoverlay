/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PROD: boolean
  readonly DEV: boolean
  // Add other env variables here if needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
