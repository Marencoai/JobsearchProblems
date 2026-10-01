import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { databaseHarness } from "./database-harness";
let db: PGlite, workspace: string, opportunity: string, principal: string;
const user = randomUUID();
type Data = Record<string, unknown>;
async function row(sql: string, args: unknown[] = []) {
  return (await db.query<Data>(sql, args)).rows[0];
}
async function safe(sql: string, args: unknown[] = []) {
  await db.exec("savepoint attempt");
  try {
    const value = await row(sql, args);
    await db.exec("release savepoint attempt");
    return value;
  } catch (e) {
    await db.exec("rollback to savepoint attempt; release savepoint attempt");
    throw e;
  }
}
async function rpc(
  command: string,
  payload: Data,
  id = randomUUID(),
  version?: unknown,
) {
  return safe("select hq_interview_action($1,$2,$3,$4,$5,$6) as result", [
    workspace,
    opportunity,
    version ??
      (
        await row("select updated_at from opportunities where id=$1", [
          opportunity,
        ])
      ).updated_at,
    id,
    command,
    payload,
  ]);
}
const source = () => ({
  verified: true,
  source_system: "synthetic",
  source_reference: randomUUID(),
  interview_type: "Recruiter screen",
  scheduled_start_at: "2026-11-01T12:00:00Z",
  scheduled_end_at: "2026-11-01T12:30:00Z",
});
beforeAll(async () => {
  ({ db } = await databaseHarness());
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/proposals/interview/001_interview.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec("begin");
  await db.query(
    "insert into auth.users(id,email) values($1,'interview@example.invalid')",
    [user],
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
  workspace = (
    await row(
      "select bootstrap_personal_workspace('Interview fixture','interview-fixture') as id",
    )
  ).id as string;
  principal = (await row("select current_principal_id() as id")).id as string;
  await db.exec("set local role authenticated");
  const company = await row(
    "insert into companies(workspace_id,name) values($1,'Synthetic employer') returning id",
    [workspace],
  );
  opportunity = (
    await row(
      "insert into opportunities(workspace_id,company_id,title,opportunity_stage) values($1,$2,'Synthetic interview role','pursuing') returning id",
      [workspace, company.id],
    )
  ).id as string;
});
afterEach(async () => {
  await db.exec("rollback");
});
it("atomically records one process/interview/action/event and replays exact request", async () => {
  const payload = source(),
    id = randomUUID(),
    version = (
      await row("select updated_at from opportunities where id=$1", [
        opportunity,
      ])
    ).updated_at;
  const first = await rpc("record_verified_interview", payload, id, version);
  expect(await rpc("record_verified_interview", payload, id, version)).toEqual(
    first,
  );
  for (const table of [
    "interview_processes",
    "interviews",
    "next_actions",
    "activity_events",
  ])
    expect((await row(`select count(*)::int as n from ${table}`)).n).toBe(1);
  expect(
    (
      await row("select opportunity_stage from opportunities where id=$1", [
        opportunity,
      ])
    ).opportunity_stage,
  ).toBe("interviewing");
  expect(
    (await row("select created_by_principal_id from interviews"))
      .created_by_principal_id,
  ).toBe(principal);
  await expect(
    rpc(
      "record_verified_interview",
      { ...payload, interview_type: "Panel" },
      id,
      version,
    ),
  ).rejects.toThrow("mismatch");
});
it("matches an already linked source without duplicate records", async () => {
  const payload = source();
  await rpc("record_verified_interview", payload);
  expect(
    (await rpc("record_verified_interview", payload)).result,
  ).toMatchObject({ matched: true });
  expect((await row("select count(*)::int as n from interviews")).n).toBe(1);
});
it("rejects unreviewed source, invalid time and non-HTTPS meeting atomically", async () => {
  await expect(
    rpc("record_verified_interview", { ...source(), verified: false }),
  ).rejects.toThrow("Explicit reviewed");
  await expect(
    rpc("record_verified_interview", {
      ...source(),
      scheduled_end_at: "2026-10-01T00:00:00Z",
    }),
  ).rejects.toThrow();
  await expect(
    rpc("record_verified_interview", {
      ...source(),
      meeting_url: "javascript:alert(1)",
    }),
  ).rejects.toThrow();
  expect(
    (await row("select count(*)::int as n from interview_processes")).n,
  ).toBe(0);
  expect(
    (await row("select opportunity_stage from opportunities"))
      .opportunity_stage,
  ).toBe("pursuing");
});
it("starts one draft preparation and preserves linked actions/history", async () => {
  const recorded = (await rpc("record_verified_interview", source()))
    .result as Data;
  const i = await row("select * from interviews where id=$1", [
    recorded.interview_id,
  ]);
  const payload = { interview_id: i.id, interview_updated_at: i.updated_at };
  await rpc("start_prep", payload);
  const updated = await row("select * from interviews where id=$1", [i.id]);
  await rpc("start_prep", {
    ...payload,
    interview_updated_at: updated.updated_at,
  });
  expect(
    (await row("select count(*)::int as n from interview_preparations")).n,
  ).toBe(1);
  expect((await row("select count(*)::int as n from next_actions")).n).toBe(1);
  expect(
    (await row("select preparation_status from interviews")).preparation_status,
  ).toBe("preparing");
});
it("rejects stale interview version and mismatched process/role", async () => {
  await rpc("record_verified_interview", source());
  const i = await row("select * from interviews");
  await expect(
    rpc("start_prep", {
      interview_id: i.id,
      interview_updated_at: "2000-01-01T00:00:00Z",
    }),
  ).rejects.toThrow("Interview changed");
  await expect(
    safe(
      "insert into interviews(workspace_id,opportunity_id,interview_process_id,interview_type,source_system,source_reference) values($1,$2,$3,'Panel','synthetic','foreign')",
      [workspace, randomUUID(), i.interview_process_id],
    ),
  ).rejects.toThrow();
});
it("requires exactly one candidate knowledge reference and scopes references", async () => {
  await rpc("record_verified_interview", source());
  const i = await row("select id from interviews");
  const q = await row(
    "insert into interview_questions(workspace_id,interview_id,question_text,question_source) values($1,$2,'Tell me about a win','predicted') returning id",
    [workspace, i.id],
  );
  await expect(
    safe(
      "insert into interview_question_evidence(workspace_id,interview_question_id) values($1,$2)",
      [workspace, q.id],
    ),
  ).rejects.toThrow();
  await expect(
    safe(
      "insert into interview_question_evidence(workspace_id,interview_question_id,skill_id) values($1,$2,$3)",
      [workspace, q.id, randomUUID()],
    ),
  ).rejects.toThrow();
});
it("denies agent even with Owner role and denies missing permission", async () => {
  await db.exec("reset role");
  await db.query("update principals set principal_type='agent' where id=$1", [
    principal,
  ]);
  await db.exec("set local role authenticated");
  await expect(
    rpc(
      "record_verified_interview",
      source(),
      randomUUID(),
      "2026-10-01T00:00:00Z",
    ),
  ).rejects.toThrow("human");
  await expect(
    safe(
      "insert into interview_processes(workspace_id,opportunity_id) values($1,$2)",
      [workspace, opportunity],
    ),
  ).rejects.toThrow();
  await db.exec("reset role");
  await db.query("update principals set principal_type='human' where id=$1", [
    principal,
  ]);
  await db.exec(
    "delete from role_permissions where permission_id in(select id from permissions where permission_key='interview.manage')",
  );
  await db.exec("set local role authenticated");
  await expect(rpc("record_verified_interview", source())).rejects.toThrow(
    "permission",
  );
});
it("hides records from a second tenant", async () => {
  await rpc("record_verified_interview", source());
  await db.exec("reset role");
  const other = randomUUID();
  await db.query(
    "insert into auth.users(id,email) values($1,'other@example.invalid')",
    [other],
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [other]);
  await row("select bootstrap_personal_workspace('Other','other-interview')");
  await db.exec("set local role authenticated");
  expect((await row("select count(*)::int as n from interviews")).n).toBe(0);
  await expect(
    rpc(
      "record_verified_interview",
      source(),
      randomUUID(),
      "2026-10-01T00:00:00Z",
    ),
  ).rejects.toThrow("human");
});
it("preserves historical preparation and forbids deletes", async () => {
  await rpc("record_verified_interview", source());
  const i = await row("select * from interviews");
  await rpc("start_prep", {
    interview_id: i.id,
    interview_updated_at: i.updated_at,
  });
  await db.exec("update interview_preparations set status='reviewed'");
  await expect(
    safe("update interview_preparations set summary='overwrite' returning id"),
  ).rejects.toThrow("immutable");
  await expect(safe("delete from interviews returning id")).rejects.toThrow();
});

it("saves reviewed preparation atomically, completes only linked action and freezes child questions", async () => {
  await rpc("record_verified_interview", source());
  const i = await row("select * from interviews");
  await rpc("start_prep", {
    interview_id: i.id,
    interview_updated_at: i.updated_at,
  });
  const prep = await row("select * from interview_preparations");
  await row(
    "insert into next_actions(workspace_id,opportunity_id,action_type,title) values($1,$2,'prepare','Unrelated prep')",
    [workspace, opportunity],
  );
  await rpc("save_prep", {
    interview_id: i.id,
    preparation_id: prep.id,
    preparation_updated_at: prep.updated_at,
    summary: "Prepare evidence",
    reviewed: true,
    questions: [
      { question_text: "How did you lead?", question_source: "predicted" },
    ],
  });
  expect(
    (
      await row(
        "select count(*)::int as n from next_actions where status='completed'",
      )
    ).n,
  ).toBe(1);
  expect(
    (
      await row(
        "select count(*)::int as n from next_actions where status='open'",
      )
    ).n,
  ).toBe(1);
  await expect(
    safe("update interview_questions set question_text='rewrite' returning id"),
  ).rejects.toThrow("immutable");
});
it("denies inactive membership and inactive workspace", async () => {
  const version = (await row("select updated_at from opportunities"))
    .updated_at;
  await db.exec("reset role");
  await db
    .query<{
      id: string;
    }>("insert into principals(principal_type,name,status) values('human','Backup fixture','active') returning id")
    .then(async (result) => {
      await db.query(
        "insert into workspace_memberships(workspace_id,principal_id,role_id,status) select $1,$2,role_id,'active' from workspace_memberships where workspace_id=$1 limit 1",
        [workspace, result.rows[0].id],
      );
    });
  await db.query(
    "update workspace_memberships set status='inactive' where workspace_id=$1 and principal_id=public.current_principal_id()",
    [workspace],
  );
  await db.exec("set local role authenticated");
  await expect(
    rpc("record_verified_interview", source(), randomUUID(), version),
  ).rejects.toThrow();
  await db.exec("reset role");
  await db.query(
    "update workspace_memberships set status='active' where workspace_id=$1",
    [workspace],
  );
  await db.query("update workspaces set status='archived' where id=$1", [
    workspace,
  ]);
  await db.exec("set local role authenticated");
  await expect(
    rpc("record_verified_interview", source(), randomUUID(), version),
  ).rejects.toThrow();
});
