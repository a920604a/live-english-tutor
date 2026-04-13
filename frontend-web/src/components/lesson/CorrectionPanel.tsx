import { useAgentData } from "../../hooks/useAgentData";

export default function CorrectionPanel() {
  const { corrections } = useAgentData();

  if (corrections.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
        <span className="text-base">✏️</span>
        <h3 className="text-sm font-semibold text-amber-800">Corrections</h3>
        <span className="ml-auto text-xs font-medium bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
          {corrections.length}
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {corrections.map((c, i) => (
          <div key={i} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              <span className="line-through text-rose-400 font-medium">{c.original}</span>
              <span className="text-slate-300">→</span>
              <span className="text-emerald-600 font-semibold">{c.corrected}</span>
            </div>
            {c.explanation && (
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">{c.explanation}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
