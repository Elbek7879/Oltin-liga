/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "mock" — backendsiz namunaviy rejim; aks holda haqiqiy API */
  readonly VITE_API_MODE?: "mock" | "http"
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
