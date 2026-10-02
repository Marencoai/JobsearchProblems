"use client";
import { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { Opportunity, Task } from "@/lib/types";
import type { ResearchRefreshHandler } from "@/lib/research-refresh";
export function ResearchRefresh({
  opportunity,
  tasks,
  onRequest,
}: {
  opportunity: Opportunity;
  tasks: Task[];
  onRequest?: ResearchRefreshHandler;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState<{ task_id?: string } | null>(null);
  const pending = tasks.find(
    (t) =>
      t.task_type === "refresh_company_intelligence" &&
      t.workspace_id === opportunity.workspace_id &&
      t.opportunity_id === opportunity.id &&
      ["pending", "ready", "running", "waiting", "blocked"].includes(t.status),
  );
  const settled =
    sent?.task_id &&
    tasks.some(
      (t) =>
        t.id === sent.task_id &&
        t.workspace_id === opportunity.workspace_id &&
        t.opportunity_id === opportunity.id &&
        ["completed", "failed", "cancelled"].includes(t.status),
    );
  const unconfirmed = sent && !settled;
  const key = useRef(""),
    target = useRef<Opportunity | null>(null),
    active = useRef(false);
  async function request() {
    if (!onRequest || active.current) return;
    active.current = true;
    setBusy(true);
    setError("");
    try {
      if (!key.current) {
        key.current = crypto.randomUUID();
        target.current = { ...opportunity };
      }
      const result = await onRequest(target.current!, key.current);
      setSent(result ?? {});
      key.current = "";
      target.current = null;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Research could not be requested.",
      );
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="research-request">
      <button
        className="button research-refresh"
        disabled={
          !onRequest ||
          busy ||
          !!pending ||
          !!unconfirmed ||
          !opportunity.is_currently_active ||
          opportunity.opportunity_stage === "closed"
        }
        onClick={() => void request()}
        title={
          onRequest
            ? "Request updated company and listing research"
            : "Research requests are not enabled yet"
        }
      >
        <RefreshCw size={13} />
        {busy ? "Requesting…" : error ? "Retry same request" : "Refresh"}
      </button>
      {(pending || unconfirmed) && (
        <p role="status">
          {pending?.status === "blocked"
            ? "Research refresh needs attention. Recorded facts remain available."
            : "Research refresh in progress. Recorded facts remain available while it is checked."}
        </p>
      )}
      {error && (
        <>
          <p role="alert" className="error">
            {error}
          </p>
          <button
            className="button"
            disabled={busy}
            onClick={() => {
              key.current = "";
              target.current = null;
              setError("");
            }}
          >
            Start a new request
          </button>
        </>
      )}
    </div>
  );
}
