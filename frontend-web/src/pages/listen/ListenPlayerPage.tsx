import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { auth } from "../../firebase";
import {
  getMaterials,
  getMaterialPlayback,
  MaterialPlayback,
  recordListeningSession,
} from "../../api/materials";

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
  const [playback, setPlayback] = useState<MaterialPlayback | null>(null);
  const [playbackError, setPlaybackError] = useState("");
  const [phase, setPhase] = useState<"loading" | "preparing" | "greeting" | "playing" | "done" | "error">("loading");
  const [progress, setProgress] = useState<PrepareProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const audioRef = useRef<HTMLAudioElement>(null);
  const startTimeRef = useRef<number>(Date.now());
  const chunkRefs = useRef<Record<number, HTMLElement | null>>({});

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

  useEffect(() => {
    let cancelled = false;

    const loadPlayback = async () => {
      const data = await getMaterialPlayback(materialId);
      if (cancelled) return;
      setPlayback(data);
      setPlaybackError("");
      setTitle((current) => current || data.title);
    };

    loadPlayback().catch((error) => {
      if (cancelled) return;
      console.error(error);
      setPlaybackError(error instanceof Error ? error.message : String(error));
    });

    return () => {
      cancelled = true;
    };
  }, [materialId]);

  useEffect(() => {
    if (phase !== "playing" && phase !== "greeting") return;
    chunkRefs.current[currentChunk]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [currentChunk, phase]);

  // ── SSE prepare ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "preparing") return;

    let cancelled = false;

    const run = async () => {
      const token = await auth.currentUser?.getIdToken() ?? "";
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

      <div className="flex-1 px-4 pb-6 md:px-6">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-[28px] border border-white/10 bg-black/20 p-6 backdrop-blur">
            {phase === "loading" && (
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-white/20 border-t-emerald-400 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white/60 text-sm">Loading…</p>
              </div>
            )}

            {phase === "preparing" && (
              <div className="w-full text-center">
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
              <div className="w-full text-center">
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
          </section>

          <section className="rounded-[28px] border border-emerald-300/20 bg-white/95 p-4 shadow-2xl shadow-emerald-950/30">
            <div className="mb-4 flex items-center justify-between gap-4 border-b border-slate-200 px-2 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Reading Material</p>
                <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
              </div>
              {playback && (
                <p className="text-xs text-slate-500">
                  {playback.chunks.length} sections
                </p>
              )}
            </div>

            <div className="max-h-[72vh] space-y-3 overflow-y-auto pr-2">
              {playback?.chunks.map((chunk) => {
                const isRead = chunk.index < currentChunk;
                const isActive = chunk.index === currentChunk && (phase === "playing" || phase === "greeting");
                const tone = isActive
                  ? "border-emerald-400 bg-emerald-50 shadow-md shadow-emerald-100"
                  : isRead
                    ? "border-sky-200 bg-sky-50/70"
                    : "border-slate-200 bg-white";

                return (
                  <article
                    key={chunk.index}
                    ref={(node) => { chunkRefs.current[chunk.index] = node; }}
                    className={`rounded-3xl border px-5 py-4 transition-all duration-300 ${tone}`}
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                        isActive
                          ? "bg-emerald-500 text-white"
                          : isRead
                            ? "bg-sky-500 text-white"
                            : "bg-slate-100 text-slate-500"
                      }`}>
                        {chunk.index + 1}
                      </span>
                      <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                        {isActive ? "Now reading" : isRead ? "Read" : "Upcoming"}
                      </span>
                    </div>
                    <p className={`whitespace-pre-wrap text-[15px] leading-7 ${
                      isActive
                        ? "text-slate-900"
                        : isRead
                          ? "text-slate-700"
                          : "text-slate-500"
                    }`}>
                      {chunk.text}
                    </p>
                  </article>
                );
              })}

              {playbackError && (
                <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-700">
                  Failed to load material text: {playbackError}
                </div>
              )}

              {!playback && !playbackError && (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                  Loading material text…
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
