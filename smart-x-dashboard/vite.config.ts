import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxies /api/* to the ASP.NET Core Minimal API so the browser never has to
// deal with CORS during development. The API's own routes have no "/api"
// prefix, so it's stripped back off before forwarding.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5067",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});