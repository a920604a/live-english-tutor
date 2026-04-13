import { useVoiceAssistant } from "@livekit/components-react";

const STATE_LABELS: Record<string, string> = {
  disconnected: "Waiting for tutor...",
  connecting: "Connecting...",
  initializing: "Initializing...",
  listening: "Listening...",
  thinking: "Thinking...",
  speaking: "Emma is speaking...",
};

export default function AgentStatus() {
  const { state } = useVoiceAssistant();

  return (
    <div style={{ padding: "12px 0", fontSize: 18, fontWeight: "bold" }}>
      {STATE_LABELS[state] ?? state}
    </div>
  );
}
