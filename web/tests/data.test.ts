import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createHqClient,
  readOnlyFetch,
  READ_TABLES,
  validConfig,
  type HqClient,
} from "@/lib/supabase/client";
import { loadWorkspace, readPages, resolveIdentity } from "@/lib/queries";

const origin = "https://xhhfnxswwspejdxjyvzz.supabase.co";
const config = { url: origin, key: "sb_publishable_fixture_only" };
const clients: HqClient[] = [];
afterEach(() => {
  clients.forEach((c) => c.auth.stopAutoRefresh());
  clients.length = 0;
});
describe("read-only transport", () => {
  it.each([
    ["POST", "/rest/v1/opportunities"],
    ["PATCH", "/rest/v1/principals?id=eq.a"],
    ["DELETE", "/rest/v1/applications"],
    ["POST", "/rest/v1/rpc/bootstrap_workspace"],
    ["GET", "/rest/v1/settings"],
    ["POST", "/auth/v1/token?grant_type=refresh_token"],
    ["GET", "/auth/v1/admin/users"],
    ["POST", "/auth/v1/logout?scope=global"],
  ])("blocks %s %s before network", async (method, path) => {
    const fetcher = vi.fn();
    await expect(
      readOnlyFetch(origin, fetcher)(origin + path, { method }),
    ).rejects.toThrow("authenticated reads only");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    "https://evil.invalid/rest/v1/opportunities",
    "https://user:pass@xhhfnxswwspejdxjyvzz.supabase.co/rest/v1/opportunities",
  ])("blocks foreign or credential-bearing URLs", async (url) => {
    const fetcher = vi.fn();
    await expect(readOnlyFetch(origin, fetcher)(url)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("accepts only approved reads with no cookies, cache or redirect following", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("[]"));
    await readOnlyFetch(origin, fetcher)(origin + "/rest/v1/evaluations");
    expect(fetcher).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
      }),
    );
  });
  it.each(["service_role_fake", "eyJlegacy_fake", "", "sb_secret_fake"])(
    "rejects non-publishable configuration",
    (key) => expect(validConfig({ url: origin, key })).toBe(false),
  );
  it("rejects insecure URLs", () =>
    expect(
      validConfig({
        ...config,
        url: "http://xhhfnxswwspejdxjyvzz.supabase.co",
      }),
    ).toBe(false));
  it("recognizes modern public config", () =>
    expect(validConfig(config)).toBe(true));
  it("rejects a different project", () =>
    expect(
      validConfig({ ...config, url: "https://different.supabase.co" }),
    ).toBe(false));
});
describe("paged reads", () => {
  it("loads a second page and retains every row", async () => {
    const query = vi.fn().mockImplementation((from: number) =>
      Promise.resolve({
        data: Array.from({ length: from === 0 ? 200 : 3 }, (_, i) => ({
          id: from + i,
        })),
        error: null,
      }),
    );
    const result = await readPages(query);
    expect(result).toHaveLength(203);
    expect(query).toHaveBeenNthCalledWith(2, 200, 399);
  });
  it("sanitizes database errors", async () => {
    await expect(
      readPages(() =>
        Promise.resolve({
          data: null,
          error: { message: "sensitive server detail" },
        }),
      ),
    ).rejects.toThrow("We couldn’t load this data");
  });
  it("fails explicitly rather than silently truncating large workspaces", async () => {
    await expect(
      readPages(() =>
        Promise.resolve({
          data: Array.from({ length: 200 }, () => ({})),
          error: null,
        }),
      ),
    ).rejects.toThrow("more focused query");
  });
});
function mockClient(tables: Record<string, unknown[]> = {}) {
  const requests: { method: string; url: URL }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    requests.push({ method, url });
    if (url.pathname === "/auth/v1/token")
      return Response.json({
        access_token: "fixture-access-token",
        refresh_token: "fixture-refresh-token",
        expires_in: 3600,
        token_type: "bearer",
        user: { id: "fixture-auth", email: "fixture@example.invalid" },
      });
    if (url.pathname === "/auth/v1/user")
      return Response.json({
        id: "fixture-auth",
        email: "fixture@example.invalid",
      });
    if (url.pathname === "/auth/v1/logout") return Response.json({});
    const table = url.pathname.split("/").at(-1)!;
    return Response.json(tables[table] ?? []);
  };
  const client = createHqClient(config, fetcher);
  clients.push(client);
  return { client, requests };
}
const identityTables = {
  principals: [
    {
      id: "fixture-human",
      name: "Diana",
      auth_user_id: "fixture-auth",
      principal_type: "human",
      status: "active",
    },
  ],
  workspace_memberships: [
    {
      id: "membership",
      workspace_id: "workspace-a",
      role_id: "owner",
      status: "active",
    },
  ],
  workspaces: [{ id: "workspace-a", name: "Workspace A", status: "active" }],
  roles: [{ id: "owner", name: "Owner" }],
};
describe("SDK integration with a mocked network", () => {
  it("verifies Auth, resolves a single active human, and reads only its active access", async () => {
    const { client, requests } = mockClient(identityTables);
    await client.auth.signInWithPassword({
      email: "fixture@example.invalid",
      password: "fixture-only",
    });
    const identity = await resolveIdentity(client);
    expect(identity.principal.id).toBe("fixture-human");
    expect(identity.roles[0].name).toBe("Owner");
    const principal = requests.find((r) =>
      r.url.pathname.endsWith("/principals"),
    )!.url.searchParams;
    expect(principal.get("auth_user_id")).toBe("eq.fixture-auth");
    expect(principal.get("principal_type")).toBe("eq.human");
    expect(principal.get("status")).toBe("eq.active");
    expect(
      requests
        .find((r) => r.url.pathname.endsWith("/workspace_memberships"))!
        .url.searchParams.get("principal_id"),
    ).toBe("eq.fixture-human");
  });
  it.each([
    { principals: [] },
    {
      principals: [identityTables.principals[0], identityTables.principals[0]],
    },
  ])(
    "rejects an unresolved/ambiguous human mapping",
    async ({ principals }) => {
      const { client } = mockClient({ ...identityTables, principals });
      await client.auth.signInWithPassword({
        email: "fixture@example.invalid",
        password: "fixture-only",
      });
      await expect(resolveIdentity(client)).rejects.toThrow("human profile");
    },
  );
  it("rejects no active membership", async () => {
    const { client } = mockClient({
      ...identityTables,
      workspace_memberships: [],
    });
    await client.auth.signInWithPassword({
      email: "fixture@example.invalid",
      password: "fixture-only",
    });
    await expect(resolveIdentity(client)).rejects.toThrow(
      "No active workspace membership",
    );
  });
  it("scopes every workspace table and resets scope on switching", async () => {
    const { client, requests } = mockClient();
    await loadWorkspace(client, "workspace-a", "human");
    await loadWorkspace(client, "workspace-b", "human");
    const reads = requests.filter((r) =>
      r.url.pathname.startsWith("/rest/v1/"),
    );
    expect(reads).toHaveLength(32);
    reads.forEach((request, index) => {
      expect(request.method).toBe("GET");
      expect(request.url.searchParams.get("workspace_id")).toBe(
        index < 16 ? "eq.workspace-a" : "eq.workspace-b",
      );
      expect(READ_TABLES.has(request.url.pathname.split("/").at(-1)!)).toBe(
        true,
      );
    });
    expect(
      reads
        .find((r) => r.url.pathname.endsWith("/next_actions"))!
        .url.searchParams.get("or"),
    ).toBe(
      "(assigned_to_principal_id.eq.human,assigned_to_principal_id.is.null)",
    );
    expect(
      reads
        .find((r) => r.url.pathname.endsWith("/internal_tasks"))!
        .url.searchParams.get("select"),
    ).not.toContain("output");
  });
  it("uses no persistence or background token refresh", async () => {
    const { client, requests } = mockClient();
    await client.auth.signInWithPassword({
      email: "fixture@example.invalid",
      password: "fixture-only",
    });
    const fresh = mockClient();
    expect((await fresh.client.auth.getSession()).data.session).toBeNull();
    await client.auth.signOut({ scope: "local" });
    expect(
      requests.filter((r) => r.url.search.includes("refresh_token")),
    ).toHaveLength(0);
  });
});
