/// <reference types="@types/google.maps" />

// Allow CSS side-effect imports in TypeScript
declare module '*.css' {
  const content: unknown;
  export default content;
}
