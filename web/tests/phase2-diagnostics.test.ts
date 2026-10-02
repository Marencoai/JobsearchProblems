import { afterEach, describe, expect, it, vi } from "vitest";
import { createHqClient } from "@/lib/supabase/client";
import { GET as publicConfig } from "@/app/api/public-config/route";
import {
  phase2DiagnosticsEnabled,
  readPhase2Diagnostics,
} from "@/lib/phase2-diagnostics";
afterEach(() => vi.unstubAllEnvs());
describe("optional normal-session read-only diagnostic", () => {
  it("is unavailable in production even when the diagnostic flag is set", () => {
    expect(phase2DiagnosticsEnabled("development", "1")).toBe(true);
    for (const env of ["production", "test", undefined])
      expect(phase2DiagnosticsEnabled(env, "1")).toBe(false);
    expect(phase2DiagnosticsEnabled("development", "0")).toBe(false);
  });
  it("keeps the actual public-config diagnostic gate false in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HQ_PHASE2_DIAGNOSTICS", "1");
    vi.stubEnv("HQ_HUMAN_ACTIONS", "0");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      "https://xhhfnxswwspejdxjyvzz.supabase.co",
    );
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "sb_publishable_synthetic",
    );
    const response = publicConfig();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      phase2Diagnostics: false,
      humanActions: false,
    });
  });
  it("uses the real SDK for a bounded workspace GET and exposes only fixed report fields", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "private-row",
            available_after: null,
            unexpected_private_value: "never render source rows",
          },
        ]),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    const client = createHqClient(
      {
        url: "https://xhhfnxswwspejdxjyvzz.supabase.co",
        key: "sb_publishable_synthetic",
      },
      fetcher,
    );
    const report = await readPhase2Diagnostics(
      client,
      "human",
      "workspace",
      false,
    );
    expect(report).toMatchObject({
      principal_id: "human",
      workspace_id: "workspace",
      available_after_postgrest_read: true,
      human_actions_enabled: false,
      workflow_writes: false,
      rpc_executed: false,
      safe_to_enable: false,
    });
    expect(JSON.stringify(report)).not.toMatch(
      /private-row|unexpected_private_value|never render/,
    );
    const [url, options] = fetcher.mock.calls[0];
    const request = new URL(String(url));
    expect(request.pathname).toBe("/rest/v1/next_actions");
    expect(request.searchParams.get("workspace_id")).toBe("eq.workspace");
    expect(request.searchParams.get("limit")).toBe("1");
    expect(request.searchParams.get("select")).toBe("id,available_after");
    expect(options.method).toBe("GET");
    expect(fetcher).toHaveBeenCalledTimes(1);
    client.auth.stopAutoRefresh();
  });
  it("sanitizes PostgREST errors and makes no second request or mutation", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "untrusted server detail" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createHqClient(
      {
        url: "https://xhhfnxswwspejdxjyvzz.supabase.co",
        key: "sb_publishable_synthetic",
      },
      fetcher,
    );
    await expect(
      readPhase2Diagnostics(client, "human", "workspace", false),
    ).rejects.toThrow("The authenticated Phase 2 column read did not pass.");
    expect(fetcher).toHaveBeenCalledTimes(1);
    client.auth.stopAutoRefresh();
  });
});
