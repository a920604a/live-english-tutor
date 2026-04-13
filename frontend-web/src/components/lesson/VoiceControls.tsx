import { useLocalParticipant } from "@livekit/components-react";

export default function VoiceControls() {
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();

  const toggleMic = () => {
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  };

  return (
    <div style={{ marginTop: 24 }}>
      <button
        onClick={toggleMic}
        style={{
          padding: "12px 24px",
          fontSize: 16,
          background: isMicrophoneEnabled ? "#d9534f" : "#5cb85c",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        {isMicrophoneEnabled ? "Mute Microphone" : "Unmute Microphone"}
      </button>
    </div>
  );
}
