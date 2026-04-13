import axios from "axios";
import { auth } from "../firebase";

// Dev: empty string → requests go through Vite proxy (vite.config.ts)
// Prod: set VITE_API_BASE_URL to the backend domain in Cloudflare Pages env vars
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

const client = axios.create({ baseURL: API_BASE_URL });

/**
 * Async request interceptor:
 * - Retrieves a fresh Firebase ID token before every request
 * - Firebase SDK automatically refreshes the token if it has expired
 */
client.interceptors.request.use(async (config) => {
  const currentUser = auth.currentUser;
  if (currentUser) {
    const idToken = await currentUser.getIdToken();
    config.headers.Authorization = `Bearer ${idToken}`;
  }
  return config;
});

export default client;
