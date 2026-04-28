import { useEffect, useRef } from "react";
import type { TranscriptEntry } from "../../hooks/useAgentData";

interface CaptionPanelProps {
  transcripts: TranscriptEntry[];
}

export default function CaptionPanel({ transcripts }: CaptionPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  if (transcripts.length === 0) {
    return (
      <div className="flex items-center justify-center py-4">
        <p className="text-white/30 text-xs">Captions will appear here…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto px-4 py-2">
      {transcripts.map((entry) => (
        <div
          key={entry.id}
          className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-snug ${
              entry.role === "user"
                ? "bg-slate-600/80 text-white rounded-br-sm"
                : "bg-indigo-600/80 text-white rounded-bl-sm"
            }`}
          >
            {entry.text}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
