// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { IntakeDialog } from "@/components/intake-dialog";
import { MaterialDelivery } from "@/components/material-delivery";
import type { Material, MaterialArtifact } from "@/lib/types";
import { HqShell } from "@/components/hq-shell";
import { fixtureIdentity, visualFixture } from "@/lib/qa-fixtures";
vi.mock("@/components/pdf-preview", () => ({
  PdfPreview: ({ title }: { title: string }) => (
    <div title={title}>Exact PDF page renderer</div>
  ),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("manual intake UX", () => {
  it("requires a full description, does no work before explicit submit", async () => {
    const request = vi.fn().mockResolvedValue(undefined),
      upload = vi.fn();
    render(
      <IntakeDialog onClose={() => {}} onRequest={request} onUpload={upload} />,
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "text" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: "Full job description" }),
      {
        target: {
          value:
            "Synthetic recruiter-supplied role description with sufficient detail.",
        },
      },
    );
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Add for review" }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Job added for review" }),
      ).toBeTruthy(),
    );
    expect(request.mock.calls[0][0]).toMatchObject({ mode: "text" });
    expect(upload).not.toHaveBeenCalled();
  });
  it("keeps the original payload and key after an uncertain response", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error("Uncertain response"))
      .mockResolvedValue(undefined);
    render(
      <IntakeDialog
        onClose={() => {}}
        onRequest={request}
        onUpload={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Job URL" }), {
      target: { value: "https://example.invalid/role" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add for review" }));
    await screen.findByRole("alert");
    expect(
      (screen.getByRole("textbox", { name: "Job URL" }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry same request" }));
    await screen.findByRole("heading", { name: "Job added for review" });
    expect(request.mock.calls[0]).toEqual(request.mock.calls[1]);
  });
  it("does not duplicate requests or cancel during an in-flight save", async () => {
    let resolve!: () => void;
    const request = vi.fn(() => new Promise<void>((r) => (resolve = r))),
      close = vi.fn();
    render(
      <IntakeDialog onClose={close} onRequest={request} onUpload={vi.fn()} />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Job URL" }), {
      target: { value: "https://example.invalid/role" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add for review" }));
    expect(
      (screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(close).not.toHaveBeenCalled();
    resolve();
    await screen.findByRole("heading", { name: "Job added for review" });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("uploads only after explicit review request, retains one uploaded reference on retry", async () => {
    const path = "test-evidence-reference",
      upload = vi
        .fn()
        .mockResolvedValue({ mode: "upload", upload: { storage_path: path } }),
      request = vi
        .fn()
        .mockRejectedValueOnce(new Error("retry"))
        .mockResolvedValue(undefined);
    render(
      <IntakeDialog onClose={() => {}} onRequest={request} onUpload={upload} />,
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "upload" },
    });
    const input = screen.getByLabelText("Job document or screenshot");
    const file = new File(["%PDF-synthetic"], "Role.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(input, { target: { files: [file] } });
    expect(upload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Add for review" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Retry same request" }));
    await screen.findByRole("heading", { name: "Job added for review" });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]).toEqual(request.mock.calls[1]);
  });
  it("leaves read-only Add Job disabled and hides raw worker details", () => {
    const data = visualFixture();
    data.activities.push({
      id: "manual-event",
      opportunity_id: null,
      event_type: "manual_job_intake_requested",
      event_timestamp: "2026-10-01T12:00:00Z",
      summary: "Review supplied job",
      source_system: "job_hunt_hq",
    });
    data.tasks.push({
      id: "manual-task",
      opportunity_id: null,
      task_type: "job_alert_intake",
      domain: "discovery",
      status: "blocked",
      trigger_type: "event",
      trigger_reference: "manual-event",
      source_activity_event_id: "manual-event",
      result_summary: "INTERNAL_SQL_STACK_NOT_FOR_CANDIDATE",
    });
    render(
      <HqShell
        identity={fixtureIdentity}
        data={data}
        workspaceId="fixture-workspace"
        loading={false}
        error=""
        onReload={() => {}}
        onWorkspace={() => {}}
        onSignOut={() => {}}
      />,
    );
    expect(
      (screen.getByRole("button", { name: "Add Job" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByText("Job review needs attention")).toBeTruthy();
    expect(
      screen.queryByText("INTERNAL_SQL_STACK_NOT_FOR_CANDIDATE"),
    ).toBeNull();
  });
});
const material = {
  id: "m",
  workspace_id: "w",
  material_type: "resume",
  version_number: 3,
} as Material;
const hash = "a".repeat(64),
  ph = "b".repeat(64);
const rows = (["docx", "pdf"] as const).map((format) => ({
  id: format,
  created_at: "2026-10-01T12:00:00Z",
  created_by_principal_id: "synthetic",
  workspace_id: "w",
  application_material_id: "m",
  bucket_id: "hq-materials",
  format,
  storage_path: `w/m/${format === "docx" ? hash : ph}.${format}`,
  sha256: format === "docx" ? hash : ph,
  byte_size: 20,
  renderer_key: "executive-brief-two-page-v2",
  input_sha256: "c".repeat(64),
  source_docx_sha256: hash,
  qa: {
    visual_pass: true,
    parse_back_pass: true,
    page_count: 2,
    renderer_key: "executive-brief-two-page-v2",
    input_sha256: "c".repeat(64),
    docx_sha256: hash,
    pdf_sha256: ph,
  },
})) as MaterialArtifact[];
describe("exact file controls", () => {
  it("downloads the loaded exact pair with versioned filenames and revokes owned URLs on close", async () => {
    const blob = new Blob(["exact immutable bytes"]),
      create = vi.fn().mockReturnValue("blob:exact"),
      revoke = vi.fn();
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL = create;
        static revokeObjectURL = revoke;
      },
    );
    const clicks: { filename: string; attached: boolean; href: string }[] = [];
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicks.push({
          filename: this.download,
          attached: this.isConnected,
          href: this.href,
        });
      });
    const load = vi.fn().mockResolvedValue(blob);
    const { unmount } = render(
      <MaterialDelivery material={material} artifacts={rows} load={load} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    await waitFor(() => expect(clicks).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Download DOCX" }));
    await waitFor(() => expect(clicks).toHaveLength(2));
    expect(load.mock.calls).toEqual([
      [material, rows[1]],
      [material, rows[0]],
    ]);
    expect(create.mock.calls).toEqual([[blob], [blob]]);
    expect(clicks).toEqual([
      { filename: "resume-v3-m.pdf", attached: true, href: "blob:exact" },
      { filename: "resume-v3-m.docx", attached: true, href: "blob:exact" },
    ]);
    expect(document.querySelector("a[download]")).toBeNull();
    unmount();
    expect(revoke).toHaveBeenCalledTimes(2);
    click.mockRestore();
  });
  it("offers no files when exact paired artifacts are missing", () => {
    render(
      <MaterialDelivery material={material} artifacts={[]} load={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: "Download PDF" })).toBeNull();
    expect(screen.getByText(/not been recorded and verified/)).toBeTruthy();
  });
  it("previews verified bytes without creating a public URL", async () => {
    const create = vi.fn().mockReturnValue("blob:exact-version-three"),
      revoke = vi.fn();
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL = create;
        static revokeObjectURL = revoke;
      },
    );
    const load = vi
      .fn()
      .mockResolvedValue(
        new Blob(["verified bytes"], { type: "application/pdf" }),
      );
    const { unmount } = render(
      <MaterialDelivery material={material} artifacts={rows} load={load} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Preview PDF" }));
    await waitFor(() =>
      expect(screen.getByTitle("Exact resume PDF version 3")).toBeTruthy(),
    );
    expect(load).toHaveBeenCalledWith(material, rows[1]);
    expect(create).not.toHaveBeenCalled();
    unmount();
    expect(revoke).not.toHaveBeenCalled();
  });
  it("shows verification errors without making a file available", async () => {
    render(
      <MaterialDelivery
        material={material}
        artifacts={rows}
        load={vi.fn().mockRejectedValue(new Error("File verification failed"))}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    await screen.findByRole("alert");
    expect(screen.queryByTitle("Exact resume PDF version 3")).toBeNull();
  });
});
