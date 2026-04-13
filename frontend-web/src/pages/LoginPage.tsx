import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { verifyWithBackend } from "../api/auth";
import { useAuthStore } from "../store/authStore";

export default function LoginPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      const appUser = await verifyWithBackend(idToken);
      setUser(appUser);
      navigate("/");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err as Error)?.message ??
        "Sign-in failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 400,
        margin: "120px auto",
        padding: "0 16px",
        textAlign: "center",
      }}
    >
      <h1 style={{ marginBottom: 8 }}>Live English Tutor</h1>
      <p style={{ color: "#666", marginBottom: 40 }}>
        Practice English with your AI tutor Emma — anytime, anywhere.
      </p>

      {error && (
        <p style={{ color: "red", marginBottom: 16 }}>{error}</p>
      )}

      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 24px",
          fontSize: 16,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        <img
          src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
          alt="Google"
          width={20}
          height={20}
        />
        {loading ? "Signing in..." : "Sign in with Google"}
      </button>
    </div>
  );
}
