// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { SessionProvider, useSession } from "@/components/session";
import { fixtureIdentity, emptyData } from "@/lib/qa-fixtures";
import { emptyOutreach } from "@/lib/outreach-types";
const mocks = vi.hoisted(() => ({
  resolveIdentity: vi.fn(),
  loadWorkspace: vi.fn(),
  loadOutreach: vi.fn(),
  runOutreach: vi.fn(),
  listeners: [] as ((event: string) => void)[],
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
  createHqClient: () => ({
    auth: {
      signInWithPassword: mocks.signIn,
      signOut: mocks.signOut,
      onAuthStateChange: (listener: (event: string) => void) => {
        mocks.listeners.push(listener);
        return { data: { subscription: { unsubscribe() {} } } };
      },
      getUser: async () => ({
        data: { user: { id: "fixture-auth" } },
        error: null,
      }),
    },
  }),
}));
vi.mock("@/lib/queries", () => ({
  resolveIdentity: mocks.resolveIdentity,
  loadWorkspace: mocks.loadWorkspace,
}));
vi.mock("@/lib/outreach", () => ({
  loadOutreach: mocks.loadOutreach,
  runOutreachAction: mocks.runOutreach,
}));
function Probe() {
  const session = useSession();
  return (
    <>
      <span>{session.ready ? "Ready" : "Starting"}</span>
      <span>{session.identity ? "Signed in" : "Signed out"}</span>
      <span>{session.data?.outreach ? "Domain loaded" : "No domain"}</span>
      <button
        onClick={() =>
          void session.signIn("fixture@example.invalid", "fixture-only")
        }
      >
        Sign in fixture
      </button>
      <button onClick={() => void session.signOut()}>Sign out fixture</button>
      <button
        onClick={() =>
          void session
            .actOutreach(
              "request_draft",
              { engagement_id: "reviewed-engagement" },
              "retained-request",
            )
            .catch(() => {})
        }
      >
        Request fixture draft
      </button>
    </>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.listeners = [];
  mocks.resolveIdentity.mockResolvedValue(fixtureIdentity);
  mocks.loadWorkspace.mockResolvedValue(emptyData());
  mocks.loadOutreach.mockResolvedValue(emptyOutreach());
  mocks.signIn.mockResolvedValue({ error: null });
  mocks.signOut.mockImplementation(async () => {
    mocks.listeners.forEach((listener) => listener("SIGNED_OUT"));
    return { error: null };
  });
  mocks.runOutreach.mockResolvedValue({ task_id: "queued" });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function setup(outreach: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        url: "https://xhhfnxswwspejdxjyvzz.supabase.co",
        key: "sb_publishable_fixture_only",
        outreach,
        humanActions: false,
      }),
    ),
  );
  render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  );
  await screen.findByText("Ready");
  fireEvent.click(screen.getByRole("button", { name: "Sign in fixture" }));
  await screen.findByText("Signed in");
  await waitFor(() => expect(mocks.loadWorkspace).toHaveBeenCalledTimes(1));
}
describe("Outreach session generation and live capability", () => {
  it("makes no domain reads or mutations when the server capability is off", async () => {
    await setup(false);
    fireEvent.click(
      screen.getByRole("button", { name: "Request fixture draft" }),
    );
    expect(mocks.loadOutreach).not.toHaveBeenCalled();
    expect(mocks.runOutreach).not.toHaveBeenCalled();
    expect(screen.getByText("No domain")).toBeTruthy();
  });
  it("rechecks identity and passes the active workspace/request through before refreshing actual records", async () => {
    await setup(true);
    await screen.findByText("Domain loaded");
    expect(mocks.resolveIdentity).toHaveBeenCalledTimes(2);
    fireEvent.click(
      screen.getByRole("button", { name: "Request fixture draft" }),
    );
    await waitFor(() => expect(mocks.loadOutreach).toHaveBeenCalledTimes(2));
    expect(mocks.resolveIdentity).toHaveBeenCalledTimes(3);
    expect(mocks.runOutreach.mock.calls[0].slice(1)).toEqual([
      "fixture-workspace",
      "request_draft",
      { engagement_id: "reviewed-engagement" },
      "retained-request",
    ]);
  });
  it("clears domain data on sign-out and discards an in-flight result before extra reads", async () => {
    await setup(true);
    await screen.findByText("Domain loaded");
    let finish!: (value: { task_id: string }) => void;
    mocks.runOutreach.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Request fixture draft" }),
    );
    await waitFor(() => expect(mocks.runOutreach).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Sign out fixture" }));
    await screen.findByText("Signed out");
    finish({ task_id: "late-result" });
    await waitFor(() => expect(screen.getByText("No domain")).toBeTruthy());
    expect(mocks.loadWorkspace).toHaveBeenCalledTimes(1);
    expect(mocks.loadOutreach).toHaveBeenCalledTimes(1);
  });
  it("blocks a changed principal or missing active membership before the RPC", async () => {
    await setup(true);
    await screen.findByText("Domain loaded");
    mocks.resolveIdentity.mockResolvedValue({
      ...fixtureIdentity,
      workspaces: [],
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Request fixture draft" }),
    );
    await waitFor(() => expect(mocks.resolveIdentity).toHaveBeenCalledTimes(3));
    expect(mocks.runOutreach).not.toHaveBeenCalled();
  });
});
