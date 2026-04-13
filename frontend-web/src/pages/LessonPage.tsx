import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LiveKitRoom, RoomAudioRenderer, useVoiceAssistant } from "@livekit/components-react";
import { endSession, getSessionToken } from "../api/sessions";
import CorrectionPanel from "../components/lesson/CorrectionPanel";
import AgentStatus from "../components/lesson/AgentStatus";
import VoiceControls from "../components/lesson/VoiceControls";

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
      navigate(`/report/${id}`);
    } catch {
      navigate(`/report/${id}`);
    }
  };

  if (!token) {
    return <div style={{ padding: 40 }}>Connecting to your lesson...</div>;
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      audio
      video={false}
    >
      <RoomAudioRenderer />
      <div style={{ maxWidth: 800, margin: "40px auto", padding: "0 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1>Lesson in Progress</h1>
          <button onClick={handleEndSession} disabled={ending} style={{ color: "red" }}>
            {ending ? "Ending..." : "End Lesson"}
          </button>
        </div>
        <AgentStatus />
        <CorrectionPanel />
        <VoiceControls />
      </div>
    </LiveKitRoom>
  );
}
