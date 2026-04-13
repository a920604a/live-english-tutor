import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LiveKitRoom, RoomAudioRenderer, useVoiceAssistant } from "@livekit/components-react";
import { endSession, getSessionToken } from "../api/sessions";
import CorrectionPanel from "../components/lesson/CorrectionPanel";
import AgentStatus from "../components/lesson/AgentStatus";
import VoiceControls from "../components/lesson/VoiceControls";

function EmmaAvatar() {
  const { state } = useVoiceAssistant();
  const isSpeaking = state === "speaking";

  return (
    <div className="relative flex items-center justify-center w-28 h-28">
      {/* Pulse rings */}
      {isSpeaking && (
        <>
          <span className="absolute inset-0 rounded-full bg-indigo-400/30 emma-ring-1" />
          <span className="absolute inset-0 rounded-full bg-indigo-400/20 emma-ring-2" />
        </>
      )}
      <div className={`w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl transition-all duration-300 ${isSpeaking ? "scale-105 shadow-indigo-300" : ""}`}>
        <span className="text-4xl select-none">🎓</span>
      </div>
    </div>
  );
}

function LessonInner({ sessionId, onEnd, ending }: { sessionId: string; onEnd: () => void; ending: boolean }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col">
      <RoomAudioRenderer />

      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎓</span>
          <span className="font-bold text-white text-sm">Emma</span>
        </div>
        <button
          onClick={onEnd}
          disabled={ending}
          className="text-xs font-semibold px-4 py-2 rounded-full bg-white/10 text-white/80 hover:bg-rose-500 hover:text-white transition-all duration-150 disabled:opacity-50"
        >
          {ending ? "Ending…" : "End Lesson"}
        </button>
      </header>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 pb-6">
        <EmmaAvatar />

        <div className="text-center">
          <p className="text-white font-semibold text-lg">Emma</p>
          <div className="mt-1">
            <AgentStatus />
          </div>
        </div>

        {/* Dot typing indicator when thinking */}
        <div className="h-5 flex items-center gap-1">
          {/* Rendered by AgentStatus state; placeholder keeps layout stable */}
        </div>

        <VoiceControls />
      </div>

      {/* Corrections panel pinned at bottom */}
      <div className="px-4 pb-6 max-w-lg w-full mx-auto">
        <CorrectionPanel />
      </div>
    </div>
  );
}

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string>("");
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (!id) return;
    getSessionToken(Number(id))
      .then(({ token, url }) => {
        setToken(token);
        setServerUrl(url);
      })
      .catch(console.error);
  }, [id]);

  const handleEndSession = async () => {
    if (!id || ending) return;
    setEnding(true);
    try {
      await endSession(Number(id));
    } catch {
      // ignore
    } finally {
      navigate(`/report/${id}`);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-300/30 border-t-indigo-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm">Connecting to your lesson…</p>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom token={token} serverUrl={serverUrl} connect audio video={false}>
      <LessonInner sessionId={id!} onEnd={handleEndSession} ending={ending} />
    </LiveKitRoom>
  );
}
