import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { auth } from "../../firebase";
import { getMaterials, recordListeningSession } from "../../api/materials";

interface PrepareProgress {
  stage: string;
  percent: number;
  chunk?: number;
  total?: number;
}

export default function ListenPlayerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const materialId = Number(id);

  const [title, setTitle] = useState("");
  const [chunkCount, setChunkCount] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [phase, setPhase] = useState<"loading" | "preparing" | "greeting" | "playing" | "done" | "error">("loading");
  const [progress, setProgress] = useState<PrepareProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const audioRef = useRef<HTMLAudioElement>(null);
  const startTimeRef = useRef<number>(Date.now());

  // ── Load material info ──────────────────────────────────────────────────────

  useEffect(() => {
    getMaterials().then((list) => {
      const m = list.find((x) => x.id === materialId);
      if (!m) { navigate("/listen"); return; }
      setTitle(m.title);
      if (m.tts_status === "ready" && m.tts_chunk_count) {
        setChunkCount(m.tts_chunk_count);
        setPhase("greeting");
      } else {
        setPhase("preparing");
      }
    });
  }, [materialId, navigate]);

  // ── SSE prepare ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "preparing") return;

    let cancelled = false;

    const run = async () => {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/materials/${materialId}/prepare`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.body) { setErrorMsg("No response body"); setPhase("error"); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!cancelled) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const line = block.trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.event === "progress") {
              setProgress({ stage: data.stage, percent: data.percent, chunk: data.chunk, total: data.total });
            } else if (data.event === "done") {
              setChunkCount(data.chunk_count);
              if (!cancelled) setPhase("greeting");
            } else if (data.event === "error") {
              if (!cancelled) { setErrorMsg(data.message); setPhase("error"); }
            }
          } catch { /* ignore malformed */ }
        }
      }
    };

    run().catch((e) => { setErrorMsg(String(e)); setPhase("error"); });
    return () => { cancelled = true; };
  }, [phase, materialId]);

  // ── Greeting via Web Speech API ──────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "greeting" || !title || chunkCount === 0) return;

    const utterance = new SpeechSynthesisUtterance(
      `Hello! We're going to listen to this article: ${title}. Let's begin.`
    );
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    utterance.onend = () => {
      startTimeRef.current = Date.now();
      setPhase("playing");
    };
    utterance.onerror = () => {
      startTimeRef.current = Date.now();
      setPhase("playing"); // proceed even if TTS fails
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);

    return () => { window.speechSynthesis.cancel(); };
  }, [phase, title, chunkCount]);

  // ── Audio chunk playback ─────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "playing") return;
    const audio = audioRef.current;
    if (!audio) return;

    const playChunk = async (index: number) => {
      const token = await auth.currentUser?.getIdToken();
      // Use blob URL to include auth header
      const res = await fetch(`/materials/${materialId}/audio/${index}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audio.src = url;
      audio.play().catch(console.error);
    };

    playChunk(currentChunk);
  }, [phase, currentChunk, materialId]);

  const handleAudioEnded = () => {
    const next = currentChunk + 1;
    if (next < chunkCount) {
      setCurrentChunk(next);
    } else {
      // All chunks done
      const durationSec = Math.floor((Date.now() - startTimeRef.current) / 1000);
      recordListeningSession(materialId, durationSec, true).catch(console.error);
      setPhase("done");
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 flex flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <button
          onClick={() => { window.speechSynthesis.cancel(); navigate("/listen"); }}
          className="text-xs font-semibold px-4 py-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
        >
          ← Back
        </button>
        <span className="text-white/60 text-xs truncate max-w-xs">{title}</span>
        <div className="w-20" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
        {phase === "loading" && (
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-white/20 border-t-emerald-400 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/60 text-sm">Loading…</p>
          </div>
        )}

        {phase === "preparing" && (
          <div className="w-full max-w-sm text-center">
            <span className="text-5xl block mb-6">🎵</span>
            <p className="text-white font-semibold mb-2">Preparing audio…</p>
            <p className="text-white/50 text-xs mb-6">
              {progress?.stage === "synthesizing"
                ? `Synthesizing chunk ${progress.chunk} of ${progress.total}`
                : progress?.stage ?? "Starting…"}
            </p>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="bg-emerald-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress?.percent ?? 0}%` }}
              />
            </div>
            <p className="text-white/30 text-xs mt-2">{progress?.percent ?? 0}%</p>
          </div>
        )}

        {(phase === "greeting" || phase === "playing") && (
          <div className="w-full max-w-sm text-center">
            <div className={`w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl mx-auto mb-6 ${phase === "playing" ? "animate-pulse" : ""}`}>
              <span className="text-4xl">📖</span>
            </div>
            <p className="text-white font-semibold text-lg mb-1">{title}</p>
            {phase === "greeting" && (
              <p className="text-white/50 text-sm">Preparing to play…</p>
            )}
            {phase === "playing" && (
              <>
                <p className="text-white/50 text-sm mb-6">
                  Part {currentChunk + 1} of {chunkCount}
                </p>
                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div
                    className="bg-emerald-400 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${((currentChunk + 1) / chunkCount) * 100}%` }}
                  />
                </div>
              </>
            )}
            <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />
          </div>
        )}

        {phase === "done" && (
          <div className="text-center">
            <span className="text-5xl block mb-4">✅</span>
            <p className="text-white font-semibold text-lg mb-2">Listening complete!</p>
            <p className="text-white/50 text-sm mb-8">Great job finishing this article.</p>
            <button
              onClick={() => navigate("/listen")}
              className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors"
            >
              Back to Materials
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className="text-center">
            <span className="text-5xl block mb-4">⚠️</span>
            <p className="text-white font-semibold mb-2">Something went wrong</p>
            <p className="text-white/50 text-sm mb-8">{errorMsg}</p>
            <button
              onClick={() => navigate("/listen")}
              className="px-6 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
