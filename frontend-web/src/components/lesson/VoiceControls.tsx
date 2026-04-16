import { useLocalParticipant } from "@livekit/components-react";

export default function VoiceControls() {
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();

  const startSpeaking = () => localParticipant.setMicrophoneEnabled(true);
  const stopSpeaking = () => localParticipant.setMicrophoneEnabled(false);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        {/* Pulse ring when mic is active */}
        {isMicrophoneEnabled && (
          <span className="absolute inset-0 rounded-full bg-rose-400 opacity-30 animate-ping" />
        )}
        <button
          onPointerDown={startSpeaking}
          onPointerUp={stopSpeaking}
          onPointerLeave={stopSpeaking}
          style={{ touchAction: "none", userSelect: "none" }}
          className={`relative w-16 h-16 rounded-full flex items-center justify-center text-2xl shadow-lg transition-all duration-200 active:scale-95 ${
            isMicrophoneEnabled
              ? "bg-rose-500 hover:bg-rose-600 mic-active scale-105"
              : "bg-slate-200 hover:bg-slate-300"
          }`}
          aria-label={isMicrophoneEnabled ? "Release to stop speaking" : "Hold to speak"}
        >
          {isMicrophoneEnabled ? "🎙️" : "🔇"}
        </button>
      </div>
      <span className="text-xs font-medium text-slate-500">
        {isMicrophoneEnabled ? "Release to stop" : "Hold to speak"}
      </span>
    </div>
  );
}
