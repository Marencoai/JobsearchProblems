"use client";
import { useEffect, useRef, useState } from "react";
import type { JobView, Stage } from "@/lib/types";
import type {
  HumanActionHandler,
  HumanCommand,
  HumanPayload,
} from "@/lib/human-actions";
import { label } from "@/lib/format";

const titles: Record<HumanCommand, string> = {
  pursue: "Pursue this opportunity",
  pass: "Pass on this opportunity",
  defer: "Save for later",
  approve_package: "Approve application package",
  request_changes: "Request changes",
  save_positioning: "Edit positioning",
  confirm_submission: "I submitted the application",
};
export function HumanActions({
  job,
  stage,
  onAction,
  submissionBlockedReason,
}: {
  job: JobView;
  stage: Stage;
  onAction: HumanActionHandler;
  submissionBlockedReason?: string;
}) {
  const [command, setCommand] = useState<HumanCommand | null>(null);
  const [notes, setNotes] = useState("");
  const [days, setDays] = useState("3");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const focusReturn = useRef<HTMLElement | null>(null);
  const attempt = useRef<{ input: string; requestId: string } | null>(null);
  const deferredTime = useRef("");
  const submitting = useRef(false);
  useEffect(() => {
    if (command) dialog.current?.showModal();
    else focusReturn.current?.focus();
  }, [command]);
  const current = job.materials.filter(
    (m) =>
      m.application_package_id === job.package?.id &&
      m.is_current_package_version,
  );
  const decisions =
    stage === "Evaluate" &&
    job.stage === "Evaluate" &&
    job.action?.action_type === "decide" &&
    !!job.action.updated_at;
  const packageStage = ["Pursue", "Resume", "Application"].includes(stage);
  const submitted = job.applications.some(
    (a) =>
      a.application_package_id === job.package?.id &&
      ["submitted", "confirmed"].includes(a.application_stage),
  );
  function open(value: HumanCommand) {
    focusReturn.current = document.activeElement as HTMLElement;
    setCommand(value);
    setError("");
    setConfirmed(false);
    setMessage("");
    setNotes(
      value === "save_positioning" ? (job.package?.candidate_notes ?? "") : "",
    );
    attempt.current = null;
    deferredTime.current = "";
  }
  function close() {
    if (!submitting.current) setCommand(null);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!command || submitting.current) return;
    if (command === "confirm_submission" && submissionBlockedReason) {
      setError(submissionBlockedReason);
      return;
    }
    let payload: HumanPayload = {};
    if (["pursue", "pass", "defer"].includes(command)) {
      payload = {
        action_id: job.action?.id,
        action_updated_at: job.action?.updated_at,
      };
      if (command === "pass") payload.reason = notes.trim();
      if (command === "defer") {
        // Retain the same exact time across an uncertain network retry.
        deferredTime.current ||= new Date(
          Date.now() + Number(days) * 86400000,
        ).toISOString();
        payload.available_after = deferredTime.current;
      }
    } else {
      payload = {
        package_id: job.package?.id,
        package_updated_at: job.package?.updated_at,
      };
      if (
        ["approve_package", "request_changes"].includes(command) &&
        job.reviewAction
      ) {
        payload.review_action_id = job.reviewAction.id;
        payload.review_action_updated_at = job.reviewAction.updated_at;
      }
      if (["request_changes", "save_positioning"].includes(command))
        payload.notes = notes.trim();
      if (["approve_package", "confirm_submission"].includes(command))
        payload.material_ids = current.map((m) => m.id).sort();
      if (command === "confirm_submission") payload.confirmed = confirmed;
    }
    const input = JSON.stringify([
      job.opportunity.id,
      job.opportunity.updated_at,
      command,
      payload,
    ]);
    if (attempt.current?.input !== input)
      attempt.current = { input, requestId: crypto.randomUUID() };
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await onAction(job, command, payload, attempt.current.requestId);
      setMessage(
        command === "pursue" || command === "request_changes"
          ? "Preparation requested. Your application worker will prepare the materials."
          : "Your action was recorded.",
      );
      setCommand(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The action could not be confirmed. Please retry.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <div className="decision-actions human-actions">
        {decisions && (
          <>
            <button
              className="button success"
              aria-label="Pursue this opportunity"
              onClick={() => open("pursue")}
            >
              Pursue
            </button>
            <button className="button danger" onClick={() => open("pass")}>
              Pass
            </button>
            <button className="button" onClick={() => open("defer")}>
              Save for later
            </button>
          </>
        )}
        {packageStage && job.package && !submitted && (
          <>
            {stage === "Resume" &&
              job.package.status === "ready_for_review" && (
                <button
                  className="button success"
                  onClick={() => open("approve_package")}
                >
                  Approve package
                </button>
              )}
            {["draft", "preparing", "ready_for_review", "approved"].includes(
              job.package.status,
            ) && (
              <button
                className="button"
                onClick={() => open("request_changes")}
              >
                Request changes
              </button>
            )}
            {stage === "Pursue" &&
              ["draft", "preparing", "ready_for_review"].includes(
                job.package.status,
              ) && (
                <button
                  className="button"
                  onClick={() => open("save_positioning")}
                >
                  Edit positioning
                </button>
              )}
            {stage === "Application" && job.package.status === "approved" && (
              <button
                className="button success"
                disabled={!!submissionBlockedReason}
                title={submissionBlockedReason}
                onClick={() => open("confirm_submission")}
              >
                I submitted the application
              </button>
            )}
          </>
        )}
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {command && (
        <dialog
          ref={dialog}
          className="human-action-dialog"
          aria-labelledby="human-action-title"
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
        >
          <form onSubmit={submit}>
            <h2 id="human-action-title">{titles[command]}</h2>
            <p>
              {job.company?.name} · {job.opportunity.title}
            </p>
            {command === "pursue" && (
              <p>
                This authorizes preparation of your application package. You can
                review the materials before applying.
              </p>
            )}
            {command === "pass" && (
              <label>
                Reason for passing
                <textarea
                  autoFocus
                  required
                  maxLength={4000}
                  value={notes}
                  disabled={busy}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            )}
            {command === "defer" && (
              <label>
                Review again in
                <select
                  value={days}
                  disabled={busy}
                  onChange={(e) => {
                    setDays(e.target.value);
                    deferredTime.current = "";
                  }}
                >
                  <option value="1">1 day</option>
                  <option value="3">3 days</option>
                  <option value="7">1 week</option>
                </select>
              </label>
            )}
            {["request_changes", "save_positioning"].includes(command) && (
              <label>
                {command === "request_changes"
                  ? "Changes you need"
                  : "Positioning notes"}
                <textarea
                  autoFocus
                  required
                  maxLength={10000}
                  value={notes}
                  disabled={busy}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            )}
            {command === "request_changes" && (
              <p>
                Your worker will prepare new versions. Your reviewed and
                historical artifacts stay available.
              </p>
            )}
            {["approve_package", "request_changes"].includes(command) &&
              job.reviewAction && (
                <p>
                  This also resolves your review step: {job.reviewAction.title}.
                </p>
              )}
            {["approve_package", "confirm_submission"].includes(command) && (
              <>
                <p>
                  {command === "approve_package"
                    ? "Confirm you reviewed these exact current materials and resolved required answers."
                    : "Confirm you completed the employer application using these exact materials. This records your submission."}
                </p>
                <ul>
                  {current.map((m) => (
                    <li key={m.id}>
                      {label(m.material_type)} · Version {m.version_number}
                    </li>
                  ))}
                </ul>
                <label className="confirmation-check">
                  <input
                    type="checkbox"
                    required
                    checked={confirmed}
                    disabled={busy}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  {command === "approve_package"
                    ? "I reviewed and approve these materials."
                    : "I submitted the application with these exact materials and recorded answers."}
                </label>
              </>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button
                className="button"
                type="button"
                disabled={busy}
                onClick={close}
              >
                Cancel
              </button>
              <button
                className="button primary"
                disabled={
                  busy ||
                  (["approve_package", "confirm_submission"].includes(
                    command,
                  ) &&
                    (!confirmed || !current.length))
                }
              >
                {busy
                  ? "Confirming…"
                  : command === "confirm_submission"
                    ? "Confirm submission"
                    : command === "approve_package"
                      ? "Confirm approval"
                      : "Confirm"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
