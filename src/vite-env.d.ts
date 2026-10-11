/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the real RailFlow auth REST API. When unset, the clearly
   *  labeled development mock adapter is used instead. */
  readonly VITE_AUTH_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
