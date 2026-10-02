import { describe, it, expect, vi } from "vitest";
import {
  createHqClient,
  OUTREACH_READ_TABLES,
  readOnlyFetch,
} from "@/lib/supabase/client";
import { loadOutreach, runOutreachAction } from "@/lib/outreach";
const origin = "https://xhhfnxswwspejdxjyvzz.supabase.co";
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
describe("Outreach SDK capability boundary", () => {
  it("defaults to no Outreach reads or writes, independently of Phase 2 actions", async () => {
    const native = vi.fn();
    for (const actions of [false, true]) {
      const send = readOnlyFetch(origin, native, actions);
      for (const table of OUTREACH_READ_TABLES)
        await expect(send(`${origin}/rest/v1/${table}`)).rejects.toThrow();
      await expect(
        send(`${origin}/rest/v1/rpc/hq_outreach_action`, { method: "POST" }),
      ).rejects.toThrow();
    }
    expect(native).not.toHaveBeenCalled();
  });
  it("permits only the nine public reads and exact approved RPC path when gated on", async () => {
    const native = vi.fn<typeof fetch>(async () => response([])),
      send = readOnlyFetch(origin, native, false, true);
    for (const table of OUTREACH_READ_TABLES)
      await send(
        `${origin}/rest/v1/${table}?workspace_id=eq.fixture-workspace`,
      );
    await send(`${origin}/rest/v1/rpc/hq_outreach_action`, { method: "POST" });
    for (const [path, method] of [
      ["/rest/v1/contacts", "POST"],
      ["/rest/v1/outreach_messages", "PATCH"],
      ["/rest/v1/outreach_action_requests", "GET"],
      ["/rest/v1/private.outreach_action_requests", "GET"],
      ["/rest/v1/rpc/hq_outreach_action?anything=1", "POST"],
      ["/rest/v1/rpc/hq_human_action", "POST"],
      ["/auth/v1/admin/users", "GET"],
    ])
      await expect(send(origin + path, { method })).rejects.toThrow();
    await expect(
      send("https://other.invalid/rest/v1/contacts"),
    ).rejects.toThrow();
    expect(native).toHaveBeenCalledTimes(10);
    expect(native.mock.calls[0][1]).toMatchObject({
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
    });
  });
  it("sends exact revision, body and the same request identity through the real SDK", async () => {
    const native = vi.fn<typeof fetch>(async () =>
      response({ message_id: "exact-version" }),
    );
    const client = createHqClient(
      { url: origin, key: "sb_publishable_fixture_only", outreach: true },
      native,
    );
    const payload = {
      engagement_id: "workstream",
      expected_revision: 3,
      content: "Exact\nwhole replacement",
      channel: "email",
    };
    for (let i = 0; i < 2; i++)
      await runOutreachAction(
        client,
        "fixture-workspace",
        "save_draft",
        payload,
        "same-request",
      );
    expect(native).toHaveBeenCalledTimes(2);
    expect(native.mock.calls[0][0]).toBe(
      origin + "/rest/v1/rpc/hq_outreach_action",
    );
    expect(JSON.parse(native.mock.calls[0][1]!.body as string)).toEqual({
      target_workspace_id: "fixture-workspace",
      request_id: "same-request",
      command: "save_draft",
      payload,
    });
    expect(native.mock.calls[1][1]!.body).toBe(native.mock.calls[0][1]!.body);
  });
  it("scope-checks every domain page and never reads the private retry ledger", async () => {
    const native = vi.fn<typeof fetch>(async () => response([]));
    const client = createHqClient(
      { url: origin, key: "sb_publishable_fixture_only", outreach: true },
      native,
    );
    const rows = await loadOutreach(client, "fixture-workspace");
    expect(Object.keys(rows)).toHaveLength(9);
    expect(native).toHaveBeenCalledTimes(9);
    for (const [input] of native.mock.calls) {
      const url = new URL(String(input));
      expect(url.searchParams.get("workspace_id")).toBe("eq.fixture-workspace");
      expect(url.searchParams.get("order")).toBe("id.asc");
      expect(OUTREACH_READ_TABLES.has(url.pathname.slice(9))).toBe(true);
    }
  });
  it("rejects foreign-workspace rows even if transport returned them", async () => {
    const client = createHqClient(
      { url: origin, key: "sb_publishable_fixture_only", outreach: true },
      async () => response([{ id: "foreign", workspace_id: "other" }]),
    );
    await expect(loadOutreach(client, "fixture-workspace")).rejects.toThrow(
      "Outreach data is unavailable",
    );
  });
  it.each([
    ["40001", "changed"],
    ["42501", "cannot perform"],
    ["PGRST202", "not enabled"],
    ["UNKNOWN", "Retry this same request"],
  ])(
    "sanitizes %s errors without exposing server details",
    async (code, message) => {
      const client = createHqClient(
        { url: origin, key: "sb_publishable_fixture_only", outreach: true },
        async () =>
          response(
            { code, message: "PRIVATE ROW/STACK SHOULD NEVER APPEAR" },
            400,
          ),
      );
      await expect(
        runOutreachAction(
          client,
          "fixture-workspace",
          "save_draft",
          {},
          "retry",
        ),
      ).rejects.toThrow(message);
    },
  );
  it("treats malformed or unconfirmed results as uncertain and safe to retry", async () => {
    const client = createHqClient(
      { url: origin, key: "sb_publishable_fixture_only", outreach: true },
      async () => response({ contact_id: "wrong-result" }),
    );
    await expect(
      runOutreachAction(client, "fixture-workspace", "save_draft", {}, "retry"),
    ).rejects.toThrow("Retry this same request");
  });
});
