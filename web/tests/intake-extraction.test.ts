import { describe, expect, it } from "vitest";
import { intakeExtractionResult } from "../../worker-support/intake-extraction";

const upload = {
  storage_path: "synthetic-reference",
  sha256: "a".repeat(64),
  byte_size: 120,
  mime_type: "application/pdf" as const,
  name: "fictional.pdf",
};
const envelope = {
  contract_version: 1,
  source_kind: "user_provided",
  employer_verified: false,
  sha256: upload.sha256,
  byte_size: upload.byte_size,
  mime_type: upload.mime_type,
};
describe("exact uploaded evidence extraction boundary", () => {
  it("keeps extracted text unverified and binds it to the selected bytes", () => {
    const result = {
      ...envelope,
      status: "extracted",
      text: "Fictional role",
      page_count: 1,
    };
    expect(intakeExtractionResult(result, upload)).toEqual(result);
    for (const change of [
      { sha256: "b".repeat(64) },
      { byte_size: 121 },
      { mime_type: "text/plain" },
      { employer_verified: true },
      { source_kind: "employer" },
      { contract_version: 2 },
      { follow_url: "https://example.invalid" },
    ]) {
      expect(() =>
        intakeExtractionResult({ ...result, ...change }, upload),
      ).toThrow();
    }
  });
  it("retains partial PDF text as needing vision, never extraction success", () => {
    const result = {
      ...envelope,
      status: "needs_vision",
      text: "Page one only",
      page_count: 2,
      reason: "scanned_or_empty_pdf_pages",
    };
    expect(intakeExtractionResult(result, upload).status).toBe("needs_vision");
    expect(() =>
      intakeExtractionResult({ ...result, page_count: 51 }, upload),
    ).toThrow();
    expect(() =>
      intakeExtractionResult({ ...result, reason: "done" }, upload),
    ).toThrow();
  });
  it("requires authorized vision for images and rejects fabricated OCR text", () => {
    const imageUpload = { ...upload, mime_type: "image/png" as const };
    const result = {
      ...envelope,
      mime_type: "image/png",
      status: "needs_vision",
      text: "",
      width: 32,
      height: 32,
      reason: "authorized_vision_required",
    };
    expect(intakeExtractionResult(result, imageUpload).status).toBe(
      "needs_vision",
    );
    for (const change of [
      { text: "invented role" },
      { status: "extracted" },
      { width: 4097 },
      { page_count: 1 },
    ]) {
      expect(() =>
        intakeExtractionResult({ ...result, ...change }, imageUpload),
      ).toThrow();
    }
  });
  it("preserves blocked results without a usable description", () => {
    const result = {
      ...envelope,
      status: "blocked",
      reason: "parser_resource_limits_unavailable",
    };
    expect(intakeExtractionResult(result, upload).status).toBe("blocked");
    expect(() =>
      intakeExtractionResult({ ...result, text: "partial" }, upload),
    ).toThrow();
    expect(() =>
      intakeExtractionResult(
        { ...result, reason: "https://example.invalid" },
        upload,
      ),
    ).toThrow();
  });
  it("rejects oversized, controlled, empty or structurally invalid output", () => {
    const result = {
      ...envelope,
      status: "extracted",
      text: "Fictional role",
      page_count: 1,
    };
    for (const text of ["x".repeat(100001), "\0untrusted", " "])
      expect(() =>
        intakeExtractionResult({ ...result, text }, upload),
      ).toThrow();
    for (const value of [
      null,
      [],
      "text",
      { ...result, page_count: 0 },
      { ...result, width: 10 },
      { ...result, status: "ready" },
    ])
      expect(() => intakeExtractionResult(value, upload)).toThrow();
    expect(() =>
      intakeExtractionResult(
        { ...result, mime_type: "toString", page_count: undefined },
        { ...upload, mime_type: "toString" as never },
      ),
    ).toThrow();
  });
});
