import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  base: mode === "pilot" ? "/" : "/qrmagic/",
  build: { outDir: mode === "pilot" ? "dist-pilot" : "dist" },
  plugins: [react()],
  // The exporter is lazy-loaded. Prebundle fontkit before editing starts so its
  // first use cannot trigger Vite's dependency-discovery full-page reload.
  optimizeDeps: { include: ["@pdf-lib/fontkit", "qrcode-generator"] },
}));
