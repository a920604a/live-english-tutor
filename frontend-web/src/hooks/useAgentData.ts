import { useEffect, useRef, useState } from "react";
import { RoomEvent } from "livekit-client";
import { useRoomContext, useVoiceAssistant } from "@livekit/components-react";

export interface Correction {
  original: string;
  corrected: string;
  explanation: string;
}

export interface TranscriptEntry {
  id: string;
  role: "user" | "agent";
  text: string;
}

const MAX_TRANSCRIPT_ENTRIES = 50;

export function useAgentData() {
  const room = useRoomContext();
  const { agentTranscriptions } = useVoiceAssistant();
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [lessonState, setLessonState] = useState<string>("warmup");
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const seenAgentSegments = useRef<Set<string>>(new Set());

  // Listen for user transcript data messages from the agent
  useEffect(() => {
    const handleData = (
      payload: Uint8Array,
      _participant: unknown,
      _kind: unknown,
      topic?: string
    ) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (topic === "tutor.correction") {
          setCorrections((prev) => [...prev, data as Correction]);
        } else if (topic === "tutor.state") {
          setLessonState(data.state);
        } else if (topic === "tutor.transcript.user") {
          const entry: TranscriptEntry = {
            id: crypto.randomUUID(),
            role: "user",
            text: data.text,
          };
          setTranscripts((prev) => {
            const next = [...prev, entry];
            return next.length > MAX_TRANSCRIPT_ENTRIES
              ? next.slice(next.length - MAX_TRANSCRIPT_ENTRIES)
              : next;
          });
        }
      } catch {
        // Ignore malformed packets
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room]);

  // Sync agent transcriptions from LiveKit agentTranscriptions
  useEffect(() => {
    if (!agentTranscriptions) return;
    for (const seg of agentTranscriptions) {
      if (!seg.final) continue;
      if (seenAgentSegments.current.has(seg.id)) continue;
      seenAgentSegments.current.add(seg.id);
      const entry: TranscriptEntry = {
        id: seg.id,
        role: "agent",
        text: seg.text,
      };
      setTranscripts((prev) => {
        const next = [...prev, entry];
        return next.length > MAX_TRANSCRIPT_ENTRIES
          ? next.slice(next.length - MAX_TRANSCRIPT_ENTRIES)
          : next;
      });
    }
  }, [agentTranscriptions]);

  return { corrections, lessonState, transcripts };
}
