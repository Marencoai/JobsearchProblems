"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  cheatSheet,
  type InterviewBundle,
  type InterviewService,
  type Interview,
  type Preparation,
  type PrepInput,
} from "@/lib/interview";
import type { JobView } from "@/lib/types";
import { safeUrl, date } from "@/lib/format";
export const InterviewContext = createContext<InterviewService | null>(null);
export function InterviewPanel({ job }: { job: JobView }) {
  const service = useContext(InterviewContext);
  const [bundle, setBundle] = useState<InterviewBundle | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [session, setSession] = useState<string | null>(null);
  const request = useRef<{ interviewId: string; id: string } | null>(null),
    pending = useRef(false);
  useEffect(() => {
    let active = true;
    if (!service) return;
    void service
      .load(job)
      .then((data) => {
        if (active) setBundle(data);
      })
      .catch(() => {
        if (active)
          setError("Interview records could not be loaded. Please retry.");
      });
    return () => {
      active = false;
    };
  }, [service, job]);
  async function start(interview: Interview) {
    if (!service || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    if (request.current?.interviewId !== interview.id)
      request.current = { interviewId: interview.id, id: crypto.randomUUID() };
    try {
      await service.start(job, interview, request.current.id);
      setSession(interview.id);
      request.current = null;
      setBundle(await service.load(job));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Preparation could not be confirmed.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  if (!service)
    return (
      <p className="notice">
        Interview preparation will be available after its reviewed rollout.
        Recorded interview activity remains below.
      </p>
    );
  if (!bundle)
    return (
      <p role={error ? "alert" : "status"}>
        {error || "Loading interview records…"}
      </p>
    );
  return (
    <div className="stage-records">
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!bundle.interviews.length && (
        <p className="notice">
          No structured interview recorded for this role.
        </p>
      )}
      {bundle.interviews.map((i) => {
        const prep = bundle.preparations
          .filter((p) => p.interview_id === i.id)
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
        const questions = bundle.questions.filter(
          (q) =>
            q.interview_id === i.id &&
            (!q.interview_preparation_id ||
              q.interview_preparation_id === prep?.id),
        );
        const people = bundle.people.filter((p) => p.interview_id === i.id);
        const url = safeUrl(i.meeting_url);
        return (
          <section className="package-summary" key={i.id}>
            <div className="item-title">
              <h3>{i.stage_name ?? i.interview_type}</h3>
              <span className="tag">{i.interview_status}</span>
            </div>
            <p>
              {i.scheduled_start_at
                ? new Date(i.scheduled_start_at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "Time not recorded"}
              {i.scheduled_end_at
                ? ` – ${new Date(i.scheduled_end_at).toLocaleTimeString(undefined, { timeStyle: "short" })}`
                : ""}{" "}
              · {i.format ?? "Format not recorded"}
            </p>
            <p>
              Interviewers:{" "}
              {people
                .map(
                  (p) =>
                    `${p.name ?? "Name not recorded"}${p.interviewer_role ? ` · ${p.interviewer_role}` : ""}`,
                )
                .join(", ") || "Not recorded"}
            </p>
            {url && (
              <a href={url} target="_blank" rel="noreferrer">
                Open meeting link
              </a>
            )}
            <p>{i.instructions}</p>
            <h4>Purpose and likely focus</h4>
            <p>{prep?.summary ?? "Preparation not yet recorded."}</p>
            <p>{prep?.what_they_are_likely_evaluating}</p>
            <h4>Company and interviewer context</h4>
            <p>{prep?.company_context ?? "Not recorded"}</p>
            <p>{prep?.interviewer_research}</p>
            <p className="record-caption">
              Research as of {date(prep?.research_as_of)}
            </p>
            <h4>Questions and strongest stories</h4>
            {questions.map((q) => (
              <div key={q.id}>
                <p>
                  <strong>{q.question_text}</strong>{" "}
                  <span className="tag">{q.question_source}</span>
                </p>
                <p>{q.what_they_are_evaluating}</p>
                {bundle.evidence
                  .filter((e) => e.interview_question_id === q.id)
                  .map((e) => (
                    <p key={e.id}>
                      {e.relevance_summary ?? "Linked candidate evidence"}{" "}
                      <span className="record-caption">
                        {e.evidence_story_id ?? e.project_id ?? e.skill_id}
                      </span>
                    </p>
                  ))}
              </div>
            ))}
            <h4>Questions to ask</h4>
            <p>{prep?.candidate_questions ?? "Not recorded"}</p>
            <h4>Risks to prepare for</h4>
            <p>{prep?.known_risks ?? "Not recorded"}</p>
            {i.interview_status === "scheduled" && (
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void start(i)}
              >
                {busy ? "Starting…" : "Start prep session"}
              </button>
            )}
            {prep && (
              <button
                className="button secondary"
                onClick={() => {
                  const blob = new Blob(
                    [cheatSheet(i, prep, questions, bundle.evidence, people)],
                    { type: "text/plain;charset=utf-8" },
                  );
                  const href = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = href;
                  a.download = `interview-${i.id}-cheat-sheet.txt`;
                  a.click();
                  URL.revokeObjectURL(href);
                }}
              >
                Download concise cheat sheet
              </button>
            )}
            {prep && ["draft", "ready"].includes(prep.status) && (
              <PrepEditor
                key={prep.id + prep.updated_at}
                prep={prep}
                onSave={async (input, id) => {
                  if (!service) return;
                  await service.save(job, i, prep, input, id);
                  setBundle(await service.load(job));
                }}
              />
            )}
            {session === i.id && (
              <p role="status">
                Prep session started. Work through your questions and evidence
                above.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function PrepEditor({
  prep,
  onSave,
}: {
  prep: Preparation;
  onSave: (input: PrepInput, id: string) => Promise<void>;
}) {
  const [input, setInput] = useState<PrepInput>({
    summary: prep.summary ?? "",
    what_they_are_likely_evaluating: prep.what_they_are_likely_evaluating ?? "",
    company_context: prep.company_context ?? "",
    candidate_questions: prep.candidate_questions ?? "",
    known_risks: prep.known_risks ?? "",
    reviewed: false,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const request = useRef<{ id: string; input: PrepInput } | null>(null),
    pending = useRef(false);
  const labels = {
    summary: "Concise purpose",
    what_they_are_likely_evaluating: "What they are likely testing",
    company_context: "Company context",
    candidate_questions: "Questions to ask",
    known_risks: "Risks and gaps",
  };
  return (
    <details open>
      <summary>Prepare your conversation</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (pending.current) return;
          pending.current = true;
          setBusy(true);
          setError("");
          request.current ??= { id: crypto.randomUUID(), input };
          try {
            await onSave(request.current.input, request.current.id);
            request.current = null;
          } catch {
            setError(
              "Save could not be confirmed. Retry the same reviewed preparation.",
            );
          } finally {
            pending.current = false;
            setBusy(false);
          }
        }}
      >
        {Object.entries(labels).map(([key, title]) => (
          <label key={key}>
            {title}
            <textarea
              required={key === "summary"}
              maxLength={1800}
              disabled={busy || !!error}
              value={input[key as keyof typeof labels]}
              onChange={(e) => setInput({ ...input, [key]: e.target.value })}
            />
          </label>
        ))}
        <label>
          <input
            type="checkbox"
            checked={input.reviewed}
            disabled={busy || !!error}
            onChange={(e) => setInput({ ...input, reviewed: e.target.checked })}
          />
          I reviewed this preparation. Preserve this version and complete its
          prep action.
        </label>
        <button className="button primary" disabled={busy}>
          {busy ? "Saving…" : "Save preparation"}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
    </details>
  );
}
