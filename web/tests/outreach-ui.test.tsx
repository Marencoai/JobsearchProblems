// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { OutreachPanel } from "@/components/outreach-panel";
import { HqShell } from "@/components/hq-shell";
import { outreachFixture, applyOutreachFixture } from "@/lib/outreach-fixtures";
import { emptyOutreach } from "@/lib/outreach-types";
import { fixtureIdentity, visualFixture } from "@/lib/qa-fixtures";
import { buildJobViews } from "@/lib/workflow";
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
});
afterEach(cleanup);
const job = () =>
  buildJobViews(visualFixture()).find((j) => j.opportunity.id === "outreach")!;
function openSent() {
  fireEvent.click(screen.getByRole("button", { name: "I sent this message" }));
  return screen.getByRole("dialog");
}
function attest(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByLabelText("Follow-up choice"), {
    target: { value: "none" },
  });
  fireEvent.click(within(dialog).getByRole("checkbox"));
}
function submit(dialog: HTMLElement) {
  fireEvent.submit(dialog.querySelector("form")!);
}
describe("Outreach human review and relationship interface", () => {
  it("shows verified incoming content, destination, source and actual timestamp without browser ingestion", () => {
    const data = outreachFixture();
    data.messages.push({
      ...data.messages[1],
      id: "verified-response",
      message_status: "received",
      direction: "inbound",
      channel: "email",
      content: "Exact verified incoming reply",
      received_at: "2026-09-30T12:15:00Z",
      external_reference: "synthetic-external-message-id",
      recipient_snapshot: {
        name: "Captured Alex",
        email: "captured@example.invalid",
      },
    });
    render(<OutreachPanel job={job()} data={data} />);
    expect(
      screen.getByText("Captured Alex · captured@example.invalid"),
    ).toBeTruthy();
    expect(screen.getByText("Exact verified incoming reply")).toBeTruthy();
    expect(
      screen.getByText(
        "External source reference: synthetic-external-message-id",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText("Actual received time (UTC): 2026-09-30T12:15:00Z"),
    ).toBeTruthy();
  });
  it("records an actual relationship step with source and reviewed engagement revision", async () => {
    const action = vi.fn().mockResolvedValue({ interaction_id: "step" });
    render(
      <OutreachPanel job={job()} data={outreachFixture()} onAction={action} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Record interaction" }));
    fireEvent.change(screen.getByLabelText("What actually happened?"), {
      target: { value: "Connected at an industry discussion" },
    });
    fireEvent.change(screen.getByLabelText("When did it happen?"), {
      target: { value: "2026-09-30T12:00" },
    });
    submit(screen.getByRole("dialog"));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0][1]).toMatchObject({
      source_system: "candidate",
      expected_revision: 1,
      interaction_type: "connect",
      summary: "Connected at an industry discussion",
    });
  });
  it("adds context with an explicit certainty label rather than inventing confirmation", async () => {
    const action = vi.fn().mockResolvedValue({ note_id: "note" });
    render(
      <OutreachPanel job={job()} data={outreachFixture()} onAction={action} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add a note" }));
    fireEvent.change(screen.getByLabelText("Professional context"), {
      target: { value: "Professional hypothesis" },
    });
    submit(screen.getByRole("dialog"));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0][1]).toMatchObject({
      note_text: "Professional hypothesis",
      validation_status: "candidate_review_needed",
      contact_id: "alex",
    });
  });
  it("closes an exact outstanding follow-up with a reason without claiming a send", async () => {
    const data = outreachFixture();
    data.taskLinks.push({
      id: "wait-link",
      workspace_id: "fixture-workspace",
      internal_task_id: "wait-task",
      outreach_engagement_id: "alex-relationship",
      outreach_message_id: "alex-v2",
      purpose: "follow_up",
    });
    const action = vi.fn().mockResolvedValue({ task_id: "wait-task" });
    render(
      <OutreachPanel
        job={job()}
        data={data}
        tasks={[
          {
            id: "wait-task",
            opportunity_id: "outreach",
            domain: "outreach",
            task_type: "outreach_follow_up",
            status: "waiting",
            trigger_type: "candidate_action",
            trigger_reference: "candidate_recorded_outreach_sent",
          },
        ]}
        onAction={action}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Close follow-up with a reason" }),
    );
    fireEvent.change(screen.getByLabelText("Reason for closing"), {
      target: { value: "Relationship does not need another message" },
    });
    submit(screen.getByRole("dialog"));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0][0]).toBe("resolve_follow_up");
    expect(action.mock.calls[0][1]).toMatchObject({
      task_id: "wait-task",
      reason: "Relationship does not need another message",
    });
  });
  it("creates a reusable person without a role binding in general networking", async () => {
    const action = vi.fn().mockResolvedValue({ contact_id: "general-person" });
    render(
      <OutreachPanel job={job()} data={outreachFixture()} onAction={action} />,
    );
    fireEvent.change(screen.getByLabelText("Relationship context"), {
      target: { value: "general" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add a person" }));
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Professional peer" },
    });
    submit(screen.getByRole("dialog"));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0][0]).toBe("save_contact");
    expect(action.mock.calls[0][1].opportunity_id).toBeUndefined();
    expect(action.mock.calls[0][1].source_system).toBe("candidate");
  });
  it("shows recommendation reason/source, reusable history and exact draft versions", () => {
    render(<OutreachPanel job={job()} data={outreachFixture()} />);
    expect(screen.getByText(/Leads the team this role/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /View source/ }).getAttribute("rel"),
    ).toContain("noopener");
    expect(screen.getByText(/also linked to 1 other opportunity/)).toBeTruthy();
    expect(screen.getByText("Version 2 · Review")).toBeTruthy();
    expect(screen.getByText(/Archived · Linkedin · v/)).toBeTruthy();
    expect(screen.getByText("Inferred")).toBeTruthy();
  });
  it("has a useful empty state and read-only controls without a write handler", () => {
    render(<OutreachPanel job={job()} data={emptyOutreach()} />);
    expect(screen.getByText("No contacts yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add a person" })).toBeNull();
  });
  it("does not invoke any action when choosing a recommendation, copying or cancelling sent review", async () => {
    const action = vi.fn(),
      copy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: copy },
    });
    render(
      <OutreachPanel job={job()} data={outreachFixture()} onAction={action} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Alex Rivera.*Director/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy message" }));
    await waitFor(() =>
      expect(copy).toHaveBeenCalledWith(outreachFixture().messages[1].content),
    );
    openSent();
    expect(action).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(action).not.toHaveBeenCalled();
  });
  it("requires explicit already-sent attestation and an explicit follow-up choice", async () => {
    const action = vi.fn().mockResolvedValue({ message_id: "alex-v2" });
    render(
      <OutreachPanel job={job()} data={outreachFixture()} onAction={action} />,
    );
    const dialog = openSent();
    submit(dialog);
    expect(action).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("checkbox"));
    submit(dialog);
    expect(action).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText("Follow-up choice"), {
      target: { value: "none" },
    });
    submit(dialog);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0][0]).toBe("mark_sent");
    expect(action.mock.calls[0][1]).toMatchObject({
      message_id: "alex-v2",
      engagement_id: "alex-relationship",
      expected_revision: 1,
      exact_content: outreachFixture().messages[1].content,
      exact_subject: null,
      recipient: {
        name: "Alex Rivera",
        address: "https://www.linkedin.com/in/synthetic-alex",
      },
      follow_up_choice: "none",
      follow_up_at: null,
      confirmed: true,
    });
  });
  it("retries an uncertain sent record with identical timestamp/payload/request ID", async () => {
    const action = vi
      .fn()
      .mockRejectedValueOnce(new Error("Uncertain result"))
      .mockResolvedValue({ message_id: "alex-v2" });
    render(
      <OutreachPanel job={job()} data={outreachFixture()} onAction={action} />,
    );
    const dialog = openSent();
    attest(dialog);
    submit(dialog);
    await screen.findByRole("alert");
    submit(dialog);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(action.mock.calls[1]).toEqual(action.mock.calls[0]);
  });
  it("rejects future actual sends and past follow-up times", async () => {
    const action = vi.fn();
    render(
      <OutreachPanel job={job()} data={outreachFixture()} onAction={action} />,
    );
    const dialog = openSent();
    attest(dialog);
    fireEvent.change(within(dialog).getByLabelText("Actual sent time"), {
      target: { value: "2099-01-01T12:00" },
    });
    submit(dialog);
    expect(action).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText("Actual sent time"), {
      target: { value: "2026-09-01T12:00" },
    });
    fireEvent.change(within(dialog).getByLabelText("Follow-up choice"), {
      target: { value: "future" },
    });
    fireEvent.change(within(dialog).getByLabelText("Follow-up review time"), {
      target: { value: "2026-09-02T12:00" },
    });
    submit(dialog);
    expect(action).not.toHaveBeenCalled();
  });
  it("locks double submissions and cancellation while a confirmation is in flight", async () => {
    let finish!: (v: { message_id: string }) => void;
    const action = vi.fn(
      () =>
        new Promise<{ message_id: string }>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <OutreachPanel job={job()} data={outreachFixture()} onAction={action} />,
    );
    const dialog = openSent();
    attest(dialog);
    submit(dialog);
    submit(dialog);
    expect(action).toHaveBeenCalledTimes(1);
    fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    finish({ message_id: "alex-v2" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("saves whole-message edits as a new version before allowing mark-sent", async () => {
    const action = vi.fn().mockResolvedValue({ message_id: "v3" });
    render(
      <OutreachPanel job={job()} data={outreachFixture()} onAction={action} />,
    );
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Entire replacement\nExact changed body" },
    });
    expect(
      (
        screen.getByRole("button", {
          name: "I sent this message",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Save new version" }));
    submit(screen.getByRole("dialog"));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0][0]).toBe("save_draft");
    expect(action.mock.calls[0][1]).toMatchObject({
      message_id: "alex-v2",
      content: "Entire replacement\nExact changed body",
    });
  });
  it("queues revised preparation without reproducing the worker or sending", async () => {
    const action = vi.fn().mockResolvedValue({ task_id: "queued" });
    render(
      <OutreachPanel job={job()} data={outreachFixture()} onAction={action} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Request revision" }));
    fireEvent.change(screen.getByLabelText("Guidance (optional)"), {
      target: { value: "Focus on the team's priorities" },
    });
    submit(screen.getByRole("dialog"));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0][0]).toBe("request_draft");
    expect(action.mock.calls[0][1]).toMatchObject({
      instructions: "Focus on the team's priorities",
      message_id: "alex-v2",
    });
    expect(screen.getByLabelText("Message").textContent).toBe(
      outreachFixture().messages[1].content,
    );
  });
  it("allows manual contact outside recommendations through one atomic command", async () => {
    const action = vi
      .fn()
      .mockResolvedValue({ contact_id: "manual", engagement_id: "work" });
    render(
      <OutreachPanel job={job()} data={outreachFixture()} onAction={action} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add a person" }));
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "My professional contact" },
    });
    submit(screen.getByRole("dialog"));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0][0]).toBe("add_manual_target");
    expect(action.mock.calls[0][1]).toMatchObject({
      full_name: "My professional contact",
      opportunity_id: "outreach",
    });
  });
  it("supports general networking without binding a message to this role", async () => {
    const action = vi.fn().mockResolvedValue({ message_id: "general" });
    render(
      <OutreachPanel job={job()} data={outreachFixture()} onAction={action} />,
    );
    fireEvent.change(screen.getByLabelText("Relationship context"), {
      target: { value: "general" },
    });
    expect(screen.getByRole("button", { name: /Morgan Blake/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "General networking" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    submit(screen.getByRole("dialog"));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0][1].opportunity_id).toBeNull();
  });
  it("keeps historical recipient snapshots after contact edits", () => {
    const data = outreachFixture();
    Object.assign(data.messages[1], {
      message_status: "sent",
      sent_at: "2026-09-30T12:00:00Z",
      recipient_snapshot: {
        name: "Historical Alex",
        address: "old@example.invalid",
      },
    });
    data.contacts[0].full_name = "Renamed professional";
    render(<OutreachPanel job={job()} data={data} />);
    expect(
      screen.getByText(/Historical Alex · old@example.invalid/),
    ).toBeTruthy();
    expect(screen.getByText("Exact recorded sent version")).toBeTruthy();
  });
  it("does not display foreign-workspace contact or message records", () => {
    const data = outreachFixture();
    data.contacts.push({
      ...data.contacts[0],
      id: "foreign",
      workspace_id: "foreign-workspace",
      full_name: "FOREIGN NAME",
    });
    data.messages.push({
      ...data.messages[1],
      id: "foreign-msg",
      workspace_id: "foreign-workspace",
      content: "FOREIGN SECRET",
    });
    render(<OutreachPanel job={job()} data={data} />);
    expect(screen.queryByText("FOREIGN NAME")).toBeNull();
    expect(screen.queryByText("FOREIGN SECRET")).toBeNull();
  });
  it("preserves all seven stages and hides the new domain when no data capability is supplied", () => {
    const data = visualFixture();
    render(
      <HqShell
        identity={fixtureIdentity}
        data={data}
        workspaceId="fixture-workspace"
        selectedId="outreach"
        loading={false}
        error=""
        onWorkspace={() => {}}
        onReload={() => {}}
        onSignOut={() => {}}
      />,
    );
    expect(screen.queryByLabelText("Outreach workspace")).toBeNull();
    expect(
      screen
        .getByRole("navigation", { name: "Opportunity stages" })
        .querySelectorAll("button"),
    ).toHaveLength(7);
  });
  it("synthetic version history preserves old exact body and replaces only working draft", () => {
    const data = outreachFixture(),
      next = applyOutreachFixture(
        data,
        "save_draft",
        {
          engagement_id: "alex-relationship",
          opportunity_id: "outreach",
          message_id: "alex-v2",
          channel: "email",
          content: "Replacement",
        },
        "alex-v3",
      );
    expect(data.messages[1].message_status).toBe("review");
    expect(next.data.messages[1].content).toBe(data.messages[1].content);
    expect(next.data.messages[1].message_status).toBe("archived");
    expect(next.data.messages[2]).toMatchObject({
      version_number: 3,
      content: "Replacement",
      supersedes_message_id: "alex-v2",
    });
  });
});
