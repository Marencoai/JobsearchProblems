// Pure shared validation. Evidence remains untrusted; only the existing intake
// worker verifies sources, extracts facts, deduplicates, researches and queues.
export const INTAKE_LIMIT = 8 * 1024 * 1024;
export const MIME_EXT = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "image/png": "png",
  "image/jpeg": "jpg",
  "text/plain": "txt",
} as const;
export type IntakeInput =
  | { mode: "url"; url: string }
  | { mode: "text"; text: string }
  | {
      mode: "upload";
      upload: {
        storage_path: string;
        sha256: string;
        byte_size: number;
        mime_type: keyof typeof MIME_EXT;
        name: string;
      };
    };
export const uuid = (value: string) =>
  /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
export function publicJobUrl(value: string): string {
  const u = new URL(value.trim());
  const h = u.hostname.toLowerCase();
  if (
    value.length > 2048 ||
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    (u.port && u.port !== "443") ||
    h === "localhost" ||
    !h.includes(".") ||
    h.endsWith(".local") ||
    h.endsWith(".localhost") ||
    h.includes(":") ||
    /^[0-9.]+$/.test(h)
  )
    throw new Error("Use a public HTTPS job URL.");
  u.hash = "";
  return u.href;
}
export function validateIntake(input: IntakeInput): IntakeInput {
  if (input.mode === "url")
    return { mode: "url", url: publicJobUrl(input.url) };
  if (input.mode === "text") {
    const text = input.text.trim();
    if (text.length < 40 || text.length > 100000 || text.includes("\0"))
      throw new Error(
        "Paste the full job description (40–100,000 characters).",
      );
    return { mode: "text", text };
  }
  if (input.mode !== "upload")
    throw new Error("Choose URL, job description, or upload.");
  const u = input.upload;
  if (
    !u ||
    !(u.mime_type in MIME_EXT) ||
    !Number.isInteger(u.byte_size) ||
    u.byte_size < 1 ||
    u.byte_size > INTAKE_LIMIT ||
    !/^[a-f0-9]{64}$/.test(u.sha256) ||
    !u.name ||
    u.name.length > 200 ||
    /[\x00-\x1f/\\]/.test(u.name)
  )
    throw new Error("Choose a supported document or image up to 8 MB.");
  const parts = u.storage_path.split("/");
  if (
    parts.length !== 4 ||
    !parts.slice(0, 3).every(uuid) ||
    parts[3] !== u.sha256 + "." + MIME_EXT[u.mime_type]
  )
    throw new Error("The uploaded evidence reference is invalid.");
  return { mode: "upload", upload: { ...u } };
}
export function intakeTaskEvidence(
  task: {
    workspace_id: string;
    task_type: string;
    domain: string;
    trigger_type: string;
    source_activity_event_id: string;
    trigger_reference: string;
  },
  event: {
    id: string;
    workspace_id: string;
    event_type: string;
    actor_principal_id: string;
    source_reference: string;
    details: string;
  },
) {
  if (
    task.task_type !== "job_alert_intake" ||
    task.domain !== "discovery" ||
    task.trigger_type !== "event" ||
    task.workspace_id !== event.workspace_id ||
    task.source_activity_event_id !== event.id ||
    task.trigger_reference !== event.id ||
    event.event_type !== "manual_job_intake_requested"
  )
    throw new Error("Manual intake task/evidence mismatch");
  const envelope = JSON.parse(event.details);
  if (
    envelope.contract_version !== 1 ||
    envelope.source_kind !== "user_provided" ||
    envelope.employer_verified !== false
  )
    throw new Error("Unsupported manual intake evidence contract");
  const input = validateIntake(envelope.input);
  if (
    input.mode === "upload" &&
    input.upload.storage_path.split("/").slice(0, 3).join("/") !==
      [
        event.workspace_id,
        event.actor_principal_id,
        event.source_reference,
      ].join("/")
  )
    throw new Error("Foreign upload evidence");
  return {
    input,
    source_kind: "user_provided",
    employer_verified: false,
    retain_without_public_posting: true,
  };
}
export function validFileSignature(
  bytes: Uint8Array,
  mime: keyof typeof MIME_EXT,
): boolean {
  if (!bytes.length || bytes.length > INTAKE_LIMIT) return false;
  const start = (...v: number[]) => v.every((b, i) => bytes[i] === b);
  if (mime === "application/pdf") return start(37, 80, 68, 70, 45);
  if (mime === "image/png") return start(137, 80, 78, 71, 13, 10, 26, 10);
  if (mime === "image/jpeg") return start(255, 216, 255);
  // ZIP magic identifies a container only. Sandboxed worker extraction must
  // validate DOCX members/limits and reject macros, traversal and zip bombs.
  if (
    mime ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return start(80, 75, 3, 4);
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return !text.includes("\0");
  } catch {
    return false;
  }
}
