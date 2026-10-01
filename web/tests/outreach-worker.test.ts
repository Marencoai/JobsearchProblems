import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  outreachPreparationTarget,
  outreachFollowUpDisposition,
  type OutreachTask,
  type OutreachTaskLink,
  type OutreachEngagement,
  type OutreachMessage,
} from "../../worker-support/outreach-contracts";

const actor = "synthetic-agent",
  workspace = "synthetic-workspace";
const engagement: OutreachEngagement = {
  id: "engagement",
  workspace_id: workspace,
  contact_id: "contact",
  status: "active",
  revision: 3,
};
const task: OutreachTask = {
  id: "task",
  workspace_id: workspace,
  opportunity_id: "role",
  task_type: "prepare_outreach_draft",
  domain: "outreach",
  trigger_type: "candidate_action",
  trigger_reference: "candidate_requested_outreach_draft",
  status: "running",
  owner_principal_id: actor,
  not_before: null,
};
const link: OutreachTaskLink = {
  workspace_id: workspace,
  internal_task_id: "task",
  outreach_engagement_id: "engagement",
  outreach_message_id: null,
  purpose: "draft",
};
const message: OutreachMessage = {
  id: "message",
  workspace_id: workspace,
  outreach_engagement_id: "engagement",
  contact_id: "contact",
  opportunity_id: "role",
  draft_series_id: "series",
  version_number: 1,
  direction: "outbound",
  message_status: "review",
  response_to_message_id: null,
};
const wait = {
  ...task,
  task_type: "outreach_follow_up",
  status: "waiting",
  not_before: "2026-10-02T12:00:00Z",
};
const waitLink = {
  ...link,
  outreach_message_id: message.id,
  purpose: "follow_up",
};
describe("Outreach worker routing without duplicated worker logic", () => {
  it("routes candidate preparation to the exact authenticated result-acceptance command", () => {
    expect(
      outreachPreparationTarget(actor, task, link, engagement, []),
    ).toEqual({
      disposition: "prepare",
      task_id: "task",
      engagement_id: "engagement",
      expected_revision: 3,
      opportunity_id: "role",
      message_id: null,
      command: "complete_draft",
    });
  });
  it("supports general professional relationships without a role", () => {
    expect(
      outreachPreparationTarget(
        actor,
        { ...task, opportunity_id: null },
        link,
        engagement,
        [],
      ).disposition,
    ).toBe("prepare");
  });
  it.each([
    { workspace_id: "foreign" },
    { owner_principal_id: "other" },
    { domain: "application" },
    { trigger_reference: "automatic-send" },
    { trigger_type: "agent_action" },
    { status: "ready" },
  ])("rejects changed preparation task %j", (patch) => {
    expect(() =>
      outreachPreparationTarget(
        actor,
        { ...task, ...patch },
        link,
        engagement,
        [],
      ),
    ).toThrow();
  });
  it("rejects cross-tenant routing or a closed relationship", () => {
    expect(() =>
      outreachPreparationTarget(
        actor,
        task,
        { ...link, workspace_id: "foreign" },
        engagement,
        [],
      ),
    ).toThrow();
    expect(() =>
      outreachPreparationTarget(
        actor,
        task,
        link,
        { ...engagement, status: "closed" },
        [],
      ),
    ).toThrow();
  });
  it("does not reprepare terminal tasks", () => {
    expect(
      outreachPreparationTarget(
        actor,
        { ...task, status: "completed" },
        link,
        engagement,
        [],
      ).disposition,
    ).toBe("terminal");
  });
  it("regenerates only the exact latest unsent version", () => {
    const regeneration = { ...link, outreach_message_id: message.id };
    expect(
      outreachPreparationTarget(actor, task, regeneration, engagement, [
        message,
      ]).message_id,
    ).toBe(message.id);
    expect(() =>
      outreachPreparationTarget(actor, task, regeneration, engagement, [
        message,
        { ...message, id: "new-version", version_number: 2 },
      ]),
    ).toThrow("superseded");
    expect(() =>
      outreachPreparationTarget(actor, task, regeneration, engagement, [
        { ...message, message_status: "sent" },
      ]),
    ).toThrow("sent");
  });
  it("cannot borrow a message from another role or person", () => {
    for (const patch of [
      { workspace_id: "foreign" },
      { contact_id: "other" },
      { opportunity_id: "other" },
      { outreach_engagement_id: "other" },
    ])
      expect(() =>
        outreachPreparationTarget(
          actor,
          task,
          { ...link, outreach_message_id: message.id },
          engagement,
          [{ ...message, ...patch }],
        ),
      ).toThrow("foreign");
  });
  it("uses authoritative wait time and exact boundary instead of engagement cache", () => {
    const sent = { ...message, message_status: "sent" };
    expect(
      outreachFollowUpDisposition(
        actor,
        wait,
        waitLink,
        engagement,
        [sent],
        "2026-10-02T11:59:59Z",
      ).disposition,
    ).toBe("waiting");
    expect(
      outreachFollowUpDisposition(
        actor,
        wait,
        waitLink,
        engagement,
        [sent],
        "2026-10-02T12:00:00Z",
      ).disposition,
    ).toBe("candidate_review");
  });
  it("an exact incoming reply resolves a wait; a generic message or other tenant does not", () => {
    const sent = { ...message, message_status: "sent" };
    const reply = {
      ...message,
      id: "incoming",
      direction: "inbound",
      message_status: "received",
      response_to_message_id: message.id,
    };
    expect(
      outreachFollowUpDisposition(
        actor,
        wait,
        waitLink,
        engagement,
        [sent, reply],
        "2026-10-03T00:00:00Z",
      ).disposition,
    ).toBe("responded");
    expect(
      outreachFollowUpDisposition(
        actor,
        wait,
        waitLink,
        engagement,
        [sent, { ...reply, response_to_message_id: null }],
        "2026-10-03T00:00:00Z",
      ).disposition,
    ).toBe("candidate_review");
    expect(
      outreachFollowUpDisposition(
        actor,
        wait,
        waitLink,
        engagement,
        [sent, { ...reply, workspace_id: "foreign" }],
        "2026-10-03T00:00:00Z",
      ).disposition,
    ).toBe("candidate_review");
  });
  it("never infers a sent message from a draft or missing routing", () => {
    expect(() =>
      outreachFollowUpDisposition(
        actor,
        wait,
        waitLink,
        engagement,
        [message],
        "2026-10-03T00:00:00Z",
      ),
    ).toThrow("exact sent version");
    expect(() =>
      outreachFollowUpDisposition(
        actor,
        wait,
        { ...waitLink, outreach_message_id: null },
        engagement,
        [],
        "2026-10-03T00:00:00Z",
      ),
    ).toThrow();
  });
  it("fails closed on invalid clock/wait timestamps and does not resume retired work", () => {
    const sent = { ...message, message_status: "sent" };
    expect(() =>
      outreachFollowUpDisposition(
        actor,
        wait,
        waitLink,
        engagement,
        [sent],
        "invalid",
      ),
    ).toThrow();
    expect(() =>
      outreachFollowUpDisposition(
        actor,
        { ...wait, not_before: null },
        waitLink,
        engagement,
        [sent],
        "2026-10-03T00:00:00Z",
      ),
    ).toThrow();
    expect(
      outreachFollowUpDisposition(
        actor,
        { ...wait, status: "cancelled" },
        waitLink,
        engagement,
        [sent],
        "2026-10-03T00:00:00Z",
      ).disposition,
    ).toBe("terminal");
    expect(
      outreachFollowUpDisposition(
        actor,
        wait,
        waitLink,
        { ...engagement, status: "archived" },
        [sent],
        "2026-10-03T00:00:00Z",
      ).disposition,
    ).toBe("blocked");
  });
  it("executes the exact documented preparation and follow-up CLI commands", async () => {
    const path = fileURLToPath(
      new URL("../../worker-support/outreach-cli.mts", import.meta.url),
    );
    async function cli(mode: string, data: unknown) {
      return new Promise<Record<string, unknown>>((resolve, reject) => {
        const child = execFile(
          process.execPath,
          [path, mode],
          { timeout: 10000 },
          (error, stdout) =>
            error ? reject(error) : resolve(JSON.parse(stdout)),
        );
        child.stdin?.end(JSON.stringify(data));
      });
    }
    expect(
      await cli("preparation", {
        principal_id: actor,
        task,
        task_link: link,
        engagement,
        messages: [],
      }),
    ).toMatchObject({ disposition: "prepare", command: "complete_draft" });
    expect(
      await cli("follow-up", {
        principal_id: actor,
        task: wait,
        task_link: waitLink,
        engagement,
        messages: [{ ...message, message_status: "sent" }],
        now: "2026-10-03T00:00:00Z",
      }),
    ).toMatchObject({
      disposition: "candidate_review",
      command: "reconcile_follow_up",
    });
  });
});
