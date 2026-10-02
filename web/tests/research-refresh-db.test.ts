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
import type { PGlite } from "@electric-sql/pglite";
import { databaseHarness } from "./database-harness";
import { researchRefreshTarget } from "../../worker-support/research-refresh";
let db: PGlite, w: string, o: string, p: string, version: string;
type Data = Record<string, unknown>;
async function row(sql: string, args: unknown[] = []) {
  return (await db.query<Data>(sql, args)).rows[0];
}
async function rpc(
  request = randomUUID(),
  workspace = w,
  opportunity = o,
  updated = version,
) {
  await db.exec("savepoint request_test");
  try {
    const r = await row(
      "select hq_request_research_refresh($1,$2,$3,$4) as result",
      [workspace, opportunity, updated, request],
    );
    await db.exec("release savepoint request_test");
    return r.result as Data;
  } catch (e) {
    await db.exec(
      "rollback to savepoint request_test; release savepoint request_test",
    );
    throw e;
  }
}
beforeAll(async () => {
  db = (await databaseHarness()).db;
}, 30000);
afterAll(async () => db.close());
beforeEach(async () => {
  await db.exec("begin");
  const user = randomUUID();
  await db.query("insert into auth.users(id) values($1)", [user]);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
  w = (
    await row(
      "select bootstrap_personal_workspace('Synthetic research',$1) as id",
      ["synthetic-" + randomUUID()],
    )
  ).id as string;
  p = (await row("select current_principal_id() as id")).id as string;
  await db.exec("set local role authenticated");
  const c = (
    await row(
      "insert into companies(workspace_id,name) values($1,'Synthetic company') returning id",
      [w],
    )
  ).id;
  const opportunity = await row(
    "insert into opportunities(workspace_id,company_id,title,opportunity_stage) values($1,$2,'Synthetic role','evaluating') returning id,updated_at",
    [w, c],
  );
  o = opportunity.id as string;
  version = opportunity.updated_at as string;
});
afterEach(async () => db.exec("rollback"));
describe("caller-invoker research queue request", () => {
  it("queues one existing-domain task, replays safely and leaves facts/decisions untouched", async () => {
    const evaluation = await row(
      "insert into evaluations(workspace_id,opportunity_id) values($1,$2) returning id",
      [w, o],
    );
    await db.query(
      "update evaluations set candidate_fit_score=80,opportunity_fit_score=80,opportunity_type='mutual_fit',evidence_confidence='high',problem_translation='Synthetic research snapshot',recommended_next_action='pursue',evaluation_status='complete' where id=$1",
      [evaluation.id],
    );
    const evaluationBefore = await row(
      "select row_to_json(e) as value from evaluations e where id=$1",
      [evaluation.id],
    );
    const before = await row(
      "select row_to_json(o) as value from opportunities o where id=$1",
      [o],
    );
    const key = randomUUID(),
      first = await rpc(key);
    expect(await rpc(key)).toEqual(first);
    expect((await rpc()).task_id).toBe(first.task_id);
    expect((await row("select count(*)::int as n from internal_tasks")).n).toBe(
      1,
    );
    expect(
      (await row("select count(*)::int as n from activity_events")).n,
    ).toBe(2);
    expect(
      await row(
        "select row_to_json(o) as value from opportunities o where id=$1",
        [o],
      ),
    ).toEqual(before);
    expect(
      await row(
        "select row_to_json(e) as value from evaluations e where id=$1",
        [evaluation.id],
      ),
    ).toEqual(evaluationBefore);
    expect((await row("select count(*)::int as n from next_actions")).n).toBe(
      0,
    );
    expect(
      (await row("select count(*)::int as n from application_packages")).n,
    ).toBe(0);
    const task = await row("select * from internal_tasks where id=$1", [
        first.task_id,
      ]),
      event = await row("select * from activity_events where id=$1", [
        task.source_activity_event_id,
      ]),
      opp = await row("select * from opportunities where id=$1", [o]);
    expect(
      researchRefreshTarget(task as never, event as never, opp as never),
    ).toMatchObject({
      company_id: opp.company_id,
      authorizes_preparation: false,
      preserve_completed_evaluations: true,
    });
    expect(() =>
      researchRefreshTarget(
        { ...task, workspace_id: randomUUID() } as never,
        event as never,
        opp as never,
      ),
    ).toThrow("mismatch");
  });
  it("reuses blocked work, creates a fresh task only after completion, and preserves events", async () => {
    const first = await rpc();
    await db.query("update internal_tasks set status='blocked' where id=$1", [
      first.task_id,
    ]);
    expect((await rpc()).task_id).toBe(first.task_id);
    await db.query("update internal_tasks set status='completed' where id=$1", [
      first.task_id,
    ]);
    expect((await rpc()).task_id).not.toBe(first.task_id);
    expect((await row("select count(*)::int as n from internal_tasks")).n).toBe(
      2,
    );
  });
  it("rejects foreign/changed/closed roles and changed retry input atomically", async () => {
    await expect(rpc(randomUUID(), randomUUID())).rejects.toThrow();
    await expect(rpc(randomUUID(), w, randomUUID())).rejects.toThrow();
    await expect(
      rpc(randomUUID(), w, o, "2000-01-01T00:00:00Z"),
    ).rejects.toThrow("changed");
    const key = randomUUID();
    await rpc(key);
    await expect(rpc(key, w, randomUUID())).rejects.toThrow("different");
    await db.query(
      "update opportunities set opportunity_stage='closed',closed_reason='withdrawn' where id=$1",
      [o],
    );
    const changed = (
      await row("select updated_at from opportunities where id=$1", [o])
    ).updated_at as string;
    await expect(rpc(randomUUID(), w, o, changed)).rejects.toThrow(
      "no longer active",
    );
  });
  it.each(["inactive", "agent", "anon"])(
    "denies %s caller without queue side effects",
    async (mode) => {
      await db.exec("reset role");
      if (mode === "inactive") {
        const second = randomUUID();
        await db.query("insert into auth.users(id) values($1)", [second]);
        const owner = (
          await row(
            "insert into principals(principal_type,auth_user_id,name,status) values('human',$1,'Synthetic retained Owner','active') returning id",
            [second],
          )
        ).id;
        await db.query(
          "insert into workspace_memberships(workspace_id,principal_id,role_id,status) select workspace_id,$1,role_id,'active' from workspace_memberships where workspace_id=$2 and principal_id=$3",
          [owner, w, p],
        );
        await db.query(
          "update workspace_memberships set status='inactive' where workspace_id=$1 and principal_id=$2",
          [w, p],
        );
      }
      if (mode === "agent")
        await db.query(
          "update principals set principal_type='agent' where id=$1",
          [p],
        );
      await db.exec(
        "set local role " + (mode === "anon" ? "anon" : "authenticated"),
      );
      await expect(rpc()).rejects.toThrow();
      await db.exec("reset role");
      expect(
        (await row("select count(*)::int as n from internal_tasks")).n,
      ).toBe(0);
    },
  );
});
