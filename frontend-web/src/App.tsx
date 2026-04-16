import { useEffect, useState } from "react";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { useAuthStore } from "./store/authStore";
import { verifyWithBackend } from "./api/auth";
import { router } from "./router";

/**
 * Root component.
 *
 * Waits for Firebase to resolve the persisted auth state before rendering
 * the router.  This prevents a flash-redirect to /login on page refresh
 * when the user is already signed in.
 *
 * Flow on reload:
 *  1. Firebase restores the session from IndexedDB/localStorage
 *  2. onAuthStateChanged fires with the firebaseUser
 *  3. We call verifyWithBackend to get the DB user and store it in Zustand
 *  4. authReady → true → render the router
 */
export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          const appUser = await verifyWithBackend(idToken);
          setUser(appUser);
        } catch {
          // Token invalid or backend unreachable — treat as signed out
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setAuthReady(true);
    });

    return unsubscribe;
  }, [setUser]);

  if (!authReady) {
    return (
      <div style={{ display: "flex", justifyContent: "center", marginTop: 120 }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          error: {
            style: { background: "#fef2f2", color: "#991b1b", border: "1px solid #fca5a5" },
            iconTheme: { primary: "#ef4444", secondary: "#fff" },
          },
        }}
      />
      <RouterProvider router={router} />
    </>
  );
}
