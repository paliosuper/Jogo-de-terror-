import { defineConfig } from "vite";

// Freebuff: dev server binds 0.0.0.0, PORT is injected by the platform,
// HMR stays disabled (the platform picks up edits itself).
// The repo root keeps Qwen's vanilla-JS game (deployed by GitHub Pages);
// our Vite/TypeScript game lives in app/ so both coexist.
export default defineConfig({
  root: "app",
  server: {
    host: true,
    port: Number(process.env.PORT ?? 5173),
    strictPort: false,
    hmr: false,
  },
  preview: {
    host: true,
    port: Number(process.env.PORT ?? 5173),
    strictPort: false,
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
