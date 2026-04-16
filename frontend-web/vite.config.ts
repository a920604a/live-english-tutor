import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/auth": "http://localhost:8118",
      "/sessions": "http://localhost:8118",
      "/internal": "http://localhost:8118",
      // LiveKit WebSocket signaling — routes through Vite so VS Code SSH
      // port-forwarding (port 5173) carries the signal without needing
      // a separate forward for port 7880.
      "/rtc": {
        target: "http://localhost:7880",
        ws: true,
        changeOrigin: true,
      },
      "/livekit.LiveKit": {
        target: "http://localhost:7880",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
