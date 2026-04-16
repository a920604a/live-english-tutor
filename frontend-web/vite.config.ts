import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  // loadEnv with "" prefix loads ALL env vars (including non-VITE_ ones),
  // which are safe to use here in the build config but are NOT exposed to the browser.
  const env = loadEnv(mode, process.cwd(), "");

  const backendUrl = env.BACKEND_PROXY_URL || "http://localhost:8118";
  const livekitUrl = env.LIVEKIT_PROXY_URL || "http://localhost:7880";

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        "/auth": backendUrl,
        "/sessions": backendUrl,
        "/internal": backendUrl,
        "/rtc": {
          target: livekitUrl,
          ws: true,
          changeOrigin: true,
        },
        "/livekit.LiveKit": {
          target: livekitUrl,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
