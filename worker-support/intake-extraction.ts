import { INTAKE_LIMIT, MIME_EXT, type IntakeInput } from "./intake-contract.ts";

type Upload = Extract<IntakeInput, { mode: "upload" }>["upload"];
export type IntakeExtraction = {
  status: "extracted" | "needs_vision" | "blocked";
  text?: string;
  reason?: string;
  page_count?: number;
  width?: number;
  height?: number;
  contract_version: 1;
  sha256: string;
  byte_size: number;
  mime_type: keyof typeof MIME_EXT;
  source_kind: "user_provided";
  employer_verified: false;
};

// Bind a bounded parser's output to the exact authorized uploaded object.
// This is a reference check, not a parser, OCR engine or hosted adoption proof.
export function intakeExtractionResult(
  value: unknown,
  upload: Upload,
): IntakeExtraction {
  const reject = () => {
    throw new Error("Invalid or foreign intake extraction result");
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) reject();
  const r = value as Record<string, unknown>;
  const keys = new Set([
    "status",
    "text",
    "reason",
    "page_count",
    "width",
    "height",
    "contract_version",
    "sha256",
    "byte_size",
    "mime_type",
    "source_kind",
    "employer_verified",
  ]);
  if (
    Object.keys(r).some((key) => !keys.has(key)) ||
    r.contract_version !== 1 ||
    r.source_kind !== "user_provided" ||
    r.employer_verified !== false ||
    r.sha256 !== upload.sha256 ||
    !/^[a-f0-9]{64}$/.test(upload.sha256) ||
    r.byte_size !== upload.byte_size ||
    !Number.isInteger(upload.byte_size) ||
    upload.byte_size < 1 ||
    upload.byte_size > INTAKE_LIMIT ||
    r.mime_type !== upload.mime_type ||
    !Object.hasOwn(MIME_EXT, upload.mime_type) ||
    !["extracted", "needs_vision", "blocked"].includes(String(r.status))
  )
    reject();
  if (r.status === "blocked") {
    if (
      typeof r.reason !== "string" ||
      !/^[a-z0-9_]{1,80}$/.test(r.reason) ||
      r.text !== undefined ||
      r.page_count !== undefined ||
      r.width !== undefined ||
      r.height !== undefined
    )
      reject();
  } else {
    if (
      typeof r.text !== "string" ||
      r.text.length > 100000 ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(r.text)
    )
      reject();
    if (r.mime_type === "application/pdf") {
      if (
        !Number.isInteger(r.page_count) ||
        Number(r.page_count) < 1 ||
        Number(r.page_count) > 50 ||
        r.width !== undefined ||
        r.height !== undefined
      )
        reject();
    } else if (r.mime_type === "image/png" || r.mime_type === "image/jpeg") {
      if (
        r.status !== "needs_vision" ||
        r.text !== "" ||
        !Number.isInteger(r.width) ||
        !Number.isInteger(r.height) ||
        Number(r.width) < 1 ||
        Number(r.width) > 4096 ||
        Number(r.height) < 1 ||
        Number(r.height) > 4096 ||
        Number(r.width) * Number(r.height) > 16 * 1024 * 1024 ||
        r.page_count !== undefined
      )
        reject();
    } else if (
      r.page_count !== undefined ||
      r.width !== undefined ||
      r.height !== undefined
    )
      reject();
    if (r.status === "extracted") {
      if (!(r.text as string).trim() || r.reason !== undefined) reject();
    } else if (
      (r.mime_type === "application/pdf" &&
        r.reason !== "scanned_or_empty_pdf_pages") ||
      (["image/png", "image/jpeg"].includes(String(r.mime_type)) &&
        r.reason !== "authorized_vision_required") ||
      !["application/pdf", "image/png", "image/jpeg"].includes(
        String(r.mime_type),
      )
    )
      reject();
  }
  return { ...r } as IntakeExtraction;
}
