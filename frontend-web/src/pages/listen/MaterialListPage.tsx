import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteMaterial, getMaterials, Material } from "../../api/materials";

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? "s" : ""} ago`;
}

export default function MaterialListPage() {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    getMaterials()
      .then(setMaterials)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this material?")) return;
    setDeleting(id);
    try {
      await deleteMaterial(id);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  const statusBadge = (status: Material["tts_status"]) => {
    const map: Record<string, string> = {
      pending: "bg-amber-100 text-amber-700",
      processing: "bg-blue-100 text-blue-700",
      ready: "bg-emerald-100 text-emerald-700",
      error: "bg-rose-100 text-rose-700",
    };
    return map[status] ?? map.pending;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="text-sm text-slate-500 hover:text-slate-800 font-medium">
            ← Back
          </button>
          <span className="font-bold text-slate-800">📖 My Materials</span>
          <button
            onClick={() => navigate("/listen/upload")}
            className="text-sm font-semibold px-4 py-1.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          >
            + Upload
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : materials.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center">
            <span className="text-4xl block mb-3">📄</span>
            <p className="text-slate-400 text-sm">No materials yet — upload your first PDF!</p>
            <button
              onClick={() => navigate("/listen/upload")}
              className="mt-4 text-sm font-semibold px-5 py-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              Upload PDF
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {materials.map((m) => (
              <div
                key={m.id}
                className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center justify-between gap-4 hover:shadow-sm transition-shadow"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-800 truncate">{m.title}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(m.tts_status)}`}>
                      {m.tts_status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                    {m.word_count && <span>{m.word_count.toLocaleString()} words</span>}
                    {m.page_count && <span>{m.page_count} pages</span>}
                    <span>Listened {m.listen_count}×</span>
                    <span>Last: {timeAgo(m.last_listened_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => navigate(`/listen/${m.id}/player`)}
                    disabled={m.tts_status === "processing"}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    ▶ Play
                  </button>
                  <button
                    onClick={() => handleDelete(m.id)}
                    disabled={deleting === m.id}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors disabled:opacity-50"
                  >
                    {deleting === m.id ? "…" : "🗑"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
