// Deterministic boundary around the existing worker's deduplication order.
// Canonical listing and same-event assertions must come from worker research,
// never from the candidate form. This helper has no network or write authority.
export type IntakeCandidate = {
  workspace_id: string;
  company_id: string | null;
  normalized_title: string | null;
  requisition_id?: string | null;
  external_job_id?: string | null;
  source_origin?: string | null;
  canonical_url?: string | null;
  canonical_is_listing?: boolean;
  same_active_hiring_event_ids?: string[];
};
export type IntakeOpportunity = {
  id: string;
  workspace_id: string;
  company_id: string;
  normalized_title: string | null;
  requisition_id: string | null;
  canonical_url: string | null;
  is_currently_active: boolean;
};
export type IntakeSource = {
  workspace_id: string;
  opportunity_id: string;
  external_job_id: string | null;
  source_url: string | null;
};
function origin(value?: string | null) {
  try {
    const u = new URL(value ?? "");
    return u.protocol === "https:" && !u.username && !u.password
      ? u.origin
      : null;
  } catch {
    return null;
  }
}
function canonical(value?: string | null) {
  try {
    const u = new URL(value ?? "");
    if (u.protocol !== "https:" || u.username || u.password) return null;
    u.hash = "";
    return u.href;
  } catch {
    return null;
  }
}
export function intakeDedupe(
  candidate: IntakeCandidate,
  opportunities: IntakeOpportunity[],
  sources: IntakeSource[],
) {
  const own = opportunities.filter(
    (o) => o.workspace_id === candidate.workspace_id,
  );
  const sourceOrigin = origin(candidate.source_origin);
  const result = (matches: IntakeOpportunity[], reason: string) => ({
    disposition:
      matches.length === 1
        ? "existing"
        : matches.length > 1
          ? "ambiguous"
          : "new",
    opportunity_ids: [...new Set(matches.map((o) => o.id))].sort(),
    reason,
  });
  const ids = own.filter(
    (o) =>
      (candidate.company_id &&
        o.company_id === candidate.company_id &&
        candidate.requisition_id &&
        o.requisition_id === candidate.requisition_id) ||
      (candidate.external_job_id &&
        sources.some(
          (s) =>
            s.workspace_id === candidate.workspace_id &&
            s.opportunity_id === o.id &&
            s.external_job_id === candidate.external_job_id &&
            ((candidate.company_id && o.company_id === candidate.company_id) ||
              (sourceOrigin && origin(s.source_url) === sourceOrigin)),
        )),
  );
  if (ids.length) return result(ids, "external_job_id");
  const url = candidate.canonical_is_listing
    ? canonical(candidate.canonical_url)
    : null;
  const urls = url
    ? own.filter(
        (o) =>
          canonical(o.canonical_url) === url ||
          sources.some(
            (s) =>
              s.workspace_id === candidate.workspace_id &&
              s.opportunity_id === o.id &&
              canonical(s.source_url) === url,
          ),
      )
    : [];
  if (urls.length) return result(urls, "canonical_url");
  const events = own.filter(
    (o) =>
      o.is_currently_active &&
      candidate.company_id &&
      o.company_id === candidate.company_id &&
      candidate.normalized_title &&
      o.normalized_title === candidate.normalized_title &&
      candidate.same_active_hiring_event_ids?.includes(o.id),
  );
  return events.length
    ? result(events, "same_active_event")
    : result([], "no_match");
}
