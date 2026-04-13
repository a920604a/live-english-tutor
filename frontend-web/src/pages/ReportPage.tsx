import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getReport } from "../api/sessions";

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "pending" | "ready">("loading");

  useEffect(() => {
    if (!id) return;

    const poll = async () => {
      const result = await getReport(Number(id));
      if (result.status === "ready" && result.report) {
        setReport(result.report);
        setStatus("ready");
      } else {
        setStatus("pending");
        // Retry in 3 seconds
        setTimeout(poll, 3000);
      }
    };

    poll().catch(console.error);
  }, [id]);

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: "0 16px" }}>
      <button onClick={() => navigate("/")}>&larr; Back to Dashboard</button>
      <h1>Lesson Report</h1>

      {status === "loading" && <p>Loading...</p>}
      {status === "pending" && <p>Generating your report... This may take a moment.</p>}
      {status === "ready" && report && (
        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{report}</div>
      )}
    </div>
  );
}
