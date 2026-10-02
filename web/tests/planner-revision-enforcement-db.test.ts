import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
} from "vitest";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { databaseHarness } from "./database-harness";

let db: PGlite;
let workspace: string,
  principal: string,
  opportunity: string,
  evaluation: string,
  decision: string;
const ownerUser = randomUUID();
type Data = Record<string, unknown>;
async function row(sql: string, args: unknown[] = []) {
  return (await db.query<Data>(sql, args)).rows[0];
}
async function checked(sql: string, args: unknown[] = []) {
  await db.exec("savepoint enforcement_check");
  try {
    const result = await db.query<Data>(sql, args);
    await db.exec("release savepoint enforcement_check");
    return result.rows;
  } catch (error) {
    await db.exec(
      "rollback to savepoint enforcement_check; release savepoint enforcement_check",
    );
    throw error;
  }
}
async function command(name: string, payload: Data) {
  const version = (
    await row("select updated_at from opportunities where id=$1", [opportunity])
  ).updated_at;
  return (
    await checked("select hq_human_action($1,$2,$3,$4,$5,$6) as result", [
      workspace,
      opportunity,
      version,
      randomUUID(),
      name,
      payload,
    ])
  )[0].result as Data;
}
async function pursue() {
  return command("pursue", {
    action_id: decision,
    action_updated_at: (
      await row("select updated_at from next_actions where id=$1", [decision])
    ).updated_at,
  });
}
async function target(task: unknown) {
  return (
    await checked("select hq_preparation_target($1,$2) as result", [
      workspace,
      task,
    ])
  )[0].result as Data;
}
async function inputs(plan: unknown = null) {
  return (
    await checked("select hq_planner_inputs($1,$2) as result", [
      workspace,
      plan,
    ])
  )[0].result as Data;
}
async function planFixture() {
  const plan = await row(
    "insert into daily_plans(workspace_id,plan_date) values($1,current_date) returning id",
    [workspace],
  );
  const item = await row(
    "insert into daily_plan_items(workspace_id,daily_plan_id,next_action_id,display_order) values($1,$2,$3,1) returning id",
    [workspace, plan.id, decision],
  );
  return { plan, item };
}
async function managedFixture() {
  const pursuit = await pursue();
  const handoff = await target(pursuit.task_id);
  return { task: pursuit.task_id, pkg: handoff.package_id };
}
async function material(pkg: unknown) {
  const binding = (
    await row(
      "select hq_preparation_task_id from application_packages where id=$1",
      [pkg],
    )
  ).hq_preparation_task_id;
  return (
    await checked(
      "insert into application_materials(workspace_id,application_package_id,material_type,content_text,hq_preparation_task_id) values($1,$2,'resume','Synthetic evidence',$3) returning id",
      [workspace, pkg, binding],
    )
  )[0];
}
async function revise(pkg: unknown) {
  return command("request_changes", {
    package_id: pkg,
    package_updated_at: (
      await row("select updated_at from application_packages where id=$1", [
        pkg,
      ])
    ).updated_at,
    notes: "Use verified evidence only",
  });
}
async function agent() {
  await db.exec("reset role");
  const user = randomUUID();
  await db.query(
    "insert into auth.users(id,email) values($1,'synthetic-agent@example.invalid')",
    [user],
  );
  const agent = await row(
    "insert into principals(principal_type,auth_user_id,name) values('agent',$1,'Synthetic preparer') returning id",
    [user],
  );
  const role = await row(
    "insert into roles(workspace_id,name) values($1,'Synthetic prepare-only') returning id",
    [workspace],
  );
  await db.query(
    "insert into role_permissions(role_id,permission_id) select $1,id from permissions where permission_key in ('workspace.read','company.read','job_family.read','opportunity.read','opportunity_source.read','company_intelligence.read','candidate_knowledge.read','settings.read','evaluation.read','application_gap.read','application.read','application.prepare')",
    [role.id],
  );
  await db.query(
    "insert into workspace_memberships(workspace_id,principal_id,role_id) values($1,$2,$3)",
    [workspace, agent.id, role.id],
  );
  expect(
    (
      await row(
        "select count(*)::int as n from role_permissions where role_id=$1",
        [role.id],
      )
    ).n,
  ).toBe(12);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
  await db.exec("set local role authenticated");
}
beforeAll(async () => {
  db = (await databaseHarness()).db;
}, 20000);
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec("begin");
  await db.query(
    "insert into auth.users(id,email) values($1,'synthetic-owner@example.invalid')",
    [ownerUser],
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
    ownerUser,
  ]);
  workspace = (
    await row(
      "select bootstrap_personal_workspace('Enforcement tests','synthetic-enforcement') as id",
    )
  ).id as string;
  principal = (await row("select current_principal_id() as id")).id as string;
  await db.exec("set local role authenticated");
  const company = await row(
    "insert into companies(workspace_id,name) values($1,'Synthetic company') returning id",
    [workspace],
  );
  opportunity = (
    await row(
      "insert into opportunities(workspace_id,company_id,title,opportunity_stage) values($1,$2,'Synthetic role','evaluating') returning id",
      [workspace, company.id],
    )
  ).id as string;
  evaluation = (
    await row(
      "insert into evaluations(workspace_id,opportunity_id) values($1,$2) returning id",
      [workspace, opportunity],
    )
  ).id as string;
  await db.query(
    "update evaluations set candidate_fit_score=90,opportunity_fit_score=80,opportunity_type='mutual_fit',evidence_confidence='high',problem_translation='Synthetic evidence',recommended_next_action='pursue',evaluation_status='complete' where id=$1",
    [evaluation],
  );
  decision = (
    await row(
      "insert into next_actions(workspace_id,opportunity_id,assigned_to_principal_id,action_type,title) values($1,$2,$3,'decide','Synthetic decision') returning id",
      [workspace, opportunity, principal],
    )
  ).id as string;
});
afterEach(async () => {
  await db.exec("rollback");
});

describe("database planner enforcement", () => {
  it("rechecks One Thing eligibility while preserving its historical pointer", async () => {
    const { plan, item } = await planFixture();
    await db.query(
      "update daily_plans set todays_one_thing_action_id=$1,status='active' where id=$2",
      [decision, plan.id],
    );
    await db.query(
      "update next_actions set todays_one_thing_eligible=false where id=$1",
      [decision],
    );
    const result = await inputs(plan.id);
    expect(result.one_thing_action_id).toBe(null);
    expect(result.delivery_item_ids).toEqual([item.id]);
    expect(
      (
        await row(
          "select todays_one_thing_action_id from daily_plans where id=$1",
          [plan.id],
        )
      ).todays_one_thing_action_id,
    ).toBe(decision);
  });
  it("uses Workspace Owner authority and keeps every open action for deduplication", async () => {
    await db.exec("reset role");
    const other = await row(
      "insert into principals(principal_type,name) values('human','Synthetic coach') returning id",
    );
    // Foreign-assigned action is scoped and still participates in deduplication.
    await db.query(
      "insert into workspace_memberships(workspace_id,principal_id,role_id) select $1,$2,role_id from workspace_memberships where workspace_id=$1 and principal_id=$3",
      [workspace, other.id, principal],
    );
    // Avoid a second Owner: existing scoped read role suffices for assignment.
    const role = await row(
      "insert into roles(workspace_id,name) values($1,'Synthetic collaborator') returning id",
      [workspace],
    );
    await db.query(
      "update workspace_memberships set role_id=$1 where workspace_id=$2 and principal_id=$3",
      [role.id, workspace, other.id],
    );
    await db.exec("set local role authenticated");
    const assigned = await row(
      "insert into next_actions(workspace_id,opportunity_id,assigned_to_principal_id,action_type,title) values($1,$2,$3,'review','Coach work') returning id",
      [workspace, opportunity, other.id],
    );
    await db.query(
      "update next_actions set available_after=clock_timestamp()+interval '1 hour' where id=$1",
      [decision],
    );
    const result = await inputs();
    expect(result.candidate_principal_id).toBe(principal);
    expect(result.deduplication_action_ids).toEqual(
      expect.arrayContaining([decision, assigned.id]),
    );
    expect(result.eligible_action_ids).toEqual([]);
  });
  it("fails closed when existing Workspace candidate authority is ambiguous", async () => {
    await db.exec("reset role");
    const other = await row(
      "insert into principals(principal_type,name) values('human','Second synthetic Owner') returning id",
    );
    await db.query(
      "insert into workspace_memberships(workspace_id,principal_id,role_id) select $1,$2,role_id from workspace_memberships where workspace_id=$1 and principal_id=$3",
      [workspace, other.id, principal],
    );
    await db.exec("set local role authenticated");
    await expect(inputs()).rejects.toThrow("ambiguous");
    const plan = await row(
      "insert into daily_plans(workspace_id,plan_date) values($1,current_date) returning id",
      [workspace],
    );
    await expect(
      checked(
        "insert into daily_plan_items(workspace_id,daily_plan_id,next_action_id,display_order) values($1,$2,$3,1)",
        [workspace, plan.id, decision],
      ),
    ).rejects.toThrow("ambiguous");
  });
  it("supports read-only planner permissions without granting Next Action updates", async () => {
    await db.exec("reset role");
    await db.query(
      "delete from role_permissions where role_id in (select role_id from workspace_memberships where workspace_id=$1 and principal_id=$2) and permission_id in (select id from permissions where permission_key in ('next_action.update','next_action.complete'))",
      [workspace, principal],
    );
    await db.exec("set local role authenticated");
    expect(
      (
        await row("select has_permission($1,'next_action.update') as allowed", [
          workspace,
        ])
      ).allowed,
    ).toBe(false);
    expect((await inputs()).eligible_action_ids).toEqual([decision]);
    expect(
      await checked(
        "update next_actions set available_after=clock_timestamp()+interval '1 hour' where id=$1 returning id",
        [decision],
      ),
    ).toEqual([]);
  });
  it("includes the same action exactly at the database deferral boundary", async () => {
    await db.query(
      "update next_actions set available_after=clock_timestamp() where id=$1",
      [decision],
    );
    expect((await inputs()).eligible_action_ids).toEqual([decision]);
    await planFixture();
  });
  it("rejects invalid infinite deferral values", async () => {
    await db.query(
      "update next_actions set available_after='infinity' where id=$1",
      [decision],
    );
    await expect(inputs()).rejects.toThrow("Invalid deferral");
  });
  it("rejects future-deferred raw Plan Item insertion without changing the action", async () => {
    const plan = await row(
      "insert into daily_plans(workspace_id,plan_date) values($1,current_date) returning id",
      [workspace],
    );
    await db.query(
      "update next_actions set available_after=clock_timestamp()+interval '1 hour' where id=$1",
      [decision],
    );
    await expect(
      checked(
        "insert into daily_plan_items(workspace_id,daily_plan_id,next_action_id,display_order) values($1,$2,$3,1)",
        [workspace, plan.id, decision],
      ),
    ).rejects.toThrow("candidate-eligible");
    expect(
      (await row("select count(*)::int as n from daily_plan_items")).n,
    ).toBe(0);
    expect(
      (await row("select status from next_actions where id=$1", [decision]))
        .status,
    ).toBe("open");
  });
  it("rejects new One Thing and draft activation after later deferral", async () => {
    const { plan } = await planFixture();
    await db.query(
      "update next_actions set available_after=clock_timestamp()+interval '1 hour' where id=$1",
      [decision],
    );
    await expect(
      checked(
        "update daily_plans set todays_one_thing_action_id=$1 where id=$2",
        [decision, plan.id],
      ),
    ).rejects.toThrow("candidate-eligible");
    await expect(
      checked("update daily_plans set status='active' where id=$1", [plan.id]),
    ).rejects.toThrow("candidate-eligible");
    expect(
      (
        await row(
          "select status,todays_one_thing_action_id from daily_plans where id=$1",
          [plan.id],
        )
      ).status,
    ).toBe("draft");
  });
  it("preserves historical selections and completion while revalidating delivery", async () => {
    const { plan, item } = await planFixture();
    await db.query(
      "update daily_plans set todays_one_thing_action_id=$1,status='active' where id=$2",
      [decision, plan.id],
    );
    const before = await row(
      "select action_snapshot from daily_plan_items where id=$1",
      [item.id],
    );
    expect((await inputs(plan.id)).delivery_item_ids).toEqual([item.id]);
    await db.query(
      "update next_actions set available_after=clock_timestamp()+interval '1 hour' where id=$1",
      [decision],
    );
    const report = await inputs(plan.id);
    expect(report.delivery_item_ids).toEqual([]);
    expect(report.one_thing_action_id).toBe(null);
    await db.query(
      "update daily_plan_items set completion_status='carried_forward' where id=$1",
      [item.id],
    );
    await db.query(
      "update daily_plans set status='completed',grade='A',score=100 where id=$1",
      [plan.id],
    );
    expect(
      (
        await row(
          "select todays_one_thing_action_id from daily_plans where id=$1",
          [plan.id],
        )
      ).todays_one_thing_action_id,
    ).toBe(decision);
    expect(
      await row("select action_snapshot from daily_plan_items where id=$1", [
        item.id,
      ]),
    ).toEqual(before);
  });
  it("rejects foreign workspace and unclaimed authenticated contexts", async () => {
    await expect(
      checked("select hq_planner_inputs($1,null)", [randomUUID()]),
    ).rejects.toThrow("workspace authority");
    await db.query("select set_config('request.jwt.claim.sub','',true)");
    await expect(inputs()).rejects.toThrow("workspace authority");
  });
});

describe("structured preparation binding and direct writes", () => {
  it.each(["trigger_type", "trigger_reference"])(
    "rejects missing %s as candidate authority in handoff and raw binding",
    async (field) => {
      const pursuit = await pursue();
      // Whitelisted column names only; this is a synthetic local fixture.
      await db.query(`update internal_tasks set ${field}=null where id=$1`, [
        pursuit.task_id,
      ]);
      await expect(target(pursuit.task_id)).rejects.toThrow(
        "Explicit candidate",
      );
      const pkg = await row(
        "insert into application_packages(workspace_id,opportunity_id,evaluation_id) values($1,$2,$3) returning id",
        [workspace, opportunity, evaluation],
      );
      await expect(
        checked(
          "update application_packages set hq_preparation_task_id=$1 where id=$2",
          [pursuit.task_id, pkg.id],
        ),
      ).rejects.toThrow("Valid candidate");
      expect(
        (
          await row(
            "select hq_preparation_task_id from application_packages where id=$1",
            [pkg.id],
          )
        ).hq_preparation_task_id,
      ).toBe(null);
    },
  );
  it("creates and binds an initial Package once through explicit Owner handoff", async () => {
    const pursuit = await pursue();
    const first = await target(pursuit.task_id);
    expect(await target(pursuit.task_id)).toEqual(first);
    expect(first.disposition).toBe("prepare");
    expect(
      (await row("select count(*)::int as n from application_packages")).n,
    ).toBe(1);
    expect(
      (
        await row(
          "select hq_preparation_task_id from application_packages where id=$1",
          [first.package_id],
        )
      ).hq_preparation_task_id,
    ).toBe(pursuit.task_id);
  });
  it("binds each exact revision atomically and does not parse task descriptions", async () => {
    const first = await managedFixture();
    const revision = await revise(first.pkg);
    await db.query(
      "update internal_tasks set description='Misleading free text',title='Renamed task' where id=$1",
      [revision.task_id],
    );
    expect((await target(revision.task_id)).package_id).toBe(
      revision.package_id,
    );
    expect(
      (
        await row(
          "select hq_preparation_task_id from application_packages where id=$1",
          [revision.package_id],
        )
      ).hq_preparation_task_id,
    ).toBe(revision.task_id);
    await expect(material(first.pkg)).rejects.toThrow("Exact current bound");
  });
  it("preserves immutable binding and bound Task authority", async () => {
    const f = await managedFixture();
    await expect(
      checked(
        "update application_packages set hq_preparation_task_id=null where id=$1",
        [f.pkg],
      ),
    ).rejects.toThrow("immutable");
    await expect(
      checked(
        "update internal_tasks set trigger_reference='changed' where id=$1",
        [f.task],
      ),
    ).rejects.toThrow("immutable");
    await expect(
      checked(
        "update application_packages set hq_preparation_task_id=$1 where id=$2",
        [randomUUID(), f.pkg],
      ),
    ).rejects.toThrow("immutable");
  });
  it("requires the exact Task ID on every new managed Material, not only a valid accessible Package", async () => {
    const f = await managedFixture();
    await expect(
      checked(
        "insert into application_materials(workspace_id,application_package_id,material_type,content_text) values($1,$2,'resume','Missing task')",
        [workspace, f.pkg],
      ),
    ).rejects.toThrow("Task ID must accompany");
    await expect(
      checked(
        "insert into application_materials(workspace_id,application_package_id,material_type,content_text,hq_preparation_task_id) values($1,$2,'resume','Wrong task',$3)",
        [workspace, f.pkg, randomUUID()],
      ),
    ).rejects.toThrow("Task ID must accompany");
    const m = await material(f.pkg);
    await expect(
      checked(
        "update application_materials set hq_preparation_task_id=null where id=$1",
        [m.id],
      ),
    ).rejects.toThrow("immutable");
    expect(
      (await row("select count(*)::int as n from application_materials")).n,
    ).toBe(1);
  });
  it("revalidates explicit readiness Task/Package/version under the narrow agent's permissions", async () => {
    const f = await managedFixture();
    await agent();
    await db.query(
      "update application_packages set status='preparing' where id=$1",
      [f.pkg],
    );
    const version = (
      await row("select updated_at from application_packages where id=$1", [
        f.pkg,
      ])
    ).updated_at;
    await expect(
      checked("select hq_preparation_ready($1,$2,$3,$4)", [
        workspace,
        randomUUID(),
        f.pkg,
        version,
      ]),
    ).rejects.toThrow("Task and Package pair");
    await expect(
      checked("select hq_preparation_ready($1,$2,$3,$4)", [
        workspace,
        f.task,
        f.pkg,
        new Date(0),
      ]),
    ).rejects.toThrow("reviewed preparation target");
    const ready = await checked(
      "select hq_preparation_ready($1,$2,$3,$4) as result",
      [workspace, f.task, f.pkg, version],
    );
    expect(ready[0].result).toEqual({
      package_id: f.pkg,
      task_id: f.task,
      status: "ready_for_review",
    });
    expect(
      (
        await row("select status from application_packages where id=$1", [
          f.pkg,
        ])
      ).status,
    ).toBe("ready_for_review");
    expect((await db.query("select id from internal_tasks")).rows).toEqual([]);
  });
  it("allows exactly the existing twelve-permission preparer without Task visibility", async () => {
    const f = await managedFixture();
    await agent();
    expect((await db.query("select id from internal_tasks")).rows).toEqual([]);
    await expect(target(f.task)).rejects.toThrow("handoff authority");
    await expect(
      checked("select private.hq_assert_preparation_target($1,$2,$3,false)", [
        workspace,
        opportunity,
        f.pkg,
      ]),
    ).rejects.toThrow("permission denied");
    await db.query(
      "update application_packages set status='preparing' where id=$1",
      [f.pkg],
    );
    const m = await material(f.pkg);
    await db.query(
      "update application_materials set status='candidate_review' where id=$1",
      [m.id],
    );
    await db.query(
      "update application_packages set status='ready_for_review' where id=$1",
      [f.pkg],
    );
    await expect(
      checked("update application_packages set status='approved' where id=$1", [
        f.pkg,
      ]),
    ).rejects.toThrow("application.approve");
    await expect(
      checked(
        "update application_packages set status='preparing' where id=$1",
        [f.pkg],
      ),
    ).rejects.toThrow("Exact current bound");
    await expect(
      checked("update application_packages set status='archived' where id=$1", [
        f.pkg,
      ]),
    ).rejects.toThrow("Exact current bound");
  });
  it("denies agent unbound decoy creation and preparation on an Owner-created decoy", async () => {
    const f = await managedFixture();
    const decoy = await row(
      "insert into application_packages(workspace_id,opportunity_id,evaluation_id) values($1,$2,$3) returning id",
      [workspace, opportunity, evaluation],
    );
    await agent();
    await expect(
      checked(
        "insert into application_packages(workspace_id,opportunity_id,evaluation_id) values($1,$2,$3)",
        [workspace, opportunity, evaluation],
      ),
    ).rejects.toThrow("Unbound managed");
    await expect(
      checked(
        "insert into application_materials(workspace_id,application_package_id,material_type,content_text) values($1,$2,'resume','Wrong target')",
        [workspace, decoy.id],
      ),
    ).rejects.toThrow("Exact current bound");
    await expect(
      checked(
        "update application_packages set status='preparing' where id=$1",
        [decoy.id],
      ),
    ).rejects.toThrow("Exact current bound");
    await expect(
      checked(
        "update application_packages set status='preparing' where id=$1",
        [f.pkg],
      ),
    ).rejects.toThrow("Exact current bound");
  });
  it("rejects stale Material lifecycle and current-version switches after successive revision", async () => {
    const f = await managedFixture();
    const m = await material(f.pkg);
    const revision = await revise(f.pkg);
    await agent();
    await expect(
      checked(
        "update application_materials set status='candidate_review' where id=$1",
        [m.id],
      ),
    ).rejects.toThrow("Exact current bound");
    await expect(
      checked(
        "update application_materials set is_current_package_version=false where id=$1",
        [m.id],
      ),
    ).rejects.toThrow("Exact current bound");
    await expect(
      checked(
        "update application_materials set status='archived' where id=$1",
        [m.id],
      ),
    ).rejects.toThrow("Exact current bound");
    await expect(
      checked(
        "update application_packages set status='preparing' where id=$1",
        [f.pkg],
      ),
    ).rejects.toThrow("Exact current bound");
    const next = await material(revision.package_id);
    expect(next.id).toBeTruthy();
  });
  it("allows existing human archival authority and rejects resurrection of terminal current flags", async () => {
    const f = await managedFixture();
    const m = await material(f.pkg);
    await revise(f.pkg);
    await db.query(
      "update application_materials set status='archived' where id=$1",
      [m.id],
    );
    await expect(
      checked(
        "update application_materials set is_current_package_version=true where id=$1",
        [m.id],
      ),
    ).rejects.toThrow("Exact current bound");
  });
  it("reuses ready and approved results without regenerating or changing approved history", async () => {
    const f = await managedFixture();
    const m = await material(f.pkg);
    await db.query(
      "update application_packages set status='preparing' where id=$1",
      [f.pkg],
    );
    await db.query(
      "update application_materials set status='candidate_review' where id=$1",
      [m.id],
    );
    await db.query(
      "update application_packages set status='ready_for_review' where id=$1",
      [f.pkg],
    );
    expect((await target(f.task)).disposition).toBe("reuse");
    await command("approve_package", {
      package_id: f.pkg,
      package_updated_at: (
        await row("select updated_at from application_packages where id=$1", [
          f.pkg,
        ])
      ).updated_at,
      material_ids: [m.id],
    });
    const before = await row(
      "select to_jsonb(p) as value from application_packages p where id=$1",
      [f.pkg],
    );
    expect((await target(f.task)).disposition).toBe("reuse");
    await revise(f.pkg);
    expect(
      await row(
        "select to_jsonb(p) as value from application_packages p where id=$1",
        [f.pkg],
      ),
    ).toEqual(before);
    expect(
      (
        await row("select status from application_materials where id=$1", [
          m.id,
        ])
      ).status,
    ).toBe("approved");
  });
  it("preserves the unclassified legacy initial direct creation flow", async () => {
    await pursue();
    const pkg = await row(
      "insert into application_packages(workspace_id,opportunity_id,evaluation_id) values($1,$2,$3) returning id",
      [workspace, opportunity, evaluation],
    );
    await agent();
    await material(pkg.id);
    await db.query(
      "update application_packages set status='preparing' where id=$1",
      [pkg.id],
    );
    await db.query(
      "update application_packages set status='ready_for_review' where id=$1",
      [pkg.id],
    );
  });
  it("fails closed on unclassified legacy work regardless of its mutable description/title", async () => {
    await pursue();
    const task = await row(
      "insert into internal_tasks(workspace_id,opportunity_id,task_type,domain,title,status,trigger_type,trigger_reference) values($1,$2,'prepare_application_package','application','Arbitrary title','ready','candidate_action','candidate_decided_to_pursue') returning id",
      [workspace, opportunity],
    );
    await expect(target(task.id)).rejects.toThrow("Unclassified legacy");
    expect(
      (await row("select count(*)::int as n from application_packages")).n,
    ).toBe(0);
  });
  it("rejects foreign and archived targets without exposing Task information", async () => {
    const f = await managedFixture();
    await expect(
      checked("select hq_preparation_target($1,$2)", [randomUUID(), f.task]),
    ).rejects.toThrow("handoff authority");
    await db.query(
      "update application_packages set status='archived' where id=$1",
      [f.pkg],
    );
    await expect(target(f.task)).rejects.toThrow("Exact latest");
    await expect(
      checked(
        "insert into application_materials(workspace_id,application_package_id,material_type,content_text) values($1,$2,'resume','Archived')",
        [workspace, f.pkg],
      ),
    ).rejects.toThrow();
  });
  it("exposes only reviewed function ACLs and keeps trigger lookups uncallable", async () => {
    const acl = await row(
      "select has_function_privilege('anon','public.hq_planner_inputs(uuid,uuid)','EXECUTE') as anon_planner,has_function_privilege('authenticated','public.hq_preparation_target(uuid,uuid)','EXECUTE') as handoff,has_function_privilege('authenticated','private.hq_workspace_candidate(uuid)','EXECUTE') as candidate,has_function_privilege('authenticated','private.hq_assert_preparation_target(uuid,uuid,uuid,boolean)','EXECUTE') as task_lookup",
    );
    expect(acl).toEqual({
      anon_planner: false,
      handoff: true,
      candidate: false,
      task_lookup: false,
    });
  });
  it("preserves completed preparation retry without reopening its reviewed Package", async () => {
    const f = await managedFixture();
    await material(f.pkg);
    await db.query(
      "update application_packages set status='preparing' where id=$1",
      [f.pkg],
    );
    await db.query(
      "update application_packages set status='ready_for_review' where id=$1",
      [f.pkg],
    );
    await db.query("update internal_tasks set status='running' where id=$1", [
      f.task,
    ]);
    await db.query("update internal_tasks set status='completed' where id=$1", [
      f.task,
    ]);
    expect((await target(f.task)).disposition).toBe("reuse");
    expect(
      (await row("select count(*)::int as n from application_packages")).n,
    ).toBe(1);
    await expect(
      checked(
        "update application_packages set status='preparing' where id=$1",
        [f.pkg],
      ),
    ).rejects.toThrow("Exact current bound");
  });
});
