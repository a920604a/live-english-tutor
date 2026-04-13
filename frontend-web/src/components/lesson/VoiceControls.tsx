import { useLocalParticipant } from "@livekit/components-react";

export default function VoiceControls() {
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();

  const toggleMic = () => {
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        {/* Pulse ring when mic is active */}
        {isMicrophoneEnabled && (
          <span className="absolute inset-0 rounded-full bg-rose-400 opacity-30 animate-ping" />
        )}
        <button
          onClick={toggleMic}
          className={`relative w-16 h-16 rounded-full flex items-center justify-center text-2xl shadow-lg transition-all duration-200 active:scale-95 ${
            isMicrophoneEnabled
              ? "bg-rose-500 hover:bg-rose-600 mic-active"
              : "bg-slate-200 hover:bg-slate-300"
          }`}
          aria-label={isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}
        >
          {isMicrophoneEnabled ? "🎙️" : "🔇"}
        </button>
      </div>
      <span className="text-xs font-medium text-slate-500">
        {isMicrophoneEnabled ? "Tap to mute" : "Tap to speak"}
      </span>
    </div>
  );
}
