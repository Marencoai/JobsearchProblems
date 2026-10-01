import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
} from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { databaseHarness } from "./database-harness";
import {
  outreachPreparationTarget,
  outreachFollowUpDisposition,
  type OutreachTask,
  type OutreachTaskLink,
  type OutreachEngagement,
  type OutreachMessage,
} from "../../worker-support/outreach-contracts";

type Data = Record<string, unknown>;
let db: PGlite;
let workspace: string, principal: string, company: string, opportunity: string;
let contact: string, engagement: string;
const ownerUser = randomUUID();
async function row(sql: string, args: unknown[] = []): Promise<Data> {
  return (await db.query<Data>(sql, args)).rows[0];
}
async function attempt<T>(operation: () => Promise<T>): Promise<T> {
  await db.exec("savepoint adversarial_check");
  try {
    const result = await operation();
    await db.exec("release savepoint adversarial_check");
    return result;
  } catch (error) {
    await db.exec(
      "rollback to savepoint adversarial_check; release savepoint adversarial_check",
    );
    throw error;
  }
}
async function rpc(command: string, payload: Data, request = randomUUID()) {
  return attempt(
    async () =>
      (
        await row("select public.hq_outreach_action($1,$2,$3,$4) as result", [
          workspace,
          request,
          command,
          payload,
        ])
      ).result as Data,
  );
}
async function version() {
  return (
    await row("select revision from outreach_engagements where id=$1", [
      engagement,
    ])
  ).revision;
}
async function edit(
  command: string,
  payload: Data = {},
  request = randomUUID(),
) {
  return rpc(
    command,
    {
      engagement_id: engagement,
      expected_revision: await version(),
      ...payload,
    },
    request,
  );
}
async function draft(payload: Data = {}) {
  return edit("save_draft", {
    opportunity_id: opportunity,
    channel: "email",
    content: "Exact synthetic outreach v1",
    ...payload,
  });
}
async function sentPayload(messageId: unknown, payload: Data = {}) {
  const content = (
    await row("select content from outreach_messages where id=$1", [messageId])
  ).content;
  return {
    message_id: messageId,
    confirmed: true,
    exact_content: content,
    recipient: {
      name: "Synthetic recruiter",
      address: "recruiter@example.invalid",
    },
    sent_at: new Date().toISOString(),
    follow_up_at: new Date(Date.now() + 86400000).toISOString(),
    ...payload,
  };
}
async function markSent(messageId: unknown, payload: Data = {}) {
  return edit("mark_sent", await sentPayload(messageId, payload));
}
async function newPrincipal(type: "agent" | "human", permissions: string[]) {
  await db.exec("reset role");
  const uid = randomUUID();
  await db.query(
    "insert into auth.users(id,email) values($1,'synthetic-other@example.invalid')",
    [uid],
  );
  const person = (
    await row(
      "insert into principals(auth_user_id,principal_type,name) values($1,$2,'Synthetic actor') returning id",
      [uid, type],
    )
  ).id;
  const role = (
    await row(
      "insert into roles(workspace_id,name) values($1,$2) returning id",
      [workspace, randomUUID()],
    )
  ).id;
  for (const key of permissions)
    await db.query(
      "insert into role_permissions(role_id,permission_id) select $1,id from permissions where permission_key=$2",
      [role, key],
    );
  await db.query(
    "insert into workspace_memberships(workspace_id,principal_id,role_id) values($1,$2,$3)",
    [workspace, person, role],
  );
  await db.exec("set local role authenticated");
  return { uid, person, role };
}
async function asUser(uid: string) {
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [uid]);
}
const workflow = [
  "workspace.read",
  "activity.read",
  "activity.create",
  "contact.read",
  "outreach.read",
  "opportunity.read",
  "company.read",
  "internal_task.read",
  "internal_task.create",
  "internal_task.update",
  "internal_task.execute",
  "next_action.read",
  "next_action.create",
  "next_action.update",
  "next_action.complete",
];
beforeAll(async () => {
  db = (await databaseHarness()).db;
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/proposals/outreach/20261001230000_outreach_domain.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 20000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("begin");
  await db.query(
    "insert into auth.users(id,email) values($1,'synthetic-owner@example.invalid')",
    [ownerUser],
  );
  await asUser(ownerUser);
  workspace = (
    await row(
      "select bootstrap_personal_workspace('Synthetic Outreach','synthetic-outreach') as id",
    )
  ).id as string;
  principal = (await row("select current_principal_id() as id")).id as string;
  await db.exec("set local role authenticated");
  company = (
    await row(
      "insert into companies(workspace_id,name) values($1,'Synthetic company') returning id",
      [workspace],
    )
  ).id as string;
  opportunity = (
    await row(
      "insert into opportunities(workspace_id,company_id,title,opportunity_stage) values($1,$2,'Synthetic role','pursuing') returning id",
      [workspace, company],
    )
  ).id as string;
  contact = (
    await rpc("save_contact", {
      company_id: company,
      full_name: "Synthetic recruiter",
      email: "recruiter@example.invalid",
      linkedin_url: "https://www.linkedin.com/in/synthetic-recruiter/",
      source_system: "candidate",
    })
  ).contact_id as string;
  engagement = (
    await rpc("create_engagement", {
      contact_id: contact,
      goal: "Build a professional relationship",
    })
  ).engagement_id as string;
  await edit("link_engagement", {
    opportunity_id: opportunity,
    relationship_type: "referral_path",
  });
});
afterEach(async () => {
  await db.exec("rollback");
});

describe("proposed Outreach schema and controlled transactions", () => {
  it("uses the canonical reusable relationship model and preserves backend lifecycle", async () => {
    const other = (
      await row(
        "insert into opportunities(workspace_id,company_id,title) values($1,$2,'Second synthetic role') returning id",
        [workspace, company],
      )
    ).id;
    await edit("link_engagement", { opportunity_id: other });
    expect(
      (
        await row(
          "select count(*)::int as n from outreach_engagement_opportunities where outreach_engagement_id=$1",
          [engagement],
        )
      ).n,
    ).toBe(2);
    expect(
      (
        await row("select opportunity_stage from opportunities where id=$1", [
          opportunity,
        ])
      ).opportunity_stage,
    ).toBe("pursuing");
    expect(
      (await row("select count(*)::int as n from outreach_messages")).n,
    ).toBe(0);
  });
  it("allows contacts and engagements without any opportunity", async () => {
    const d = await edit("save_draft", {
      channel: "linkedin",
      content: "General professional networking",
    });
    expect(
      (
        await row("select opportunity_id from outreach_messages where id=$1", [
          d.message_id,
        ])
      ).opportunity_id,
    ).toBeNull();
  });
  it("accepts manual contacts independently of recommended alternatives", async () => {
    const result = await rpc("link_contact", {
      contact_id: contact,
      opportunity_id: opportunity,
      selection_method: "manual",
      relevance: "Existing professional connection",
      source_system: "candidate",
      is_primary: true,
    });
    expect(
      (
        await row(
          "select selection_method,relevance from opportunity_contacts where id=$1",
          [result.opportunity_contact_id],
        )
      ).selection_method,
    ).toBe("manual");
  });
  it("preserves recommendations, source reasons and manual alternatives", async () => {
    await rpc("link_contact", {
      contact_id: contact,
      opportunity_id: opportunity,
      selection_method: "recommended",
      relevance: "Public hiring post",
      source_system: "public_research",
      source_reference: "https://example.invalid/hiring",
    });
    const alt = await rpc("save_contact", {
      full_name: "Synthetic colleague",
      source_system: "candidate",
    });
    await rpc("link_contact", {
      contact_id: alt.contact_id,
      opportunity_id: opportunity,
      selection_method: "manual",
      relevance: "Worked together",
      source_system: "candidate",
    });
    expect(
      (await row("select count(*)::int as n from opportunity_contacts")).n,
    ).toBe(2);
    await rpc("select_primary_contact", {
      contact_id: alt.contact_id,
      opportunity_id: opportunity,
    });
    expect(
      (
        await row(
          "select contact_id from opportunity_contacts where is_primary",
        )
      ).contact_id,
    ).toBe(alt.contact_id);
  });
  it("rejects duplicate relationship rows and duplicate primary targets", async () => {
    const input = {
      contact_id: contact,
      opportunity_id: opportunity,
      selection_method: "manual",
      relevance: "Connection",
      source_system: "candidate",
      is_primary: true,
    };
    await rpc("link_contact", input);
    await expect(rpc("link_contact", input)).rejects.toThrow(/unique/);
    const alt = await rpc("save_contact", {
      full_name: "Synthetic alternate",
      source_system: "candidate",
    });
    await expect(
      rpc("link_contact", { ...input, contact_id: alt.contact_id }),
    ).rejects.toThrow(/unique/);
  });
  it("saves exact versions, supersedes only linked review actions and freezes old content", async () => {
    const first = await draft();
    const unrelated = await row(
      "insert into next_actions(workspace_id,opportunity_id,action_type,title) values($1,$2,'review','Unrelated review') returning id",
      [workspace, opportunity],
    );
    const second = await draft({
      message_id: first.message_id,
      content: "Entire replacement v2",
    });
    expect(second.version_number).toBe(2);
    expect(
      await row(
        "select content,message_status from outreach_messages where id=$1",
        [first.message_id],
      ),
    ).toEqual({
      content: "Exact synthetic outreach v1",
      message_status: "archived",
    });
    expect(
      (
        await row("select status from next_actions where id=$1", [
          first.review_action_id,
        ])
      ).status,
    ).toBe("superseded");
    expect(
      (await row("select status from next_actions where id=$1", [unrelated.id]))
        .status,
    ).toBe("open");
    await expect(
      draft({ message_id: first.message_id, content: "Stale replacement" }),
    ).rejects.toThrow("latest message version");
  });
  it("optionally approves an exact version without claiming it was sent", async () => {
    const d = await draft();
    const approved = await edit("approve_message", {
      message_id: d.message_id,
      confirmed: true,
    });
    expect(approved.send_action_id).toBeTruthy();
    expect(
      await row(
        "select message_status,sent_at,approved_by_principal_id from outreach_messages where id=$1",
        [d.message_id],
      ),
    ).toEqual({
      message_status: "approved",
      sent_at: null,
      approved_by_principal_id: principal,
    });
  });
  it("retains the original exact-version approver when another human records the send", async () => {
    const d = await draft();
    await edit("approve_message", {
      message_id: d.message_id,
      confirmed: true,
    });
    const other = await newPrincipal("human", [
      ...workflow,
      "outreach.approve",
      "outreach.record_sent",
    ]);
    await asUser(other.uid);
    await markSent(d.message_id);
    expect(
      await row(
        "select approved_by_principal_id,sent_by_principal_id from outreach_messages where id=$1",
        [d.message_id],
      ),
    ).toEqual({
      approved_by_principal_id: principal,
      sent_by_principal_id: other.person,
    });
  });
  it("requires the exact subject as well as body for messages with a subject", async () => {
    const d = await draft({ subject: "Synthetic referral request" });
    await expect(markSent(d.message_id)).rejects.toThrow("subject");
    await markSent(d.message_id, {
      exact_subject: "Synthetic referral request",
    });
    expect(
      (
        await row("select subject from outreach_messages where id=$1", [
          d.message_id,
        ])
      ).subject,
    ).toBe("Synthetic referral request");
  });
  it("explicit follow-up resolution preserves sent history and claims no new message", async () => {
    const d = await draft(),
      s = await markSent(d.message_id);
    await edit("resolve_follow_up", {
      task_id: s.follow_up_task_id,
      reason: "No follow-up needed for this relationship",
    });
    expect(
      (
        await row("select status from internal_tasks where id=$1", [
          s.follow_up_task_id,
        ])
      ).status,
    ).toBe("completed");
    expect(
      (
        await row(
          "select next_follow_up_at from outreach_engagements where id=$1",
          [engagement],
        )
      ).next_follow_up_at,
    ).toBeNull();
    expect(
      (await row("select count(*)::int as n from outreach_messages")).n,
    ).toBe(1);
  });
  it("a newly attested follow-up resolves only the exact previous waiting task", async () => {
    const first = await draft(),
      wait = await markSent(first.message_id);
    const next = await draft();
    await markSent(next.message_id, {
      resolves_follow_up_task_id: wait.follow_up_task_id,
    });
    expect(
      (
        await row("select status from internal_tasks where id=$1", [
          wait.follow_up_task_id,
        ])
      ).status,
    ).toBe("completed");
    expect(
      (
        await row(
          "select count(*)::int as n from internal_tasks where task_type='outreach_follow_up' and status='waiting'",
        )
      ).n,
    ).toBe(1);
    expect(
      (
        await row(
          "select count(*)::int as n from outreach_messages where message_status='sent'",
        )
      ).n,
    ).toBe(2);
  });
  it("preserves candidate evidence provenance and fails a foreign evidence reference atomically", async () => {
    const skill = (
      await row(
        "insert into skills(workspace_id,name) values($1,'Synthetic skill') returning id",
        [workspace],
      )
    ).id;
    const d = await draft({
      evidence: [
        {
          type: "skill",
          id: skill,
          usage_context: "Relevant professional proof",
        },
      ],
    });
    expect(
      (
        await row(
          "select skill_id from outreach_message_evidence where outreach_message_id=$1",
          [d.message_id],
        )
      ).skill_id,
    ).toBe(skill);
    await expect(
      draft({
        evidence: [
          { type: "skill", id: randomUUID(), usage_context: "Invalid proof" },
        ],
      }),
    ).rejects.toThrow("foreign key");
    expect(
      (await row("select count(*)::int as n from outreach_messages")).n,
    ).toBe(1);
  });
  it("explicit mark-sent atomically confirms exact content, recipient, role, actor and wait task", async () => {
    const d = await draft();
    const result = await markSent(d.message_id);
    const m = await row("select * from outreach_messages where id=$1", [
      d.message_id,
    ]);
    expect(m.message_status).toBe("sent");
    expect(m.content).toBe("Exact synthetic outreach v1");
    expect(m.sent_by_principal_id).toBe(principal);
    expect(m.approved_by_principal_id).toBe(principal);
    expect(m.recipient_snapshot).toEqual({
      name: "Synthetic recruiter",
      address: "recruiter@example.invalid",
    });
    expect((m.opportunity_snapshot as Data).id).toBe(opportunity);
    expect(
      (
        await row("select status from next_actions where id=$1", [
          d.review_action_id,
        ])
      ).status,
    ).toBe("completed");
    expect(
      await row(
        "select status,domain,task_type from internal_tasks where id=$1",
        [result.follow_up_task_id],
      ),
    ).toEqual({
      status: "waiting",
      domain: "outreach",
      task_type: "outreach_follow_up",
    });
    expect(
      (
        await row(
          "select count(*)::int as n from next_actions where action_type='follow_up'",
        )
      ).n,
    ).toBe(0);
  });
  it("mark-sent records a fact directly without requiring a second approval gate", async () => {
    const d = await draft();
    await markSent(d.message_id);
    expect(
      (
        await row("select approval_status from outreach_messages where id=$1", [
          d.message_id,
        ])
      ).approval_status,
    ).toBe("approved");
  });
  it("accepts an explicitly attested historical send and an explicit choice of no follow-up", async () => {
    const d = await draft();
    const result = await markSent(d.message_id, {
      sent_at: "2026-01-01T12:00:00Z",
      follow_up_at: null,
      follow_up_choice: "none",
    });
    expect(result.follow_up_task_id).toBeNull();
    expect(
      (
        await row(
          "select next_follow_up_at,outreach_state from outreach_engagements where id=$1",
          [engagement],
        )
      ).outreach_state,
    ).toBe("contacted");
    expect(
      (
        await row(
          "select count(*)::int as n from internal_tasks where task_type='outreach_follow_up'",
        )
      ).n,
    ).toBe(0);
  });
  it("allows reversible engagement retirement and reopening while preserving history", async () => {
    await edit("update_engagement", {
      status: "dormant",
      relationship_state: "known",
    });
    await expect(draft()).rejects.toThrow("Active engagement");
    await edit("update_engagement", { status: "active" });
    await draft();
    expect(
      (
        await row(
          "select relationship_state from outreach_engagements where id=$1",
          [engagement],
        )
      ).relationship_state,
    ).toBe("known");
  });
  it.each([
    { confirmed: false },
    { exact_content: "Edited externally" },
    { sent_at: null },
    { sent_at: "2099-01-01" },
    { follow_up_at: null },
    { follow_up_at: "2000-01-01" },
    {
      recipient: { name: "Wrong person", address: "recruiter@example.invalid" },
    },
    {
      recipient: {
        name: "Synthetic recruiter",
        address: "different@example.invalid",
      },
    },
  ])(
    "rejects incomplete or mismatched sent attestation %j",
    async (payload) => {
      const d = await draft();
      await expect(markSent(d.message_id, payload)).rejects.toThrow();
      expect(
        (
          await row(
            "select message_status from outreach_messages where id=$1",
            [d.message_id],
          )
        ).message_status,
      ).toBe("review");
      expect(
        (
          await row("select status from next_actions where id=$1", [
            d.review_action_id,
          ])
        ).status,
      ).toBe("open");
    },
  );
  it("rejects stale engagement revisions before any mutation", async () => {
    const v = await version();
    const d = await draft();
    await expect(
      rpc("mark_sent", {
        engagement_id: engagement,
        expected_revision: v,
        ...(await sentPayload(d.message_id)),
      }),
    ).rejects.toThrow("Engagement changed");
  });
  it("replays an identical request exactly once and rejects conflicting input", async () => {
    const id = randomUUID();
    const p = {
      engagement_id: engagement,
      expected_revision: await version(),
      opportunity_id: opportunity,
      channel: "email",
      content: "Idempotent draft",
    };
    const first = await rpc("save_draft", p, id);
    expect(await rpc("save_draft", p, id)).toEqual(first);
    await expect(
      rpc("save_draft", { ...p, content: "Changed" }, id),
    ).rejects.toThrow("different input");
    expect(
      (await row("select count(*)::int as n from outreach_messages")).n,
    ).toBe(1);
  });
  it("mark-sent retry creates one wait task and one history event", async () => {
    const d = await draft(),
      id = randomUUID(),
      p = {
        engagement_id: engagement,
        expected_revision: await version(),
        ...(await sentPayload(d.message_id)),
      };
    const first = await rpc("mark_sent", p, id);
    expect(await rpc("mark_sent", p, id)).toEqual(first);
    expect(
      (
        await row(
          "select count(*)::int as n from internal_tasks where task_type='outreach_follow_up'",
        )
      ).n,
    ).toBe(1);
    expect(
      (
        await row(
          "select count(*)::int as n from activity_events where event_type='outreach_mark_sent'",
        )
      ).n,
    ).toBe(1);
    await expect(markSent(d.message_id)).rejects.toThrow("unsent outbound");
  });
  it("a changed contact cannot silently change the attested recipient; sent snapshots survive later edits", async () => {
    const d = await draft();
    await markSent(d.message_id);
    await rpc("save_contact", {
      contact_id: contact,
      expected_revision: 1,
      full_name: "Updated synthetic name",
      email: "new@example.invalid",
      source_system: "candidate",
    });
    expect(
      (
        await row(
          "select recipient_snapshot from outreach_messages where id=$1",
          [d.message_id],
        )
      ).recipient_snapshot,
    ).toEqual({
      name: "Synthetic recruiter",
      address: "recruiter@example.invalid",
    });
  });
  it("sent content and identity are immutable even to privileged maintenance", async () => {
    const d = await draft();
    await markSent(d.message_id);
    await db.exec("reset role");
    await expect(
      attempt(() =>
        db.query("update outreach_messages set content='Rewrite' where id=$1", [
          d.message_id,
        ]),
      ),
    ).rejects.toThrow("immutable");
    await expect(
      attempt(() =>
        db.query("delete from outreach_messages where id=$1", [d.message_id]),
      ),
    ).rejects.toThrow("retained");
  });
  it("a saved draft body cannot be overwritten by privileged direct writes", async () => {
    const d = await draft();
    await db.exec("reset role");
    await expect(
      attempt(() =>
        db.query("update outreach_messages set content='Rewrite' where id=$1", [
          d.message_id,
        ]),
      ),
    ).rejects.toThrow("new message version");
  });
  it("retains relationships and sent history after opportunity closure", async () => {
    const d = await draft();
    await markSent(d.message_id);
    await db.query(
      "update opportunities set opportunity_stage='closed',closed_reason='withdrawn' where id=$1",
      [opportunity],
    );
    expect((await row("select count(*)::int as n from contacts")).n).toBe(1);
    expect(
      (
        await row("select message_status from outreach_messages where id=$1", [
          d.message_id,
        ])
      ).message_status,
    ).toBe("sent");
  });
  it("records verified inbound messages and resolves only their exact response wait", async () => {
    const d = await draft(),
      sent = await markSent(d.message_id);
    const next = await draft(),
      other = await markSent(next.message_id);
    const received = await edit("record_received", {
      opportunity_id: opportunity,
      channel: "email",
      content: "Exact recruiter response",
      received_at: new Date().toISOString(),
      external_reference: "synthetic-mail-1",
      source_system: "gmail",
      response_to_message_id: d.message_id,
    });
    expect(
      (
        await row("select status from internal_tasks where id=$1", [
          sent.follow_up_task_id,
        ])
      ).status,
    ).toBe("completed");
    expect(
      (
        await row("select status from internal_tasks where id=$1", [
          other.follow_up_task_id,
        ])
      ).status,
    ).toBe("waiting");
    expect(
      (
        await row(
          "select response_to_message_id from outreach_messages where id=$1",
          [received.message_id],
        )
      ).response_to_message_id,
    ).toBe(d.message_id);
    expect(
      (
        await row("select content from outreach_messages where id=$1", [
          d.message_id,
        ])
      ).content,
    ).toBe("Exact synthetic outreach v1");
  });
  it("generic inbound networking does not claim an exact response or cancel a wait", async () => {
    const d = await draft(),
      sent = await markSent(d.message_id);
    await edit("record_received", {
      channel: "email",
      content: "Unrelated professional note",
      received_at: new Date().toISOString(),
      external_reference: "synthetic-generic",
      source_system: "gmail",
    });
    expect(
      (
        await row("select status from internal_tasks where id=$1", [
          sent.follow_up_task_id,
        ])
      ).status,
    ).toBe("waiting");
  });
  it("deduplicates external messages even with different request IDs", async () => {
    const input = {
      opportunity_id: opportunity,
      channel: "email",
      content: "Exact incoming",
      received_at: new Date().toISOString(),
      external_reference: "synthetic-mail-2",
      source_system: "gmail",
    };
    await edit("record_received", input);
    await expect(edit("record_received", input)).rejects.toThrow(
      "already recorded",
    );
    expect(
      (await row("select count(*)::int as n from outreach_messages")).n,
    ).toBe(1);
  });
  it("records warming interactions without sending or moving backend opportunity", async () => {
    await edit("record_interaction", {
      opportunity_id: opportunity,
      interaction_type: "connect",
      summary: "Manually connected on LinkedIn",
      occurred_at: new Date().toISOString(),
      source_system: "candidate",
    });
    expect(
      (
        await row(
          "select outreach_state from outreach_engagements where id=$1",
          [engagement],
        )
      ).outreach_state,
    ).toBe("warming");
    expect(
      (
        await row("select opportunity_stage from opportunities where id=$1", [
          opportunity,
        ])
      ).opportunity_stage,
    ).toBe("pursuing");
    expect(
      (await row("select count(*)::int as n from outreach_messages")).n,
    ).toBe(0);
  });
  it("appends professional notes with explicit confirmation provenance", async () => {
    const note = await rpc("add_note", {
      contact_id: contact,
      engagement_id: engagement,
      note_text: "Former professional colleague",
      validation_status: "confirmed",
    });
    expect(
      (
        await row(
          "select validation_status from relationship_notes where id=$1",
          [note.note_id],
        )
      ).validation_status,
    ).toBe("confirmed");
  });
  it("requests generation through an exact worker task and never generates in the transaction", async () => {
    const task = await edit("request_draft", {
      opportunity_id: opportunity,
      instructions: "Use a concise introduction",
    });
    expect(
      await row(
        "select domain,task_type,trigger_type,trigger_reference,status from internal_tasks where id=$1",
        [task.task_id],
      ),
    ).toEqual({
      domain: "outreach",
      task_type: "prepare_outreach_draft",
      trigger_type: "candidate_action",
      trigger_reference: "candidate_requested_outreach_draft",
      status: "ready",
    });
    expect(
      (await row("select count(*)::int as n from outreach_messages")).n,
    ).toBe(0);
    await expect(
      edit("request_draft", { opportunity_id: opportunity }),
    ).rejects.toThrow("already active");
  });
  it("accepts worker output only for its exact running task and creates a human review", async () => {
    const t = await edit("request_draft", { opportunity_id: opportunity });
    const worker = await newPrincipal("agent", [...workflow, "outreach.draft"]);
    await db.query(
      "update internal_tasks set owner_principal_id=$1,status='running' where id=$2",
      [worker.person, t.task_id],
    );
    await asUser(worker.uid);
    const taskRow = await row("select * from internal_tasks where id=$1", [
      t.task_id,
    ]);
    const linkRow = await row(
      "select * from outreach_task_links where internal_task_id=$1",
      [t.task_id],
    );
    const engagementRow = await row(
      "select * from outreach_engagements where id=$1",
      [engagement],
    );
    expect(
      outreachPreparationTarget(
        worker.person as string,
        taskRow as unknown as OutreachTask,
        linkRow as unknown as OutreachTaskLink,
        engagementRow as unknown as OutreachEngagement,
        [],
      ),
    ).toMatchObject({
      disposition: "prepare",
      task_id: t.task_id,
      engagement_id: engagement,
    });
    const d = await edit("complete_draft", {
      opportunity_id: opportunity,
      task_id: t.task_id,
      channel: "email",
      content: "Exact worker draft",
    });
    expect(
      (await row("select status from internal_tasks where id=$1", [t.task_id]))
        .status,
    ).toBe("completed");
    expect(
      (
        await row(
          "select approval_status,prepared_by_principal_id from outreach_messages where id=$1",
          [d.message_id],
        )
      ).prepared_by_principal_id,
    ).toBe(worker.person);
    await expect(
      edit("approve_message", { message_id: d.message_id, confirmed: true }),
    ).rejects.toThrow("human");
    await expect(markSent(d.message_id)).rejects.toThrow("human");
    await expect(draft()).rejects.toThrow("exact preparation task");
  });
  it("worker completion fails on an unowned task without partial records", async () => {
    const t = await edit("request_draft", { opportunity_id: opportunity });
    const worker = await newPrincipal("agent", [...workflow, "outreach.draft"]);
    await asUser(worker.uid);
    await expect(
      edit("complete_draft", {
        opportunity_id: opportunity,
        task_id: t.task_id,
        channel: "email",
        content: "Unauthorized output",
      }),
    ).rejects.toThrow("Exact running");
    expect(
      (await row("select count(*)::int as n from outreach_messages")).n,
    ).toBe(0);
  });
  it("agents cannot mark sent or approve even if accidentally granted those new permissions", async () => {
    const d = await draft();
    const worker = await newPrincipal("agent", [
      ...workflow,
      "outreach.approve",
      "outreach.record_sent",
    ]);
    await asUser(worker.uid);
    await expect(
      edit("approve_message", { message_id: d.message_id, confirmed: true }),
    ).rejects.toThrow("human");
    await expect(markSent(d.message_id)).rejects.toThrow("human");
  });
  it("follow-up becomes a single human action only after the authoritative task is due", async () => {
    const d = await draft(),
      s = await markSent(d.message_id);
    const worker = await newPrincipal("agent", workflow);
    await db.query(
      "update internal_tasks set owner_principal_id=$1 where id=$2",
      [worker.person, s.follow_up_task_id],
    );
    await asUser(worker.uid);
    await expect(
      rpc("reconcile_follow_up", { task_id: s.follow_up_task_id }),
    ).rejects.toThrow("not due");
    await db.query(
      "update internal_tasks set not_before=now()-interval '1 minute' where id=$1",
      [s.follow_up_task_id],
    );
    const taskRow = await row("select * from internal_tasks where id=$1", [
      s.follow_up_task_id,
    ]);
    const linkRow = await row(
      "select * from outreach_task_links where internal_task_id=$1",
      [s.follow_up_task_id],
    );
    const engagementRow = await row(
      "select * from outreach_engagements where id=$1",
      [engagement],
    );
    const messages = (await db.query<Data>("select * from outreach_messages"))
      .rows;
    expect(
      outreachFollowUpDisposition(
        worker.person as string,
        taskRow as unknown as OutreachTask,
        linkRow as unknown as OutreachTaskLink,
        engagementRow as unknown as OutreachEngagement,
        messages as unknown as OutreachMessage[],
        new Date().toISOString(),
      ).disposition,
    ).toBe("candidate_review");
    const first = await rpc("reconcile_follow_up", {
      task_id: s.follow_up_task_id,
    });
    const second = await rpc("reconcile_follow_up", {
      task_id: s.follow_up_task_id,
    });
    expect(first.action_id).toBe(second.action_id);
    expect(
      (
        await row(
          "select count(*)::int as n from next_actions where action_type='follow_up'",
        )
      ).n,
    ).toBe(1);
    expect(
      (
        await row("select opportunity_stage from opportunities where id=$1", [
          opportunity,
        ])
      ).opportunity_stage,
    ).toBe("pursuing");
  });
  it("fails atomically if the exact review action is unavailable", async () => {
    const d = await draft();
    await db.query("update next_actions set status='dismissed' where id=$1", [
      d.review_action_id,
    ]);
    await expect(markSent(d.message_id)).rejects.toThrow(
      "exact outreach action",
    );
    expect(
      (
        await row("select message_status from outreach_messages where id=$1", [
          d.message_id,
        ])
      ).message_status,
    ).toBe("review");
    expect(
      (
        await row(
          "select count(*)::int as n from internal_tasks where task_type='outreach_follow_up'",
        )
      ).n,
    ).toBe(0);
  });
  it("denies raw writes on every new table even to an authenticated Owner", async () => {
    for (const table of [
      "contacts",
      "opportunity_contacts",
      "outreach_engagements",
      "outreach_engagement_opportunities",
      "outreach_messages",
      "outreach_message_evidence",
      "outreach_interactions",
      "relationship_notes",
      "outreach_task_links",
    ]) {
      await expect(
        attempt(() => db.exec(`delete from ${table}`)),
      ).rejects.toThrow("permission denied");
      await expect(
        attempt(() => db.exec(`update ${table} set id=gen_random_uuid()`)),
      ).rejects.toThrow("permission denied");
    }
    await expect(
      attempt(() =>
        db.query(
          "insert into contacts(workspace_id,full_name,source_system,created_by_principal_id,updated_by_principal_id) values($1,'Bypass','candidate',$2,$2)",
          [workspace, principal],
        ),
      ),
    ).rejects.toThrow("permission denied");
  });
  it("read-only roles see authorized rows but cannot mutate through RPC", async () => {
    const viewer = await newPrincipal("human", [
      "workspace.read",
      "contact.read",
      "outreach.read",
    ]);
    await asUser(viewer.uid);
    expect((await row("select count(*)::int as n from contacts")).n).toBe(1);
    await expect(
      edit("save_draft", { channel: "email", content: "No write permission" }),
    ).rejects.toThrow("permission");
  });
  it("an inactive member sees no domain rows even with read capabilities", async () => {
    const viewer = await newPrincipal("human", [
      "workspace.read",
      "contact.read",
      "outreach.read",
    ]);
    await db.exec("reset role");
    await db.query(
      "update workspace_memberships set status='inactive' where principal_id=$1",
      [viewer.person],
    );
    await db.exec("set local role authenticated");
    await asUser(viewer.uid);
    expect((await row("select count(*)::int as n from contacts")).n).toBe(0);
    await expect(
      rpc("save_contact", {
        full_name: "Inactive member",
        source_system: "candidate",
      }),
    ).rejects.toThrow("active workspace");
  });
  it("does not complete an outreach action assigned to another human", async () => {
    const d = await draft();
    const other = await newPrincipal("human", [
      "workspace.read",
      "contact.read",
      "outreach.read",
    ]);
    await db.query(
      "update next_actions set assigned_to_principal_id=$1 where id=$2",
      [other.person, d.review_action_id],
    );
    await expect(markSent(d.message_id)).rejects.toThrow(
      "unavailable to this human",
    );
    expect(
      (
        await row("select message_status from outreach_messages where id=$1", [
          d.message_id,
        ])
      ).message_status,
    ).toBe("review");
  });
  it("forward write-disable revokes both RPC entry points while retaining exact readable history", async () => {
    const d = await draft();
    await markSent(d.message_id);
    await db.exec("reset role");
    const sql = await readFile(
      new URL(
        "../../supabase/proposals/outreach/disable_outreach_writes.sql",
        import.meta.url,
      ),
      "utf8",
    );
    // Keep the suite's existing synthetic transaction so afterEach can restore
    // privileges without touching any other test. Statements remain unchanged.
    await db.exec(sql.replace(/^begin;$/m, "").replace(/^commit;$/m, ""));
    await db.exec("set local role authenticated");
    expect(
      (
        await row("select content from outreach_messages where id=$1", [
          d.message_id,
        ])
      ).content,
    ).toBe("Exact synthetic outreach v1");
    await expect(draft()).rejects.toThrow("permission denied");
    await expect(
      attempt(() =>
        db.query("select private.hq_outreach_action($1,$2,'save_contact',$3)", [
          workspace,
          randomUUID(),
          { full_name: "Private bypass", source_system: "candidate" },
        ]),
      ),
    ).rejects.toThrow("permission denied");
  });
  it("cross-workspace authenticated users see no new rows and cannot call the writer", async () => {
    await db.exec("reset role");
    const other = randomUUID();
    await db.query(
      "insert into auth.users values($1,'synthetic-foreign@example.invalid')",
      [other],
    );
    await asUser(other);
    await row(
      "select bootstrap_personal_workspace('Foreign workspace','synthetic-foreign') as id",
    );
    await db.exec("set local role authenticated");
    for (const table of [
      "contacts",
      "opportunity_contacts",
      "outreach_engagements",
      "outreach_engagement_opportunities",
      "outreach_messages",
      "outreach_message_evidence",
      "outreach_interactions",
      "relationship_notes",
      "outreach_task_links",
    ])
      expect((await row(`select count(*)::int as n from ${table}`)).n).toBe(0);
    await expect(
      rpc("save_contact", {
        full_name: "Foreign write",
        source_system: "candidate",
      }),
    ).rejects.toThrow("active workspace");
  });
  it("composite FKs reject foreign contact/company/message references even with owner-maintenance access", async () => {
    await db.exec("reset role");
    const other = (
      await row(
        "insert into workspaces(name,slug) values('Other','other') returning id",
      )
    ).id;
    const foreign = (
      await row(
        "insert into companies(workspace_id,name) values($1,'Other company') returning id",
        [other],
      )
    ).id;
    await expect(
      attempt(() =>
        db.query(
          "insert into contacts(workspace_id,company_id,full_name,source_system,created_by_principal_id,updated_by_principal_id) values($1,$2,'Foreign','candidate',$3,$3)",
          [workspace, foreign, principal],
        ),
      ),
    ).rejects.toThrow("foreign key");
  });
  it("blocks inactive membership and principal", async () => {
    await db.exec("reset role");
    await db.query("update principals set status='suspended' where id=$1", [
      principal,
    ]);
    await db.exec("set local role authenticated");
    expect((await row("select count(*)::int as n from contacts")).n).toBe(0);
    await expect(
      rpc("save_contact", {
        full_name: "Suspended",
        source_system: "candidate",
      }),
    ).rejects.toThrow("active workspace");
  });
  it("blocks inactive workspaces without weakening existing access helpers", async () => {
    await db.query("update workspaces set status='inactive' where id=$1", [
      workspace,
    ]);
    expect((await row("select count(*)::int as n from contacts")).n).toBe(0);
    await expect(
      rpc("save_contact", {
        full_name: "Inactive",
        source_system: "candidate",
      }),
    ).rejects.toThrow("active workspace");
  });
  it("anon cannot read any Outreach table or invoke the RPC", async () => {
    await db.exec("set local role anon");
    await expect(
      attempt(() => db.exec("select * from contacts")),
    ).rejects.toThrow("permission denied");
    await expect(
      rpc("save_contact", { full_name: "Anon", source_system: "candidate" }),
    ).rejects.toThrow("permission denied");
  });
  it("known activity link types retain validation while new targets enforce tenant identity", async () => {
    const e = (
      await row(
        "insert into activity_events(workspace_id,event_type,summary) values($1,'synthetic','Synthetic') returning id",
        [workspace],
      )
    ).id;
    await db.query(
      "insert into activity_event_links(workspace_id,activity_event_id,entity_type,entity_id) values($1,$2,'contact',$3)",
      [workspace, e, contact],
    );
    await expect(
      attempt(() =>
        db.query(
          "insert into activity_event_links(workspace_id,activity_event_id,entity_type,entity_id) values($1,$2,'outreach_message',$3)",
          [workspace, e, randomUUID()],
        ),
      ),
    ).rejects.toThrow("same workspace");
    await expect(
      attempt(() =>
        db.query(
          "insert into activity_event_links(workspace_id,activity_event_id,entity_type,entity_id) values($1,$2,'unsupported',$3)",
          [workspace, e, randomUUID()],
        ),
      ),
    ).rejects.toThrow("Unsupported");
    await expect(
      attempt(() =>
        db.query(
          "insert into activity_event_links(workspace_id,activity_event_id,entity_type,entity_id) values($1,$2,'company',$3)",
          [workspace, e, randomUUID()],
        ),
      ),
    ).rejects.toThrow("same Workspace");
  });
  it("rejects unlinked opportunity, unexpected fields and unbounded payloads", async () => {
    const other = (
      await row(
        "insert into opportunities(workspace_id,company_id,title) values($1,$2,'Unlinked') returning id",
        [workspace, company],
      )
    ).id;
    await expect(draft({ opportunity_id: other })).rejects.toThrow("linked");
    await expect(draft({ sent_by_principal_id: principal })).rejects.toThrow(
      "Unexpected",
    );
    await expect(draft({ content: "x".repeat(41000) })).rejects.toThrow(
      "bounded",
    );
  });
  it("validates safe professional profile URLs and email formatting", async () => {
    for (const value of [
      "javascript:alert(1)",
      "https://linkedin.com.evil.invalid/in/user",
      "https://user@linkedin.com/in/user",
    ])
      await expect(
        rpc("save_contact", {
          full_name: "Invalid URL",
          linkedin_url: value,
          source_system: "candidate",
        }),
      ).rejects.toThrow("check constraint");
    await expect(
      rpc("save_contact", {
        full_name: "Invalid email",
        email: "not-an-email",
        source_system: "candidate",
      }),
    ).rejects.toThrow("check constraint");
  });
  it("catalog checks prove exposed RLS, no raw DML, private definer and fixed search path", async () => {
    await db.exec("reset role");
    const policies = await db.query<Data>(
      "select relname,relrowsecurity from pg_class where relname in ('contacts','opportunity_contacts','outreach_engagements','outreach_engagement_opportunities','outreach_messages','outreach_message_evidence','outreach_interactions','relationship_notes','outreach_task_links')",
    );
    expect(policies.rows).toHaveLength(9);
    expect(policies.rows.every((r) => r.relrowsecurity)).toBe(true);
    expect(
      (
        await row(
          "select has_table_privilege('authenticated','public.outreach_messages','INSERT') as allowed",
        )
      ).allowed,
    ).toBe(false);
    expect(
      (
        await row(
          "select has_function_privilege('anon','public.hq_outreach_action(uuid,uuid,text,jsonb)','EXECUTE') as allowed",
        )
      ).allowed,
    ).toBe(false);
    expect(
      (
        await row(
          "select prosecdef from pg_proc where oid='public.hq_outreach_action(uuid,uuid,text,jsonb)'::regprocedure",
        )
      ).prosecdef,
    ).toBe(false);
    expect(
      (
        await row(
          "select prosecdef,proconfig from pg_proc where oid='private.hq_outreach_action(uuid,uuid,text,jsonb)'::regprocedure",
        )
      ).proconfig,
    ).toEqual(['search_path=""']);
  });
});
