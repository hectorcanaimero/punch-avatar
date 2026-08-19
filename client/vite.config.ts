import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// WHY: host: true expone en la IP LAN (útil para playtest con varios dispositivos
// en la misma red). Puerto 5173 default de Vite.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
