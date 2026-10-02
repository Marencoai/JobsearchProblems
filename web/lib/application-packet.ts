import type { JobView, Material } from "./types";
import { publicJobUrl } from "../../worker-support/intake-contract";
function record(text: string | null) {
  try {
    if (!text || text.length > 250000) return null;
    const r = JSON.parse(text ?? "");
    return r && typeof r === "object" && !Array.isArray(r) ? r : null;
  } catch {
    return null;
  }
}
const string = (v: unknown, max = 10000) =>
  typeof v === "string" && v.length <= max ? v : undefined;
export function applicationPacket(job: JobView) {
  const pkg = job.package;
  const approved =
    pkg?.status === "approved" &&
    pkg.workspace_id === job.opportunity.workspace_id &&
    pkg.opportunity_id === job.opportunity.id;
  const materials = approved
    ? job.materials.filter(
        (m) =>
          m.workspace_id === job.opportunity.workspace_id &&
          m.application_package_id === pkg.id &&
          m.is_current_package_version &&
          ["approved", "submitted"].includes(m.status),
      )
    : [];
  const one = (type: string) => {
    const own = materials.filter((m) => m.material_type === type);
    return own.length === 1 ? own[0] : undefined;
  };
  const requirements = one("application_requirements"),
    answers = one("application_answers"),
    r = record(requirements?.content_text ?? null),
    a = record(answers?.content_text ?? null);
  const source =
    r?.form_inspected === true ? string(r.apply_url, 2048) : undefined;
  let applyUrl: string | undefined;
  try {
    if (source) applyUrl = publicJobUrl(source);
  } catch {}
  // A recorded canonical listing remains a clearly labeled fallback, not an
  // invented inspected ATS. No arbitrary URL is extracted from document prose.
  let listingUrl: string | undefined;
  try {
    if (job.opportunity.canonical_url)
      listingUrl = publicJobUrl(job.opportunity.canonical_url);
  } catch {}
  const parsed = !!(
    r?.contract_version === 1 &&
    r.form_inspected === true &&
    applyUrl &&
    Array.isArray(r.fields) &&
    r.fields.length <= 200 &&
    r.fields.every((f: unknown) => {
      const x = f as Record<string, unknown>;
      return (
        x &&
        typeof x === "object" &&
        string(x.key, 100) &&
        string(x.label, 300) &&
        typeof x.required === "boolean" &&
        typeof x.sensitive === "boolean"
      );
    }) &&
    new Set(r.fields.map((f: { key: string }) => f.key)).size ===
      r.fields.length &&
    Array.isArray(r.attachments) &&
    r.attachments.length <= 30 &&
    r.attachments.every((f: unknown) => {
      const x = f as Record<string, unknown>;
      return (
        x &&
        typeof x === "object" &&
        string(x.material_type, 100) &&
        typeof x.required === "boolean"
      );
    }) &&
    new Set(
      r.attachments.map((f: { material_type: string }) => f.material_type),
    ).size === r.attachments.length
  );
  const matched = !!(
    parsed &&
    a?.contract_version === 1 &&
    a?.requirements_material_id === requirements?.id &&
    Array.isArray(a.answers) &&
    a.answers.length <= 200 &&
    a.answers.every(
      (v: Record<string, unknown>) =>
        v &&
        typeof v === "object" &&
        string(v.field_key, 100) &&
        ["confirmed", "candidate_question", "voluntary"].includes(
          String(v.state),
        ),
    ) &&
    new Set(a.answers.map((v: { field_key: string }) => v.field_key)).size ===
      a.answers.length
  );
  const contractInvalid = (!!r && !parsed) || (!!a && parsed && !matched);
  const fields: {
    key: string;
    label: string;
    required: boolean;
    sensitive: boolean;
    value?: string;
    question?: string;
    pending: boolean;
  }[] = parsed
    ? r.fields.map(
        (f: {
          key: string;
          label: string;
          required: boolean;
          sensitive: boolean;
        }) => {
          const candidates = matched
            ? a.answers.filter(
                (v: { field_key?: string }) => v?.field_key === f.key,
              )
            : [];
          const answer = candidates.length === 1 ? candidates[0] : undefined;
          const sensitive = f.sensitive || answer?.state === "voluntary";
          const value =
            !sensitive && answer?.state === "confirmed"
              ? string(answer.value)
              : undefined;
          return {
            ...f,
            sensitive,
            value,
            question: !sensitive ? string(answer?.question) : undefined,
            pending: !sensitive && f.required && !value,
          };
        },
      )
    : [];
  const attachments: {
    material_type: string;
    required: boolean;
    material?: Material;
  }[] = parsed
    ? r.attachments.map((f: { material_type: string; required: boolean }) => ({
        ...f,
        material: one(f.material_type),
      }))
    : [];
  const unresolved =
    fields.filter((f) => f.pending).length +
    attachments.filter((f) => f.required && !f.material).length +
    (contractInvalid ? 1 : 0);
  return {
    approved,
    materials,
    requirements,
    answers,
    skills: one("skills_list"),
    applyUrl: parsed ? applyUrl : undefined,
    listingUrl,
    atsProvider: parsed ? string(r.ats_provider, 150) : undefined,
    structured: parsed,
    fields,
    attachments,
    unresolved,
    submissionBlocked: contractInvalid || (parsed && unresolved > 0),
  };
}
