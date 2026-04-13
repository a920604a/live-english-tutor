import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls in dev to avoid CORS
      "/auth": "http://localhost:8000",
      "/sessions": "http://localhost:8000",
      "/internal": "http://localhost:8000",
    },
  },
});
