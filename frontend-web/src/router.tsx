import { createBrowserRouter, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import LessonPage from "./pages/LessonPage";
import ReportPage from "./pages/ReportPage";
import MaterialListPage from "./pages/listen/MaterialListPage";
import MaterialUploadPage from "./pages/listen/MaterialUploadPage";
import ListenPlayerPage from "./pages/listen/ListenPlayerPage";
import { auth } from "./firebase";

/**
 * Route guard: uses Firebase's currentUser (synchronous after onAuthStateChanged
 * has resolved in App.tsx) to decide whether to allow access.
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!auth.currentUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter(
  [
    { path: "/login", element: <LoginPage /> },
    {
      path: "/",
      element: (
        <RequireAuth>
          <DashboardPage />
        </RequireAuth>
      ),
    },
    {
      path: "/lesson/:id",
      element: (
        <RequireAuth>
          <LessonPage />
        </RequireAuth>
      ),
    },
    {
      path: "/report/:id",
      element: (
        <RequireAuth>
          <ReportPage />
        </RequireAuth>
      ),
    },
    {
      path: "/listen",
      element: <RequireAuth><MaterialListPage /></RequireAuth>,
    },
    {
      path: "/listen/upload",
      element: <RequireAuth><MaterialUploadPage /></RequireAuth>,
    },
    {
      path: "/listen/:id/player",
      element: <RequireAuth><ListenPlayerPage /></RequireAuth>,
    },
    { path: "*", element: <Navigate to="/" replace /> },
  ],
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    future: { v7_startTransition: true } as any,
  }
);
