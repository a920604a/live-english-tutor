import axios, { AxiosError } from "axios";
import toast from "react-hot-toast";
import { auth } from "../firebase";

// Dev: empty string → requests go through Vite proxy (vite.config.ts)
// Prod: set VITE_API_BASE_URL to the backend domain in Cloudflare Pages env vars
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

const client = axios.create({ baseURL: API_BASE_URL });

// ── Request interceptor ──────────────────────────────────────────────────────
// Attach a fresh Firebase ID token before every request and log it.
client.interceptors.request.use(async (config) => {
  const currentUser = auth.currentUser;
  if (currentUser) {
    const idToken = await currentUser.getIdToken();
    config.headers.Authorization = `Bearer ${idToken}`;
  }
  // Tag each request with a timestamp so the response interceptor can log ms.
  (config as unknown as Record<string, unknown>)._startMs = Date.now();
  console.debug(
    `[API] → ${config.method?.toUpperCase()} ${config.baseURL ?? ""}${config.url}`
  );
  return config;
});

// ── Response interceptor ─────────────────────────────────────────────────────
client.interceptors.response.use(
  (response) => {
    const ms = Date.now() - (((response.config as unknown as Record<string, unknown>)._startMs as number) ?? Date.now());
    console.debug(
      `[API] ← ${response.config.method?.toUpperCase()} ${response.config.url} ${response.status}  ${ms}ms`
    );
    return response;
  },
  (error: AxiosError) => {
    const config = error.config as Record<string, unknown> | undefined;
    const ms = Date.now() - ((config?._startMs as number) ?? Date.now());
    const status = error.response?.status;
    const method = error.config?.method?.toUpperCase();
    const url = error.config?.url;

    console.error(
      `[API] ✗ ${method} ${url} ${status ?? "ERR"}  ${ms}ms`,
      error.response?.data ?? error.message
    );

    // Show a toast only for server errors (5xx) and network failures.
    if (!status || status >= 500) {
      toast.error(
        status
          ? `伺服器錯誤 (${status})，請稍後再試`
          : "網路連線失敗，請確認網路狀態",
        { duration: 4000 }
      );
    }

    return Promise.reject(error);
  }
);

export default client;
