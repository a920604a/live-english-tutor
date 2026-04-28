import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { verifyWithBackend } from "../api/auth";
import { useAuthStore } from "../store/authStore";

const FEATURES = [
  { icon: "🎙️", text: "Real-time voice conversations" },
  { icon: "✏️", text: "Instant grammar corrections" },
  { icon: "📊", text: "Detailed lesson reports in Chinese" },
];

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
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl px-8 py-10">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-200">
              <span className="text-3xl">🎓</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Live English Tutor</h1>
            <p className="text-slate-500 text-sm mt-1.5">
              Practice with your AI tutor Emma, anytime.
            </p>
          </div>

          {/* Features */}
          <ul className="space-y-2.5 mb-8">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex items-center gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-base">
                  {f.icon}
                </span>
                <span className="text-sm text-slate-600">{f.text}</span>
              </li>
            ))}
          </ul>

          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-sm">
              {error}
            </div>
          )}

          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white border-2 border-slate-200 rounded-2xl font-semibold text-slate-700 text-sm hover:bg-slate-50 hover:border-slate-300 hover:shadow-md transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
            ) : (
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                className="w-5 h-5"
              />
            )}
            {loading ? "Signing in…" : "Continue with Google"}
          </button>
        </div>

        <p className="text-center text-slate-500 text-xs mt-5">
          Free to use · No credit card required
        </p>
      </div>
    </div>
  );
}
