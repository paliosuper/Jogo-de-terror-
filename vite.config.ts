import { defineConfig } from "vite";

// Freebuff: dev server binds 0.0.0.0, PORT is injected by the platform,
// HMR stays disabled (the platform picks up edits itself).
export default defineConfig({
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
});
