import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createSession, getSessions, Session } from "../api/sessions";

const TOPICS = [
  {
    name: "General Conversation",
    emoji: "💬",
    desc: "Everyday chat & free talk",
    gradient: "from-violet-500 to-indigo-600",
  },
  {
    name: "Job Interview English",
    emoji: "💼",
    desc: "STAR answers & self-intro",
    gradient: "from-blue-500 to-cyan-600",
  },
  {
    name: "Travel English",
    emoji: "✈️",
    desc: "Airport, hotel & dining",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    name: "Business English",
    emoji: "📈",
    desc: "Meetings, emails & pitches",
    gradient: "from-slate-600 to-slate-800",
  },
  {
    name: "Daily Life English",
    emoji: "🏠",
    desc: "Shopping, errands & services",
    gradient: "from-amber-500 to-orange-500",
  },
];

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending",   cls: "bg-amber-100 text-amber-700" },
  active:  { label: "Active",    cls: "bg-blue-100 text-blue-700" },
  ended:   { label: "Completed", cls: "bg-slate-100 text-slate-500" },
};

export default function SpeakPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    getSessions().then(setSessions).catch(console.error);
  }, []);

  const handleStart = async (topic: string) => {
    setCreating(topic);
    try {
      const session = await createSession(topic);
      navigate(`/lesson/${session.id}`);
    } catch (err) {
      console.error(err);
      setCreating(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center">
          <button
            onClick={() => navigate("/")}
            className="text-sm text-slate-500 hover:text-slate-800 font-medium"
          >
            ← Back
          </button>
          <span className="font-bold text-slate-800 mx-auto">🎙 口說練習</span>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* Topic cards */}
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
            Choose a topic
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TOPICS.map((t) => (
              <button
                key={t.name}
                onClick={() => handleStart(t.name)}
                disabled={creating !== null}
                className={`bg-gradient-to-br ${t.gradient} rounded-2xl p-5 text-left text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <span className="text-3xl mb-3 block">{t.emoji}</span>
                <p className="font-semibold text-base leading-tight">{t.name}</p>
                <p className="text-white/70 text-sm mt-1">{t.desc}</p>
                {creating === t.name && (
                  <div className="mt-3 flex items-center gap-1.5 text-white/90 text-xs font-medium">
                    <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Starting…
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Session history */}
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
            Recent sessions
          </h3>

          {sessions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 py-14 text-center">
              <span className="text-4xl block mb-3">📚</span>
              <p className="text-slate-400 text-sm">No sessions yet — start your first lesson above!</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {sessions.map((s, i) => {
                const topicMeta = TOPICS.find((t) => t.name === s.topic);
                const badge = STATUS_STYLE[s.status] ?? STATUS_STYLE.pending;
                return (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between px-5 py-3.5 ${
                      i !== sessions.length - 1 ? "border-b border-slate-100" : ""
                    } hover:bg-slate-50 transition-colors`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl flex-shrink-0">{topicMeta?.emoji ?? "💬"}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{s.topic}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(s.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${badge.cls}`}>
                        {badge.label}
                      </span>
                      {s.status === "ended" && (
                        <button
                          onClick={() => navigate(`/report/${s.id}`)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors whitespace-nowrap"
                        >
                          View Report →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
