// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Phase2Diagnostics } from "@/components/phase2-diagnostics";
import type { Phase2ReadOnlyReport } from "@/lib/phase2-diagnostics";
afterEach(cleanup);
it("requires an explicit click and clears scope-specific output on remount", async () => {
  const run = vi.fn().mockResolvedValue({
    workspace_id: "first",
    workflow_writes: false,
    safe_to_enable: false,
  } as Phase2ReadOnlyReport);
  const page = render(<Phase2Diagnostics key="first" run={run} />);
  expect(run).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Check signed-in access" }),
  );
  expect(
    (await screen.findByLabelText("Read-only diagnostic report")).textContent,
  ).toContain("first");
  page.rerender(<Phase2Diagnostics key="second" run={run} />);
  expect(screen.queryByLabelText("Read-only diagnostic report")).toBeNull();
});
it("does not render arbitrary exception details", async () => {
  render(
    <Phase2Diagnostics
      run={vi.fn().mockRejectedValue(new Error("untrusted sensitive detail"))}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Check signed-in access" }),
  );
  expect((await screen.findByRole("alert")).textContent).not.toContain(
    "untrusted sensitive detail",
  );
});
