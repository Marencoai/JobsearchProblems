"use client";
import { useState } from "react";
import type { Phase2ReadOnlyReport } from "@/lib/phase2-diagnostics";

export function Phase2Diagnostics({
  run,
}: {
  run: () => Promise<Phase2ReadOnlyReport>;
}) {
  const [report, setReport] = useState<Phase2ReadOnlyReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <details
      style={{ margin: "1rem", padding: "1rem", border: "1px solid #cbd5e1" }}
    >
      <summary>Read-only Phase 2 diagnostic</summary>
      <p>
        This uses your current HQ session. It reads one scoped action row and
        records no decisions. It does not test agent permissions or scheduled
        behavior.
      </p>
      <button
        className="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          setReport(null);
          try {
            setReport(await run());
          } catch {
            setFailed(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Checking…" : "Check signed-in access"}
      </button>
      {failed && (
        <p role="alert">
          The check could not verify the current session and scoped column read.
          No workflow change was made.
        </p>
      )}
      {report && (
        <pre
          style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          aria-label="Read-only diagnostic report"
        >
          {JSON.stringify(report, null, 2)}
        </pre>
      )}
    </details>
  );
}
