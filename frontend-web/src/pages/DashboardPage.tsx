import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { useAuthStore } from "../store/authStore";
import { auth } from "../firebase";

function initials(email: string, fullName: string | null) {
  if (fullName) return fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    navigate("/login");
  };

  const displayName = user?.full_name ?? user?.email?.split("@")[0] ?? "there";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎓</span>
            <span className="font-bold text-slate-800">Emma</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-slate-500">{user?.email}</span>
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold select-none">
              {initials(user?.email ?? "?", user?.full_name ?? null)}
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-slate-500 hover:text-rose-500 transition-colors font-medium"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* Greeting */}
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {greeting()}, {displayName} 👋
          </h2>
          <p className="text-slate-500 mt-1 text-sm">What would you like to practice today?</p>
        </div>

        {/* Feature mode cards */}
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
            Choose a feature
          </h3>
          <div className="grid grid-cols-2 gap-4 max-w-lg">
            <button
              onClick={() => navigate("/speak")}
              className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-left text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-150"
            >
              <span className="text-3xl mb-3 block">🎙</span>
              <p className="font-semibold text-base">口說</p>
              <p className="text-white/70 text-sm mt-1">AI voice conversation</p>
            </button>
            <button
              onClick={() => navigate("/listen")}
              className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-left text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-150"
            >
              <span className="text-3xl mb-3 block">📖</span>
              <p className="font-semibold text-base">聽讀</p>
              <p className="text-white/70 text-sm mt-1">Listen to articles</p>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
