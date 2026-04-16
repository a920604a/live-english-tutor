import { createBrowserRouter, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import LessonPage from "./pages/LessonPage";
import ReportPage from "./pages/ReportPage";
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
    { path: "*", element: <Navigate to="/" replace /> },
  ],
  {
    future: {
      v7_startTransition: true,
    },
  }
);
