/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Active AI provider. Only "mock" is implemented today. Defaults to "mock" when unset. */
  readonly VITE_AI_PROVIDER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
