import { useVoiceAssistant } from "@livekit/components-react";

const STATE_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  disconnected: { label: "Waiting for tutor…", dot: "bg-slate-300", text: "text-slate-400" },
  connecting:   { label: "Connecting…",        dot: "bg-amber-400 animate-pulse", text: "text-amber-600" },
  initializing: { label: "Initializing…",      dot: "bg-amber-400 animate-pulse", text: "text-amber-600" },
  listening:    { label: "Listening…",          dot: "bg-emerald-400 animate-pulse", text: "text-emerald-600" },
  thinking:     { label: "Emma is thinking…",   dot: "bg-blue-400 animate-pulse", text: "text-blue-600" },
  speaking:     { label: "Emma is speaking…",   dot: "bg-indigo-400 animate-pulse", text: "text-indigo-600" },
};

export default function AgentStatus() {
  const { state } = useVoiceAssistant();
  const cfg = STATE_CONFIG[state] ?? { label: state, dot: "bg-slate-300", text: "text-slate-500" };

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <span className={`text-sm font-medium ${cfg.text}`}>{cfg.label}</span>
    </div>
  );
}
