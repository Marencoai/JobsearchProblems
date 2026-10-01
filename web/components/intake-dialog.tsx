"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  MIME_EXT,
  type IntakeHandler,
  type IntakeInput,
  type IntakeUploadHandler,
} from "@/lib/intake";
import { validateIntake } from "../../worker-support/intake-contract";
export function IntakeDialog({
  onClose,
  onRequest,
  onUpload,
}: {
  onClose: () => void;
  onRequest: IntakeHandler;
  onUpload: IntakeUploadHandler;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"url" | "text" | "upload">("url"),
    [url, setUrl] = useState(""),
    [text, setText] = useState(""),
    [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [frozen, setFrozen] = useState(false);
  const request = useRef<string>(""),
    evidence = useRef<IntakeInput | null>(null),
    inFlight = useRef(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    if (done)
      dialog.current
        ?.querySelector<HTMLButtonElement>(".modal-footer button")
        ?.focus();
  }, [done]);
  async function submit() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      if (!request.current) request.current = crypto.randomUUID();
      if (!evidence.current) {
        if (mode === "upload") {
          if (!file) throw new Error("Choose a job document or screenshot.");
          setFrozen(true);
          evidence.current = await onUpload(file, request.current);
        } else
          evidence.current = validateIntake(
            mode === "url" ? { mode, url } : { mode, text },
          );
      }
      setFrozen(true);
      await onRequest(evidence.current, request.current);
      setDone(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The request could not be confirmed. Retry safely.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <dialog
        ref={dialog}
        open
        aria-modal="true"
        className="material-dialog intake-dialog"
        aria-labelledby="intake-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) onClose();
          if (e.key === "Tab") {
            const nodes = [
              ...(dialog.current?.querySelectorAll<HTMLElement>(
                "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled)",
              ) ?? []),
            ];
            if (e.shiftKey && document.activeElement === nodes[0]) {
              e.preventDefault();
              nodes.at(-1)?.focus();
            } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
              e.preventDefault();
              nodes[0]?.focus();
            }
          }
        }}
      >
        <div className="modal-header">
          <div>
            <h2 id="intake-title">Add a job</h2>
            <p>
              Send a listing to your existing discovery and evaluation workflow.
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Close add job"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {done ? (
          <div className="intake-body" role="status">
            <h3>Job added for review</h3>
            <p>
              Your supplied evidence is saved. We’ll check the posting, match
              any existing job, and evaluate it. It will appear in Evaluate when
              the role is identified.
            </p>
            <p>
              If there’s no public employer posting, your document will remain
              labeled user-provided.
            </p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="intake-body">
              <label>
                How would you like to add it?
                <select
                  value={mode}
                  disabled={frozen || busy}
                  onChange={(e) => {
                    setMode(e.target.value as typeof mode);
                    setError("");
                  }}
                >
                  <option value="url">Paste URL</option>
                  <option value="text">Paste job description</option>
                  <option value="upload">
                    Upload a document or screenshot
                  </option>
                </select>
              </label>
              {mode === "url" ? (
                <label key="url">
                  Job URL
                  <input
                    type="url"
                    required
                    placeholder="https://company.com/careers/role"
                    value={url}
                    disabled={frozen || busy}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </label>
              ) : mode === "text" ? (
                <label key="text">
                  Full job description
                  <textarea
                    required
                    minLength={40}
                    maxLength={100000}
                    rows={10}
                    value={text}
                    disabled={frozen || busy}
                    onChange={(e) => setText(e.target.value)}
                  />
                </label>
              ) : (
                <label key="upload">
                  Job document or screenshot
                  <input
                    type="file"
                    aria-label="Job document or screenshot"
                    accept={Object.keys(MIME_EXT).join(",")}
                    disabled={frozen || busy}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <small>PDF, DOCX, PNG, JPEG, or text · up to 8 MB</small>
                  {file && <span>{file.name}</span>}
                </label>
              )}
              <p className="notice">
                We’ll verify the source and check for duplicates. Supplied text
                and files are evidence, not instructions for your workers.
              </p>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={onClose}
              >
                Cancel
              </button>
              {frozen && error && (
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => {
                    request.current = "";
                    evidence.current = null;
                    setFrozen(false);
                    setError("");
                  }}
                >
                  Start a new request
                </button>
              )}
              <button className="button primary" disabled={busy}>
                {busy
                  ? "Saving…"
                  : frozen
                    ? "Retry same request"
                    : "Add for review"}
              </button>
            </div>
          </form>
        )}
        {done && (
          <div className="modal-footer">
            <button className="button primary" onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </dialog>
    </div>
  );
}
