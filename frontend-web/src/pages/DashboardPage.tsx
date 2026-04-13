import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { createSession, getSessions, Session } from "../api/sessions";
import { useAuthStore } from "../store/authStore";
import { auth } from "../firebase";

const TOPICS = [
  "General Conversation",
  "Job Interview English",
  "Travel English",
  "Business English",
  "Daily Life English",
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    navigate("/login");
  };
  const [sessions, setSessions] = useState<Session[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getSessions().then(setSessions).catch(console.error);
  }, []);

  const handleStart = async (topic: string) => {
    setCreating(true);
    try {
      const session = await createSession(topic);
      navigate(`/lesson/${session.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>Dashboard</h1>
        <div>
          <span>{user?.email}</span>
          <button onClick={handleLogout} style={{ marginLeft: 8 }}>
            Logout
          </button>
        </div>
      </div>

      <h2>Start a New Lesson</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TOPICS.map((topic) => (
          <button key={topic} onClick={() => handleStart(topic)} disabled={creating}>
            {topic}
          </button>
        ))}
      </div>

      <h2>Past Sessions</h2>
      {sessions.length === 0 ? (
        <p>No sessions yet. Start your first lesson above!</p>
      ) : (
        <ul>
          {sessions.map((s) => (
            <li key={s.id}>
              <strong>{s.topic}</strong> — {s.status} — {new Date(s.created_at).toLocaleString()}
              {s.status === "ended" && (
                <button onClick={() => navigate(`/report/${s.id}`)} style={{ marginLeft: 8 }}>
                  View Report
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
