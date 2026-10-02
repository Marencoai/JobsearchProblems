import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readOnlyFetch, createHqClient } from "@/lib/supabase/client";
import { requestResearchRefresh } from "@/lib/research-refresh";
import type { Opportunity } from "@/lib/types";
const origin = "https://xhhfnxswwspejdxjyvzz.supabase.co";
describe("independent HQ transport capabilities", () => {
  it.each(["off", "human", "intake", "delivery", "research", "all"])(
    "%s allows only its explicit routes and still denies raw writes",
    async (mode) => {
      const native = vi.fn().mockImplementation(async () => new Response("{}"));
      const all = mode === "all",
        f = readOnlyFetch(origin, native, all || mode === "human", {
          manualIntake: all || mode === "intake",
          materialDelivery: all || mode === "delivery",
          researchRefresh: all || mode === "research",
        });
      const w = randomUUID(),
        m = randomUUID();
      const routes = [
        ["human", "POST", "/rest/v1/rpc/hq_human_action"],
        ["intake", "POST", "/rest/v1/rpc/hq_request_job_intake"],
        ["delivery", "GET", "/rest/v1/application_material_artifacts"],
        [
          "delivery",
          "GET",
          `/storage/v1/object/hq-materials/${w}/${m}/${"a".repeat(64)}.pdf`,
        ],
        ["research", "POST", "/rest/v1/rpc/hq_request_research_refresh"],
      ];
      for (const [owner, method, path] of routes) {
        if (all || mode === owner)
          await expect(f(origin + path, { method })).resolves.toBeInstanceOf(
            Response,
          );
        else await expect(f(origin + path, { method })).rejects.toThrow();
      }
      for (const [method, path] of [
        ["POST", "/rest/v1/opportunities"],
        ["PATCH", "/rest/v1/internal_tasks"],
        ["POST", "/rest/v1/company_intelligence"],
        ["POST", "/rest/v1/application_material_artifacts"],
        ["GET", "/rest/v1/rpc/hq_request_research_refresh"],
        ["POST", "/rest/v1/rpc/hq_request_research_refresh?x=1"],
        ["POST", "/rest/v1/rpc/unreviewed_function"],
        ["GET", "/storage/v1/object/sign/hq-materials"],
      ])
        await expect(f(origin + path, { method })).rejects.toThrow();
      expect(native).toHaveBeenCalledTimes(
        all ? routes.length : routes.filter((r) => r[0] === mode).length,
      );
    },
  );
  it("SDK sends exact workspace/opportunity/version/key and rejects a foreign target before network", async () => {
    const w = randomUUID(),
      id = randomUUID(),
      request = randomUUID(),
      task_id = randomUUID();
    const native = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ command: "request_research_refresh", task_id }),
          { headers: { "content-type": "application/json" } },
        ),
      );
    const client = createHqClient(
      { url: origin, key: "sb_publishable_fixture", researchRefresh: true },
      native,
    );
    const opportunity = {
      workspace_id: w,
      id,
      updated_at: "2026-10-02T00:00:00Z",
    } as Opportunity;
    expect(
      await requestResearchRefresh(client, w, opportunity, request),
    ).toEqual({ task_id });
    expect(JSON.parse(native.mock.calls[0][1].body)).toEqual({
      target_workspace_id: w,
      target_opportunity_id: id,
      expected_updated_at: opportunity.updated_at,
      request_id: request,
    });
    await expect(
      requestResearchRefresh(client, randomUUID(), opportunity, request),
    ).rejects.toThrow("different workspace");
    expect(native).toHaveBeenCalledTimes(1);
    client.auth.stopAutoRefresh();
  });
});
