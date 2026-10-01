// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { HqShell, FitScore } from "@/components/hq-shell";
import { emptyData, fixtureIdentity, visualFixture } from "@/lib/qa-fixtures";
import { safeUrl } from "@/lib/format";
afterEach(cleanup);
function mount(data = visualFixture(), selectedId?: string) {
  return render(
    <HqShell
      identity={fixtureIdentity}
      data={data}
      workspaceId="fixture-workspace"
      selectedId={selectedId}
      loading={false}
      error=""
      onWorkspace={() => {}}
      onReload={() => {}}
      onSignOut={() => {}}
    />,
  );
}
describe("read-only workspace UI", () => {
  it.each([null, undefined, -1, 101, NaN])(
    "shows absent/invalid scores as unavailable",
    (score) => {
      render(
        <FitScore
          score={score}
          title="You fit them"
          text="Fit"
          color="green"
        />,
      );
      expect(screen.getByRole("img").getAttribute("aria-label")).toContain(
        "score not recorded",
      );
      expect(screen.getByText("—")).toBeTruthy();
    },
  );
  it("preserves a real zero score", () => {
    render(<FitScore score={0} title="They fit you" text="Fit" color="blue" />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain(
      "0 out of 100",
    );
  });
  it("renders each active job in exactly one group and keeps closed history separate", () => {
    mount();
    for (const stage of [
      "Pursue",
      "Resume",
      "Application",
      "Outreach",
      "Interview",
      "Offer",
    ])
      fireEvent.click(
        screen.getByRole("button", { name: new RegExp("^" + stage + "1$") }),
      );
    const sidebar = screen.getByRole("complementary", { name: "Job pipeline" });
    expect(within(sidebar).getAllByRole("link")).toHaveLength(10);
    expect(
      within(sidebar).queryByText("Historical Operations Role"),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /History/ }));
    expect(
      within(sidebar).getByText("Historical Operations Role"),
    ).toBeTruthy();
  });
  it("search filters company/title/location and counts without removing focused job", () => {
    mount();
    fireEvent.change(screen.getByRole("textbox", { name: "Search pipeline" }), {
      target: { value: "Transformation" },
    });
    expect(
      screen
        .getByRole("textbox", { name: "Search jobs, companies, or locations" })
        .getAttribute("value"),
    ).toBe("Transformation");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Revenue Operations",
    );
    fireEvent.click(screen.getByRole("button", { name: /^Interview1$/ }));
    expect(
      within(
        screen.getByRole("complementary", { name: "Job pipeline" }),
      ).getAllByRole("link"),
    ).toHaveLength(2);
  });
  it("keeps all seven stage buttons inspectable", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Offer" }));
    expect(
      screen.getByRole("heading", { level: 2, name: "Offer" }),
    ).toBeTruthy();
    expect(
      screen.getByText("No offer activity recorded for this opportunity."),
    ).toBeTruthy();
  });
  it("disables all mutation controls while stage navigation stays available", () => {
    const { container } = mount();
    for (const name of ["Add Job", "Save", "Refresh"])
      expect(
        (screen.getByRole("button", { name }) as HTMLButtonElement).disabled,
      ).toBe(true);
    const decisions = within(
      container.querySelector(".decision-actions") as HTMLElement,
    );
    for (const name of ["Pursue", "Pass", "Save for later"])
      expect(
        (
          decisions.getByRole("button", {
            name: new RegExp(name),
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Reload data" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
  it("has keyboard-accessible evaluation tabs", () => {
    mount();
    const overview = screen.getByRole("tab", { name: "Overview" });
    fireEvent.keyDown(overview, { key: "ArrowRight" });
    expect(
      screen
        .getByRole("tab", { name: "Fit Analysis" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByText("Revenue systems transformation")).toBeTruthy();
  });
  it("shows an explicit empty workspace", () => {
    mount(emptyData());
    expect(
      screen.getByText("No opportunities are recorded here yet."),
    ).toBeTruthy();
  });
  it("does not substitute another opportunity for an invalid route", () => {
    mount(visualFixture(), "invisible");
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(
      screen.getByText("This opportunity isn’t visible in this workspace"),
    ).toBeTruthy();
  });
  it("opens versioned material content and closes it", () => {
    mount(visualFixture(), "resume");
    fireEvent.click(screen.getByRole("button", { name: /Resume.*Version 1/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/SYNTHETIC QA RESUME/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Close material preview" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("shows the immutable submitted snapshot", () => {
    mount(visualFixture(), "application");
    expect(
      screen.getByText("Exact synthetic submitted resume snapshot."),
    ).toBeTruthy();
    expect(
      screen.getByText("Application confirmed · awaiting an update"),
    ).toBeTruthy();
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,x",
    "file:///tmp/x",
    "https://user:pass@example.invalid",
  ])("does not make unsafe source links clickable", (url) =>
    expect(safeUrl(url)).toBeUndefined(),
  );
});
