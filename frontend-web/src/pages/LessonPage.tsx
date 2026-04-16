import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LiveKitRoom, RoomAudioRenderer, useVoiceAssistant, useParticipants, useConnectionState } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
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

/** Dev-only panel: connection state + room participants */
function DebugPanel({ serverUrl }: { serverUrl: string }) {
  const connectionState = useConnectionState();
  const participants = useParticipants();

  const stateColor: Record<string, string> = {
    [ConnectionState.Connected]:    "text-emerald-400",
    [ConnectionState.Connecting]:   "text-amber-400",
    [ConnectionState.Reconnecting]: "text-amber-400",
    [ConnectionState.Disconnected]: "text-rose-400",
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/80 text-xs font-mono px-3 py-2 z-50 border-t border-white/10 space-y-0.5">
      <div>
        <span className="text-white/40">WS → </span>
        <span className="text-sky-300 break-all">{serverUrl}</span>
      </div>
      <div>
        <span className="text-white/40">Room: </span>
        <span className={stateColor[connectionState] ?? "text-white"}>
          {connectionState}
        </span>
      </div>
      <div>
        <span className="text-white/40">Participants ({participants.length}): </span>
        {participants.length === 0
          ? <span className="text-white/30">none</span>
          : participants.map((p) => (
            <span key={p.identity} className="mr-2">
              <span className={p.identity.startsWith("agent-") ? "text-violet-300" : "text-emerald-300"}>
                {p.identity}
              </span>
              {p.name ? <span className="text-white/40"> ({p.name})</span> : null}
            </span>
          ))
        }
      </div>
    </div>
  );
}

function LessonInner({ sessionId, onEnd, ending, serverUrl }: { sessionId: string; onEnd: () => void; ending: boolean; serverUrl: string }) {
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

      {/* Dev-only debug overlay */}
      {import.meta.env.DEV && <DebugPanel serverUrl={serverUrl} />}
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
        // In Vite dev mode, always route LiveKit signaling through the Vite
        // dev server (/rtc is proxied to localhost:7880 in vite.config.ts).
        // This avoids VS Code SSH tunnel issues where WebSocket to port 7880
        // gets closed mid-handshake. Port 5173 (Vite) is already forwarded.
        //
        // VITE_LIVEKIT_URL can still force a specific URL (e.g. LiveKit Cloud
        // in production builds). Empty string or unset = auto behaviour below.
        const envUrl = import.meta.env.VITE_LIVEKIT_URL;
        if (envUrl) {
          // Explicit non-empty override (e.g. wss://your-project.livekit.cloud)
          setServerUrl(envUrl);
        } else if (import.meta.env.DEV) {
          // Dev: proxy through Vite dev server origin (ws://localhost:5173)
          setServerUrl(window.location.origin.replace(/^http/, "ws"));
        } else {
          // Production: use the URL returned by the backend
          setServerUrl(url);
        }
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
      <LessonInner sessionId={id!} onEnd={handleEndSession} ending={ending} serverUrl={serverUrl} />
    </LiveKitRoom>
  );
}
