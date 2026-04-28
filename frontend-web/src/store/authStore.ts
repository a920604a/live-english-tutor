import { create } from "zustand";

export interface AppUser {
  id: number;
  email: string;
  full_name: string | null;
  firebase_uid: string;
}

interface AuthState {
  user: AppUser | null;
  setUser: (user: AppUser | null) => void;
}

/**
 * Lightweight auth store — only stores the backend user object.
 * Firebase manages the actual ID token lifecycle internally;
 * use `auth.currentUser.getIdToken()` to get a fresh token on demand.
 *
 * We intentionally do NOT persist the user to localStorage here because
 * `onAuthStateChanged` in App.tsx re-hydrates the store on every page load.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
