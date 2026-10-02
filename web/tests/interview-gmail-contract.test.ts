import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  interviewGmailPlan,
  type InterviewGmailSource,
} from "../../worker-support/interview-gmail-contract";
function source(): InterviewGmailSource {
  const w = randomUUID(),
    o = randomUUID();
  return {
    workspace_id: w,
    classification: {
      id: randomUUID(),
      workspace_id: w,
      opportunity_id: o,
      source_system: "gmail",
      source_reference: "gmail_message:synthetic_message",
      idempotency_key: "gmail:synthetic_message:classification:v1",
    },
    match: {
      workspace_id: w,
      opportunity_id: o,
      confidence: "exact",
      active: true,
    },
    kind: "scheduled",
    interview_type: "Hiring manager",
    scheduled_start_at: "2026-11-01T12:00:00Z",
  };
}
it("normalizes existing classified exact source with stable separate reconciliation identity and mandatory human review", () => {
  const s = source(),
    p = interviewGmailPlan(s);
  expect(p).toEqual(interviewGmailPlan(structuredClone(s)));
  expect(p.authority).toBe("human_review_required");
  expect(p.disposition).toBe("review_scheduled_interview");
  expect(p.reconciliation_key).not.toBe(s.classification.idempotency_key);
  expect(s.classification.idempotency_key).toBe(
    "gmail:synthetic_message:classification:v1",
  );
});
it("does not invent interviews from ambiguous, inactive or differently linked sources", () => {
  for (const change of [
    { confidence: "ambiguous" as const },
    { active: false },
    { opportunity_id: randomUUID() },
  ]) {
    const s = source();
    s.match = { ...s.match, ...change };
    expect(interviewGmailPlan(s).disposition).toBe("review_match");
  }
});
it("rejects foreign events, identities and classification version mismatches", () => {
  for (const change of [
    { workspace_id: randomUUID() },
    { source_system: "untrusted" },
    { source_reference: "gmail_message:../foreign" },
    { idempotency_key: "gmail:other:classification:v1" },
  ]) {
    const s = source();
    s.classification = { ...s.classification, ...change };
    expect(() => interviewGmailPlan(s)).toThrow();
  }
});
it.each(["scheduling_request", "rescheduled", "cancelled"] as const)(
  "routes %s to review without a new scheduled-write command",
  (kind) => {
    const p = interviewGmailPlan({ ...source(), kind });
    expect(p).not.toHaveProperty("proposed_command");
    expect(p.authority).toBe("human_review_required");
  },
);
it("rejects missing timezone, invalid times, reversed duration and unsafe meeting URLs", () => {
  for (const change of [
    { scheduled_start_at: "2026-11-01T12:00:00" },
    { scheduled_start_at: "bad" },
    { scheduled_end_at: "2026-11-01T11:00:00Z" },
    { meeting_url: "javascript:alert(1)" },
    { meeting_url: "https://user:secret@example.invalid/meeting" },
  ])
    expect(() => interviewGmailPlan({ ...source(), ...change })).toThrow();
});
