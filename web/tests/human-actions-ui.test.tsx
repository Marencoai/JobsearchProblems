// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { HumanActions } from "@/components/human-actions";
import { HqShell } from "@/components/hq-shell";
import { buildJobViews } from "@/lib/workflow";
import { fixtureIdentity, visualFixture } from "@/lib/qa-fixtures";
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
});
afterEach(cleanup);
function job(id = "evaluate") {
  return buildJobViews(visualFixture()).find((j) => j.opportunity.id === id)!;
}
describe("explicit candidate confirmation", () => {
  it("does not authorize pursuit on opening or cancelling the dialog", async () => {
    const action = vi.fn();
    render(<HumanActions job={job()} stage="Evaluate" onAction={action} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Pursue this opportunity" }),
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(action).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(action).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("reuses the same idempotency key after an uncertain request failure", async () => {
    const action = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValue(undefined);
    render(<HumanActions job={job()} stage="Evaluate" onAction={action} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Pursue this opportunity" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(action.mock.calls[0][3]).toBe(action.mock.calls[1][3]);
    expect(action.mock.calls[0][1]).toBe("pursue");
    expect(action.mock.calls[0][2]).toEqual({
      action_id: "decide",
      action_updated_at: "2026-10-01T12:00:00Z",
    });
  });
  it("does not send duplicate requests while a confirmation is pending", async () => {
    let finish!: () => void;
    const action = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<HumanActions job={job()} stage="Evaluate" onAction={action} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Pursue this opportunity" }),
    );
    const form = screen
      .getByRole("button", { name: "Confirm" })
      .closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(action).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("changes the retry key when the candidate changes the pass reason", async () => {
    const action = vi.fn().mockRejectedValue(new Error("Retry"));
    render(<HumanActions job={job()} stage="Evaluate" onAction={action} />);
    fireEvent.click(screen.getByRole("button", { name: "Pass" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Reason for passing" }),
      { target: { value: "Location" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByRole("alert");
    fireEvent.change(
      screen.getByRole("textbox", { name: "Reason for passing" }),
      { target: { value: "Compensation" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(action.mock.calls[0][3]).not.toBe(action.mock.calls[1][3]);
  });
  it("requires confirmation of exact material versions for approval", async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    render(
      <HumanActions job={job("resume")} stage="Resume" onAction={action} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Approve package" }));
    expect(
      (
        screen.getByRole("button", {
          name: "Confirm approval",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText("Resume · Version 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm approval" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0][2].material_ids).toEqual(["resume-material"]);
  });
  it("requires explicit submission with exact materials and hides it for an already submitted package", async () => {
    const j = job("application");
    j.applications = [];
    j.materials = [
      {
        ...job("resume").materials[0],
        id: "approved-exact-v3",
        application_package_id: j.package!.id,
        version_number: 3,
        status: "approved",
      },
    ];
    const action = vi.fn().mockResolvedValue(undefined);
    render(<HumanActions job={j} stage="Application" onAction={action} />);
    fireEvent.click(
      screen.getByRole("button", { name: "I submitted the application" }),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Confirm submission",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm submission" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0][2]).toMatchObject({
      confirmed: true,
      material_ids: ["approved-exact-v3"],
    });
    cleanup();
    render(
      <HumanActions
        job={job("application")}
        stage="Application"
        onAction={action}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "I submitted the application" }),
    ).toBeNull();
  });
  it("enables candidate actions only through the explicit shell capability", () => {
    render(
      <HqShell
        identity={fixtureIdentity}
        data={visualFixture()}
        workspaceId="fixture-workspace"
        loading={false}
        error=""
        onWorkspace={() => {}}
        onReload={() => {}}
        onSignOut={() => {}}
        onAction={vi.fn()}
      />,
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Pursue this opportunity",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(
      (screen.getByRole("button", { name: "Refresh" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
