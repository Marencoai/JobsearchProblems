// @vitest-environment jsdom
import { useEffect } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SessionProvider, useSession } from "@/components/session";
import { fixtureIdentity, visualFixture } from "@/lib/qa-fixtures";
import type { Identity, MaterialArtifact } from "@/lib/types";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  identity: vi.fn(),
  load: vi.fn(),
  research: vi.fn(),
  deliver: vi.fn(),
  outreach: vi.fn(),
}));
vi.mock("@/lib/supabase/client", async (original) => ({
  ...(await original<typeof import("@/lib/supabase/client")>()),
  createHqClient: mocks.create,
}));
vi.mock("@/lib/queries", async (original) => ({
  ...(await original<typeof import("@/lib/queries")>()),
  resolveIdentity: mocks.identity,
  loadWorkspace: mocks.load,
}));
vi.mock("@/lib/research-refresh", () => ({
  requestResearchRefresh: mocks.research,
}));
vi.mock("@/lib/material-delivery", async (original) => ({
  ...(await original<typeof import("@/lib/material-delivery")>()),
  loadMaterialArtifact: mocks.deliver,
}));
vi.mock("@/lib/outreach", async (original) => ({
  ...(await original<typeof import("@/lib/outreach")>()),
  loadOutreach: mocks.outreach,
}));
let state: ReturnType<typeof useSession>;
let authEvent: (event: string) => void;
function Probe() {
  const session = useSession();
  useEffect(() => {
    state = session;
  });
  return (
    <output>
      {session.workspaceId}:
      {session.data?.materials[0]?.workspace_id ?? "empty"}
    </output>
  );
}
const workspaceA = "fixture-workspace",
  workspaceB = "synthetic-workspace-b";
const scoped = (workspace: string) => {
  const data = visualFixture();
  for (const key of [
    "opportunities",
    "materials",
    "actions",
    "tasks",
    "packages",
    "applications",
    "submittedMaterials",
  ] as const)
    data[key] = data[key].map((row) => ({
      ...row,
      workspace_id: workspace,
    })) as never;
  return data;
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.clearAllMocks();
  const identity: Identity = {
    ...fixtureIdentity,
    workspaces: [
      ...fixtureIdentity.workspaces,
      { id: workspaceB, name: "Synthetic B", status: "active" },
    ],
    memberships: [
      ...fixtureIdentity.memberships,
      {
        ...fixtureIdentity.memberships[0],
        id: "synthetic-b-membership",
        workspace_id: workspaceB,
      },
    ],
  };
  mocks.identity.mockResolvedValue(identity);
  mocks.load.mockImplementation(async (_client, workspace) =>
    scoped(workspace),
  );
  mocks.outreach.mockResolvedValue(undefined);
  mocks.create.mockReturnValue({
    auth: {
      onAuthStateChange: (callback: typeof authEvent) => {
        authEvent = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "synthetic-auth" } },
        error: null,
      }),
      signOut: vi.fn().mockImplementation(async () => {
        authEvent("SIGNED_OUT");
        return { error: null };
      }),
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          humanActions: true,
          manualIntake: true,
          materialDelivery: true,
          researchRefresh: true,
          outreach: true,
          interview: false,
          offer: false,
        }),
      ),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function ready() {
  render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  );
  await waitFor(() => expect(state.ready).toBe(true));
}
async function signedIn() {
  await ready();
  await act(async () =>
    state.signIn("synthetic@example.invalid", "synthetic-not-a-secret"),
  );
  expect(state.data?.materials[0].workspace_id).toBe(workspaceA);
}
it("discards an older workspace read even when it finishes after the new scope", async () => {
  const old = deferred<ReturnType<typeof scoped>>();
  mocks.load.mockImplementation(async (_client, workspace) =>
    workspace === workspaceA ? old.promise : scoped(workspace),
  );
  await ready();
  let signIn!: Promise<void>;
  await act(async () => {
    signIn = state.signIn("synthetic@example.invalid", "synthetic-only");
  });
  await waitFor(() =>
    expect(mocks.load).toHaveBeenCalledWith(
      expect.anything(),
      workspaceA,
      fixtureIdentity.principal.id,
      true,
      true,
    ),
  );
  await act(async () => state.selectWorkspace(workspaceB));
  await act(async () => {
    old.resolve(scoped(workspaceA));
    await signIn;
  });
  expect(state.workspaceId).toBe(workspaceB);
  expect(state.data?.materials[0].workspace_id).toBe(workspaceB);
});
it("rejects a completed research action after workspace change and preserves the new workspace", async () => {
  await signedIn();
  const request = deferred<{ task_id: string }>();
  mocks.research.mockReturnValue(request.promise);
  let operation!: Promise<unknown>;
  await act(async () => {
    operation = state.refreshResearch(
      state.data!.opportunities[0],
      "synthetic-key",
    );
  });
  const result = operation.catch((error) => error);
  await waitFor(() => expect(mocks.research).toHaveBeenCalledTimes(1));
  await act(async () => state.selectWorkspace(workspaceB));
  await act(async () => request.resolve({ task_id: "synthetic-task" }));
  expect(await result).toMatchObject({
    message: expect.stringMatching(/workspace changed/i),
  });
  expect(state.data?.materials[0].workspace_id).toBe(workspaceB);
});
it("sign-out invalidates in-flight file bytes and clears all loaded workspace data", async () => {
  await signedIn();
  const load = deferred<Blob>();
  mocks.deliver.mockReturnValue(load.promise);
  const material = state.data!.materials[0];
  let operation!: Promise<unknown>;
  await act(async () => {
    operation = state.deliver(material, {
      workspace_id: workspaceA,
    } as MaterialArtifact);
  });
  const result = operation.catch((error) => error);
  await waitFor(() => expect(mocks.deliver).toHaveBeenCalledTimes(1));
  await act(async () => state.signOut());
  await act(async () => load.resolve(new Blob(["synthetic old bytes"])));
  expect(await result).toMatchObject({
    message: expect.stringMatching(/workspace changed/i),
  });
  expect(state.identity).toBeNull();
  expect(state.data).toBeNull();
  expect(state.workspaceId).toBe("");
});
