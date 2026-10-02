// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ResearchRefresh } from "@/components/research-refresh";
import { visualFixture } from "@/lib/qa-fixtures";
import type { Task } from "@/lib/types";
import type { ResearchRefreshHandler } from "@/lib/research-refresh";
afterEach(cleanup);
const opportunity = visualFixture().opportunities[0];
const task = (status: string, id = "requested") =>
  ({
    id,
    workspace_id: opportunity.workspace_id,
    opportunity_id: opportunity.id,
    task_type: "refresh_company_intelligence",
    domain: "company_intelligence",
    trigger_type: "candidate_action",
    trigger_reference: "candidate_requested_research_refresh",
    status,
  }) as Task;
describe("human research refresh", () => {
  it("keeps original target/version and retry key after an uncertain response", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error("Uncertain response"))
      .mockResolvedValue({ task_id: "requested" });
    const { rerender } = render(
      <ResearchRefresh
        opportunity={opportunity}
        tasks={[]}
        onRequest={request}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await screen.findByRole("alert");
    rerender(
      <ResearchRefresh
        opportunity={{ ...opportunity, updated_at: "2026-10-02T10:00:00Z" }}
        tasks={[]}
        onRequest={request}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry same request" }));
    await screen.findByRole("status");
    expect(request.mock.calls[1]).toEqual(request.mock.calls[0]);
    expect(
      (screen.getByRole("button", { name: "Refresh" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
  it("prevents double clicks, then permits a new key after the exact queued task completes", async () => {
    let resolve!: (v: { task_id: string }) => void;
    const request = vi.fn<ResearchRefreshHandler>(
      () => new Promise<{ task_id: string }>((r) => (resolve = r)),
    );
    const { rerender } = render(
      <ResearchRefresh
        opportunity={opportunity}
        tasks={[]}
        onRequest={request}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    fireEvent.click(screen.getByRole("button", { name: "Requesting…" }));
    expect(request).toHaveBeenCalledTimes(1);
    resolve({ task_id: "requested" });
    await screen.findByRole("status");
    rerender(
      <ResearchRefresh
        opportunity={opportunity}
        tasks={[task("completed")]}
        onRequest={request}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][1]).not.toBe(request.mock.calls[0][1]);
    resolve({ task_id: "next" });
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
  });
  it("shows blocked work plainly and ignores another workspace's pending task", () => {
    const request = vi.fn(),
      { rerender } = render(
        <ResearchRefresh
          opportunity={opportunity}
          tasks={[task("blocked")]}
          onRequest={request}
        />,
      );
    expect(screen.getByRole("status").textContent).toContain("needs attention");
    expect(
      (screen.getByRole("button", { name: "Refresh" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    rerender(
      <ResearchRefresh
        opportunity={opportunity}
        tasks={[{ ...task("ready"), workspace_id: "foreign" }]}
        onRequest={request}
      />,
    );
    expect(
      (screen.getByRole("button", { name: "Refresh" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
  it("cannot request when the capability is absent or the role is closed", () => {
    const { rerender } = render(
      <ResearchRefresh opportunity={opportunity} tasks={[]} />,
    );
    expect(
      (screen.getByRole("button", { name: "Refresh" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    const request = vi.fn();
    rerender(
      <ResearchRefresh
        opportunity={{ ...opportunity, opportunity_stage: "closed" }}
        tasks={[]}
        onRequest={request}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(request).not.toHaveBeenCalled();
  });
});
