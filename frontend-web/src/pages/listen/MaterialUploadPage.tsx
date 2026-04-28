import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadMaterial } from "../../api/materials";

export default function MaterialUploadPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (f: File | null) => {
    setFile(f);
    if (f && !title) {
      setTitle(f.name.replace(/\.pdf$/i, ""));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.type === "application/pdf" || f?.name.endsWith(".pdf")) {
      handleFileChange(f);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadMaterial(file, title);
      navigate("/listen");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center">
          <button onClick={() => navigate("/listen")} className="text-sm text-slate-500 hover:text-slate-800 font-medium">
            ← Back
          </button>
          <span className="font-bold text-slate-800 mx-auto">Upload PDF</span>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-10">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
              file ? "border-emerald-400 bg-emerald-50" : "border-slate-300 hover:border-emerald-400"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div>
                <span className="text-3xl block mb-2">📄</span>
                <p className="font-medium text-slate-700">{file.name}</p>
                <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
            ) : (
              <div>
                <span className="text-3xl block mb-2">📁</span>
                <p className="text-slate-500 text-sm">Drop a PDF here or click to select</p>
                <p className="text-slate-400 text-xs mt-1">Max 20 MB</p>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Article title (optional)"
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          {error && (
            <p className="text-rose-600 text-sm bg-rose-50 rounded-xl px-4 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={!file || uploading}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? "Uploading…" : "Upload PDF"}
          </button>
        </form>
      </main>
    </div>
  );
}
