import { useAgentData } from "../../hooks/useAgentData";

export default function CorrectionPanel() {
  const { corrections } = useAgentData();

  if (corrections.length === 0) return null;

  return (
    <div style={{ marginTop: 24, border: "1px solid #f0ad4e", borderRadius: 8, padding: 16 }}>
      <h3 style={{ margin: "0 0 12px" }}>Corrections</h3>
      {corrections.map((c, i) => (
        <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #eee" }}>
          <div>
            <span style={{ color: "#d9534f", textDecoration: "line-through" }}>{c.original}</span>
            {" → "}
            <span style={{ color: "#5cb85c", fontWeight: "bold" }}>{c.corrected}</span>
          </div>
          {c.explanation && (
            <div style={{ marginTop: 4, fontSize: 14, color: "#666" }}>{c.explanation}</div>
          )}
        </div>
      ))}
    </div>
  );
}
