import { describe, it, expect, vi } from "vitest";
import { randomUUID, createHash, webcrypto } from "node:crypto";
import { createHqClient, readOnlyFetch } from "@/lib/supabase/client";
import { requestIntake, prepareUpload } from "@/lib/intake";
import { loadMaterialArtifact, artifactPair } from "@/lib/material-delivery";
import {
  publicJobUrl,
  validateIntake,
  validFileSignature,
  intakeTaskEvidence,
} from "../../worker-support/intake-contract";
import { materialManifest } from "../../worker-support/material-artifacts.mts";
import type { Material } from "@/lib/types";
const origin = "https://xhhfnxswwspejdxjyvzz.supabase.co",
  w = randomUUID(),
  p = randomUUID(),
  id = randomUUID();
const pdf = Buffer.from("%PDF-1.7\nSynthetic test bytes"),
  docx = Buffer.from("PK\u0003\u0004Synthetic DOCX test bytes"),
  input = Buffer.from('{"synthetic":true}');
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const m = {
  id,
  workspace_id: w,
  material_type: "resume",
  status: "draft",
  is_current_package_version: true,
  version_number: 2,
} as Material;
const qa = {
  renderer_key: "executive-brief-two-page-v2",
  input_sha256: sha(input),
  docx_sha256: sha(docx),
  pdf_sha256: sha(pdf),
  visual_pass: true,
  parse_back_pass: true,
  page_count: 2,
};
async function pair() {
  return (
    await materialManifest(
      { material: m, renderer_key: qa.renderer_key },
      input,
      docx,
      pdf,
      qa,
    )
  ).map((a) => ({
    ...a,
    id: randomUUID(),
    created_at: "2026-10-01T12:00:00Z",
    created_by_principal_id: p,
  }));
}
describe("public evidence validation", () => {
  it.each([
    "http://example.invalid",
    "https://user:pass@example.invalid/a",
    "https://127.0.0.1/a",
    "https://[::1]/a",
    "https://intranet/a",
    "https://local.local/a",
    "file:///tmp/a",
  ])("rejects private or unsafe source %s", (url) =>
    expect(() => publicJobUrl(url)).toThrow(),
  );
  it("keeps listing identity while stripping fragment", () =>
    expect(publicJobUrl("https://example.invalid/job?id=123#section")).toBe(
      "https://example.invalid/job?id=123",
    ));
  it("bounds description and files and checks magic rather than extension", () => {
    expect(() => validateIntake({ mode: "text", text: "short" })).toThrow();
    expect(validFileSignature(new Uint8Array(pdf), "application/pdf")).toBe(
      true,
    );
    expect(validFileSignature(new Uint8Array(docx), "application/pdf")).toBe(
      false,
    );
    expect(validFileSignature(new Uint8Array([0, 1, 2]), "text/plain")).toBe(
      false,
    );
  });
  it("verifies manual task/evidence scope and never asserts employer verification", () => {
    const event = {
      id: randomUUID(),
      workspace_id: w,
      event_type: "manual_job_intake_requested",
      actor_principal_id: p,
      source_reference: randomUUID(),
      details: JSON.stringify({
        contract_version: 1,
        source_kind: "user_provided",
        employer_verified: false,
        input: { mode: "url", url: "https://example.invalid/a" },
      }),
    };
    const task = {
      workspace_id: w,
      source_activity_event_id: event.id,
      trigger_reference: event.id,
      task_type: "job_alert_intake",
      domain: "discovery",
      trigger_type: "event",
    };
    expect(intakeTaskEvidence(task, event)).toMatchObject({
      employer_verified: false,
      retain_without_public_posting: true,
    });
    expect(() =>
      intakeTaskEvidence({ ...task, workspace_id: randomUUID() }, event),
    ).toThrow("mismatch");
    expect(() =>
      intakeTaskEvidence({ ...task, trigger_type: "candidate_action" }, event),
    ).toThrow("mismatch");
    expect(() =>
      intakeTaskEvidence(task, {
        ...event,
        details: event.details.replace("false", "true"),
      }),
    ).toThrow("Unsupported");
  });
  it("prepares upload path with digest and exact principal/request", async () => {
    vi.stubGlobal("crypto", webcrypto);
    const r = randomUUID();
    const file = new File([pdf], "Recruiter.pdf", { type: "application/pdf" });
    expect((await prepareUpload(file, w, p, r)).input).toMatchObject({
      mode: "upload",
      upload: {
        storage_path: `${w}/${p}/${r}/${sha(pdf)}.pdf`,
        sha256: sha(pdf),
      },
    });
    vi.unstubAllGlobals();
  });
});
describe("separate disabled-by-default transport capabilities", () => {
  it("permits only narrow intake paths, rejects upsert and unrelated writes", async () => {
    const native = vi.fn().mockResolvedValue(new Response("{}"));
    const path = `${w}/${p}/${randomUUID()}/${sha(pdf)}.pdf`,
      f = readOnlyFetch(origin, native, false, { manualIntake: true });
    await f(origin + "/rest/v1/rpc/hq_request_job_intake", { method: "POST" });
    await f(origin + "/storage/v1/object/hq-intake/" + path, {
      method: "POST",
      headers: { "x-upsert": "false" },
    });
    await f(origin + "/storage/v1/object/hq-intake/" + path);
    for (const [method, target, headers] of [
      ["POST", "/rest/v1/opportunities", {}],
      ["POST", "/rest/v1/rpc/hq_human_action", {}],
      ["PUT", "/storage/v1/object/hq-intake/" + path, {}],
      ["POST", "/storage/v1/object/hq-intake/" + path, { "x-upsert": "true" }],
      ["POST", "/storage/v1/object/list/hq-intake", {}],
      ["GET", "/storage/v1/object/public/hq-intake/" + path, {}],
    ] as const)
      await expect(f(origin + target, { method, headers })).rejects.toThrow();
    expect(native).toHaveBeenCalledTimes(3);
  });
  it("intake SDK sends the retry key and only supplied evidence", async () => {
    const native = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          command: "request_job_intake",
          task_id: randomUUID(),
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    const c = createHqClient(
      { url: origin, key: "sb_publishable_fixture", manualIntake: true },
      native,
    );
    const r = randomUUID();
    await requestIntake(
      c,
      w,
      { mode: "url", url: "https://example.invalid/a" },
      r,
    );
    expect(JSON.parse(native.mock.calls[0][1].body)).toEqual({
      target_workspace_id: w,
      request_id: r,
      input: { mode: "url", url: "https://example.invalid/a" },
    });
    c.auth.stopAutoRefresh();
  });
  it("default client blocks both new capabilities before network", async () => {
    const native = vi.fn(),
      c = createHqClient(
        { url: origin, key: "sb_publishable_fixture" },
        native,
      );
    await expect(
      requestIntake(
        c,
        w,
        { mode: "url", url: "https://example.invalid/a" },
        randomUUID(),
      ),
    ).rejects.toThrow();
    expect(
      (
        await c.storage
          .from("hq-materials")
          .download(`${w}/${id}/${sha(pdf)}.pdf`)
      ).error,
    ).toBeTruthy();
    expect(native).not.toHaveBeenCalled();
    c.auth.stopAutoRefresh();
  });
});
describe("exact material byte delivery", () => {
  it("binds one PDF/DOCX pair and refuses altered conversion provenance", async () => {
    expect(artifactPair(m, await pair())).not.toBeNull();
    expect(artifactPair(m, [])).toBeNull();
    const rows = await pair();
    expect(
      artifactPair(
        m,
        rows.map((a) => ({ ...a, application_material_id: randomUUID() })),
      ),
    ).toBeNull();
    expect(
      artifactPair(
        m,
        rows.map((a) =>
          a.format === "pdf" ? { ...a, source_docx_sha256: "f".repeat(64) } : a,
        ),
      ),
    ).toBeNull();
    await expect(
      materialManifest(
        { material: m, renderer_key: qa.renderer_key },
        input,
        docx,
        Buffer.from("%PDF-different"),
        qa,
      ),
    ).rejects.toThrow("exact input");
  });
  it("real SDK uses authenticated object request and verifies SHA/size", async () => {
    const native = vi
        .fn()
        .mockImplementation(() => Promise.resolve(new Response(pdf))),
      c = createHqClient(
        { url: origin, key: "sb_publishable_fixture", materialDelivery: true },
        native,
      );
    const a = (await pair()).find((a) => a.format === "pdf")!;
    const blob = await loadMaterialArtifact(c, m, a);
    expect(await blob.arrayBuffer()).toEqual(
      pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength),
    );
    expect(String(native.mock.calls[0][0])).toBe(
      origin + "/storage/v1/object/hq-materials/" + a.storage_path,
    );
    c.auth.stopAutoRefresh();
  });
  it("refuses corrupted bytes or foreign Material before delivering", async () => {
    const native = vi.fn().mockResolvedValue(new Response("%PDF-wrong")),
      c = createHqClient(
        { url: origin, key: "sb_publishable_fixture", materialDelivery: true },
        native,
      ),
      a = (await pair()).find((a) => a.format === "pdf")!;
    await expect(
      loadMaterialArtifact(c, m, {
        ...a,
        application_material_id: randomUUID(),
      }),
    ).rejects.toThrow("selected material");
    expect(native).not.toHaveBeenCalled();
    await expect(loadMaterialArtifact(c, m, a)).rejects.toThrow(
      "verification failed",
    );
    c.auth.stopAutoRefresh();
  });
});
import { intakeDedupe } from "../../worker-support/intake-dedupe";
describe("shared existing intake deduplication boundary", () => {
  const company = randomUUID(),
    one = {
      id: randomUUID(),
      workspace_id: w,
      company_id: company,
      normalized_title: "operations lead",
      requisition_id: "REQ-1",
      canonical_url: "https://example.invalid/jobs/1",
      is_currently_active: true,
    };
  const candidate = {
    workspace_id: w,
    company_id: company,
    normalized_title: "operations lead",
  };
  it("requires a valid HTTPS source origin for provider-only identity", () => {
    const source = {
      workspace_id: w,
      opportunity_id: one.id,
      external_job_id: "provider-1",
      source_url: "bad-url",
    };
    expect(
      intakeDedupe(
        {
          ...candidate,
          company_id: null,
          external_job_id: "provider-1",
          source_origin: "invalid",
        },
        [one],
        [source],
      ).disposition,
    ).toBe("new");
    expect(
      intakeDedupe(
        {
          ...candidate,
          company_id: null,
          external_job_id: "provider-1",
          source_origin: "https://example.invalid",
        },
        [one],
        [{ ...source, source_url: "https://example.invalid/jobs/1" }],
      ).disposition,
    ).toBe("existing");
  });
  it("recognizes an already-applied role by scoped ID before a changed URL", () => {
    expect(
      intakeDedupe(
        {
          ...candidate,
          requisition_id: "REQ-1",
          canonical_url: "https://example.invalid/new",
          canonical_is_listing: true,
        },
        [{ ...one, is_currently_active: false }],
        [],
      ),
    ).toMatchObject({
      disposition: "existing",
      opportunity_ids: [one.id],
      reason: "external_job_id",
    });
  });
  it("does not collapse different companies or workspaces sharing a provider ID", () => {
    const other = { ...one, id: randomUUID(), company_id: randomUUID() },
      foreign = { ...one, id: randomUUID(), workspace_id: randomUUID() };
    expect(
      intakeDedupe(
        { ...candidate, requisition_id: "REQ-1" },
        [other, foreign],
        [],
      ).disposition,
    ).toBe("new");
  });
  it("matches a researched listing URL, but never treats a pasted URL as verified canonical identity", () => {
    expect(
      intakeDedupe(
        {
          ...candidate,
          canonical_url: one.canonical_url,
          canonical_is_listing: true,
        },
        [one],
        [],
      ).reason,
    ).toBe("canonical_url");
    expect(
      intakeDedupe(
        { ...candidate, canonical_url: one.canonical_url },
        [one],
        [],
      ).disposition,
    ).toBe("new");
  });
  it("requires explicit same-active-event evidence for company/title fallback and preserves ambiguity", () => {
    const two = {
      ...one,
      id: randomUUID(),
      requisition_id: "REQ-2",
      canonical_url: "https://example.invalid/jobs/2",
    };
    expect(intakeDedupe(candidate, [one, two], []).disposition).toBe("new");
    expect(
      intakeDedupe(
        { ...candidate, same_active_hiring_event_ids: [one.id, two.id] },
        [one, two],
        [],
      ).disposition,
    ).toBe("ambiguous");
    expect(
      intakeDedupe(
        { ...candidate, same_active_hiring_event_ids: [one.id] },
        [one, two],
        [],
      ).opportunity_ids,
    ).toEqual([one.id]);
  });
});
