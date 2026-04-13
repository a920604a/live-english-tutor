import { useEffect, useState } from "react";
import { RoomEvent } from "livekit-client";
import { useRoomContext } from "@livekit/components-react";

export interface Correction {
  original: string;
  corrected: string;
  explanation: string;
}

export function useAgentData() {
  const room = useRoomContext();
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [lessonState, setLessonState] = useState<string>("warmup");

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

  return { corrections, lessonState };
}
