// PROPOSAL ONLY. Pure source normalization; no Gmail/DB calls, grants or task edits.
// Classification stays intact. Current writes always require human review.
export type InterviewGmailSource = {
  workspace_id: string;
  classification: {
    id: string;
    workspace_id: string;
    opportunity_id: string | null;
    source_system: string;
    source_reference: string;
    idempotency_key: string;
  };
  match: {
    workspace_id: string;
    opportunity_id: string;
    confidence: "exact" | "ambiguous";
    active: boolean;
  };
  kind: "scheduled" | "scheduling_request" | "rescheduled" | "cancelled";
  interview_type?: string;
  scheduled_start_at?: string;
  scheduled_end_at?: string;
  meeting_url?: string;
};
const uuid = (v: unknown) =>
  typeof v === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const time = (v: string) =>
  /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) &&
  Number.isFinite(Date.parse(v));
export function interviewGmailPlan(source: InterviewGmailSource) {
  const { workspace_id: w, classification: e, match: m } = source;
  if (
    !uuid(w) ||
    !uuid(e.id) ||
    e.workspace_id !== w ||
    m.workspace_id !== w ||
    !uuid(m.opportunity_id)
  )
    throw new Error("Exact Workspace-scoped event and role required");
  const reference = e.source_reference?.match(
    /^gmail_message:([A-Za-z0-9_-]{1,200})$/,
  );
  if (
    e.source_system !== "gmail" ||
    !reference ||
    e.idempotency_key !== `gmail:${reference[1]}:classification:v1`
  )
    throw new Error("Existing Gmail classification identity required");
  const identity = {
    workspace_id: w,
    source_event_id: e.id,
    source_system: "gmail",
    source_reference: e.source_reference,
    reconciliation_key: `gmail:${reference[1]}:interview-reconciliation:v1`,
    authority: "human_review_required" as const,
  };
  if (
    m.confidence !== "exact" ||
    !m.active ||
    e.opportunity_id !== m.opportunity_id
  )
    return { ...identity, disposition: "review_match" as const };
  if (
    !["scheduled", "scheduling_request", "rescheduled", "cancelled"].includes(
      source.kind,
    )
  )
    throw new Error("Supported source kind required");
  if (source.kind !== "scheduled")
    return {
      ...identity,
      opportunity_id: m.opportunity_id,
      disposition:
        source.kind === "scheduling_request"
          ? ("review_scheduling" as const)
          : ("review_source_change" as const),
    };
  if (
    !source.interview_type?.trim() ||
    source.interview_type.length > 300 ||
    !source.scheduled_start_at ||
    !time(source.scheduled_start_at) ||
    (source.scheduled_end_at &&
      (!time(source.scheduled_end_at) ||
        Date.parse(source.scheduled_end_at) <=
          Date.parse(source.scheduled_start_at)))
  )
    throw new Error("Verified round and explicit zoned schedule required");
  if (source.meeting_url) {
    const u = new URL(source.meeting_url);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      source.meeting_url.length > 2048
    )
      throw new Error("Safe HTTPS meeting link required");
  }
  return {
    ...identity,
    opportunity_id: m.opportunity_id,
    disposition: "review_scheduled_interview" as const,
    proposed_command: "record_verified_interview" as const,
    proposed_payload: {
      verified: true,
      source_system: "gmail",
      source_reference: e.source_reference,
      interview_type: source.interview_type.trim(),
      scheduled_start_at: source.scheduled_start_at,
      scheduled_end_at: source.scheduled_end_at,
      meeting_url: source.meeting_url,
    },
  };
}
