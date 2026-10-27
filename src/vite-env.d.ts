/// <reference types="vite/client" />

declare module '*.css';

interface ImportMetaEnv {
  readonly VITE_LIVEBLOCKS_PUBLIC_KEY?: string;
}
