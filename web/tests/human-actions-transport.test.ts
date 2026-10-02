import { describe, expect, it, vi } from "vitest";
import { createHqClient, readOnlyFetch } from "@/lib/supabase/client";
import { runHumanAction } from "@/lib/human-actions";
import { buildJobViews } from "@/lib/workflow";
import { visualFixture } from "@/lib/qa-fixtures";
const origin = "https://xhhfnxswwspejdxjyvzz.supabase.co";
describe("RPC capability boundary", () => {
  it("allows only the one human RPC when explicitly enabled", async () => {
    const native = vi
      .fn()
      .mockResolvedValue(new Response('{"command":"pursue"}'));
    await readOnlyFetch(
      origin,
      native,
      true,
    )(origin + "/rest/v1/rpc/hq_human_action", { method: "POST" });
    expect(native).toHaveBeenCalledTimes(1);
    for (const path of [
      "/rest/v1/opportunities",
      "/rest/v1/rpc/bootstrap_personal_workspace",
      "/rest/v1/rpc/hq_human_action?anything=1",
      "/auth/v1/admin/users",
    ])
      await expect(
        readOnlyFetch(origin, native, true)(origin + path, { method: "POST" }),
      ).rejects.toThrow();
    expect(native).toHaveBeenCalledTimes(1);
  });
  it("sends workspace, opportunity, reviewed version and retry key through the real SDK", async () => {
    const native = vi.fn().mockResolvedValue(
      new Response('{"command":"pursue","task_id":"synthetic-task"}', {
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createHqClient(
      { url: origin, key: "sb_publishable_fixture_only", humanActions: true },
      native,
    );
    const job = buildJobViews(visualFixture())[0];
    await runHumanAction(
      client,
      "workspace",
      job,
      "pursue",
      { action_id: "action" },
      "retry-key",
    );
    const [url, options] = native.mock.calls[0];
    expect(String(url)).toBe(origin + "/rest/v1/rpc/hq_human_action");
    expect(JSON.parse(options.body)).toEqual({
      target_workspace_id: "workspace",
      target_opportunity_id: job.opportunity.id,
      expected_updated_at: job.opportunity.updated_at,
      request_id: "retry-key",
      command: "pursue",
      payload: { action_id: "action" },
    });
    client.auth.stopAutoRefresh();
  });
  it("keeps the default client read only even if a caller invokes the human RPC", async () => {
    const native = vi.fn();
    const client = createHqClient(
      { url: origin, key: "sb_publishable_fixture_only" },
      native,
    );
    await expect(
      runHumanAction(
        client,
        "workspace",
        buildJobViews(visualFixture())[0],
        "pursue",
        {},
        "retry-key",
      ),
    ).rejects.toThrow();
    expect(native).not.toHaveBeenCalled();
    client.auth.stopAutoRefresh();
  });
});
