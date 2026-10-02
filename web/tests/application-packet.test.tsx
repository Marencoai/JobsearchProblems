// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { ApplicationPacket } from "@/components/application-packet";
import { applicationPacket } from "@/lib/application-packet";
import { visualFixture, fixtureIdentity } from "@/lib/qa-fixtures";
import { addSyntheticPacket } from "@/lib/qa-packet-fixtures";
import { buildJobViews } from "@/lib/workflow";
import { HqShell } from "@/components/hq-shell";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function fixture() {
  const data = visualFixture(),
    contracts = addSyntheticPacket(data),
    job = () =>
      buildJobViews(data).find((j) => j.opportunity.id === "application")!;
  return { data, job, ...contracts };
}
describe("exact approved employer application packet", () => {
  it("selects inspected employer URL and exact current approved versions, leaving drafts/history out", () => {
    const f = fixture(),
      m = f.data.materials.find((m) => m.id === "qa-resume")!;
    f.data.materials.push(
      {
        ...m,
        id: "draft-unsafe",
        status: "draft",
        content_text: "DRAFT_UNAPPROVED",
      },
      {
        ...m,
        id: "old-unsafe",
        is_current_package_version: false,
        content_text: "OLD_UNAPPROVED",
      },
    );
    const p = applicationPacket(f.job());
    expect(p.applyUrl).toBe("https://example.invalid/ats/operations-role");
    expect(p.unresolved).toBe(0);
    expect(
      p.materials.some((m) => m.id === "draft-unsafe" || m.id === "old-unsafe"),
    ).toBe(false);
  });
  it("never infers sensitive answers and copies only an explicitly selected recorded answer", async () => {
    const f = fixture(),
      copy = vi.fn().mockResolvedValue(undefined);
    f.answers.answers.find((a) => a.field_key === "voluntary")!.value =
      "SENSITIVE_NEVER_SUGGESTED";
    f.data.materials.find((m) => m.id === "qa-answers")!.content_text =
      JSON.stringify(f.answers);
    vi.stubGlobal("navigator", { clipboard: { writeText: copy } });
    render(
      <ApplicationPacket job={f.job()} artifacts={[]} onMaterial={vi.fn()} />,
    );
    expect(screen.queryByText("SENSITIVE_NEVER_SUGGESTED")).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "Copy Voluntary demographic question",
      }),
    ).toBeNull();
    expect(copy).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Copy Salary response" }),
    );
    await screen.findByRole("status");
    expect(copy).toHaveBeenCalledWith(f.answers.answers[0].value);
  });
  it("missing answers, foreign requirements version and duplicate fields block completeness", () => {
    const f = fixture();
    f.answers.answers = f.answers.answers.filter(
      (a) => a.field_key !== "salary",
    );
    f.data.materials.find((m) => m.id === "qa-answers")!.content_text =
      JSON.stringify(f.answers);
    expect(applicationPacket(f.job()).submissionBlocked).toBe(true);
    f.answers.requirements_material_id = "foreign-version";
    f.data.materials.find((m) => m.id === "qa-answers")!.content_text =
      JSON.stringify(f.answers);
    expect(applicationPacket(f.job()).submissionBlocked).toBe(true);
    f.requirements.fields.push({ ...f.requirements.fields[0] });
    f.data.materials.find((m) => m.id === "qa-requirements")!.content_text =
      JSON.stringify(f.requirements);
    expect(applicationPacket(f.job()).applyUrl).toBeUndefined();
    expect(applicationPacket(f.job()).submissionBlocked).toBe(true);
  });
  it("does not create an application on ATS link navigation and blocks explicit confirmation for unresolved required answers", () => {
    const f = fixture(),
      action = vi.fn();
    f.data.applications = [];
    f.answers.answers = f.answers.answers.filter(
      (a) => a.field_key !== "salary",
    );
    f.data.materials.find((m) => m.id === "qa-answers")!.content_text =
      JSON.stringify(f.answers);
    render(
      <HqShell
        identity={fixtureIdentity}
        data={f.data}
        workspaceId="fixture-workspace"
        selectedId="application"
        loading={false}
        error=""
        onReload={() => {}}
        onWorkspace={() => {}}
        onSignOut={() => {}}
        onAction={action}
      />,
    );
    const link = screen.getByRole("link", {
      name: "Open employer application",
    });
    expect(link.getAttribute("href")).toBe(
      "https://example.invalid/ats/operations-role",
    );
    expect(action).not.toHaveBeenCalled();
    expect(
      (
        screen.getByRole("button", {
          name: "I submitted the application",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
  it("preserves inspectable legacy text without pretending it is structured or selecting a prose URL", () => {
    const f = fixture();
    f.data.materials.find((m) => m.id === "qa-requirements")!.content_text =
      "Legacy recorded requirements: https://example.invalid/not-a-verified-ATS";
    expect(applicationPacket(f.job()).applyUrl).toBeUndefined();
    expect(applicationPacket(f.job()).structured).toBe(false);
  });
  it("shows a copy error without changing recorded text", async () => {
    const f = fixture();
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("Permission denied")),
      },
    });
    render(
      <ApplicationPacket job={f.job()} artifacts={[]} onMaterial={vi.fn()} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Copy Work authorization" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Copy is unavailable",
      ),
    );
    expect(
      f.data.materials.find((m) => m.id === "qa-answers")!.content_text,
    ).toBe(JSON.stringify(f.answers));
  });
  it("rejects a foreign package and unsupported structured versions, and exposes employer-specific questions", () => {
    const f = fixture(),
      job = f.job();
    expect(
      applicationPacket({
        ...job,
        package: { ...job.package!, workspace_id: "foreign" },
      }).approved,
    ).toBe(false);
    f.data.materials.find((m) => m.id === "qa-requirements")!.content_text =
      JSON.stringify({ ...f.requirements, contract_version: 2 });
    expect(applicationPacket(f.job()).submissionBlocked).toBe(true);
    f.requirements.fields.push({
      key: "employer_scope",
      label: "Employer-specific operating scope",
      required: true,
      sensitive: false,
    });
    f.data.materials.find((m) => m.id === "qa-requirements")!.content_text =
      JSON.stringify(f.requirements);
    const p = applicationPacket(f.job());
    expect(p.fields.find((f) => f.key === "employer_scope")).toMatchObject({
      pending: true,
      value: undefined,
    });
    expect(p.submissionBlocked).toBe(true);
  });
  it("blocks a missing required cover letter without selecting a draft or another version", () => {
    const f = fixture();
    f.requirements.attachments.find(
      (a) => a.material_type === "cover_letter",
    )!.required = true;
    f.data.materials.find((m) => m.id === "qa-requirements")!.content_text =
      JSON.stringify(f.requirements);
    f.data.materials.find((m) => m.id === "qa-cover-letter")!.status = "draft";
    expect(
      applicationPacket(f.job()).attachments.find(
        (a) => a.material_type === "cover_letter",
      )?.material,
    ).toBeUndefined();
    expect(applicationPacket(f.job()).submissionBlocked).toBe(true);
  });
});
