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
  decision: string,
  evaluation: string;
const ownerUser = randomUUID();
type Data = Record<string, unknown>;
async function row(sql: string, args: unknown[] = []): Promise<Data> {
  return (await db.query<Data>(sql, args)).rows[0];
}
async function rpc(
  command: string,
  payload: Data,
  request = randomUUID(),
  version?: unknown,
) {
  const updated =
    version ??
    (
      await row("select updated_at from opportunities where id=$1", [
        opportunity,
      ])
    ).updated_at;
  // Savepoints let adversarial failures be inspected without discarding fixture
  // state. PostgreSQL still rolls back every statement in the failed function.
  await db.exec("savepoint action_test");
  try {
    const result = await row(
      "select public.hq_human_action($1,$2,$3,$4,$5,$6) as result",
      [workspace, opportunity, updated, request, command, payload],
    );
    await db.exec("release savepoint action_test");
    return result.result as Data;
  } catch (error) {
    await db.exec(
      "rollback to savepoint action_test; release savepoint action_test",
    );
    throw error;
  }
}
async function decisionPayload(extra: Data = {}): Promise<Data> {
  const action = await row("select updated_at from next_actions where id=$1", [
    decision,
  ]);
  return {
    action_id: decision,
    action_updated_at: action.updated_at,
    ...extra,
  };
}
async function packageFixture() {
  await rpc("pursue", await decisionPayload());
  const pkg = await row(
    "insert into application_packages(workspace_id,opportunity_id,evaluation_id) values($1,$2,$3) returning id",
    [workspace, opportunity, evaluation],
  );
  const material = await row(
    "insert into application_materials(workspace_id,application_package_id,material_type,content_text) values($1,$2,'resume','Original resume v1') returning id",
    [workspace, pkg.id],
  );
  await db.query(
    "update application_packages set status='preparing' where id=$1",
    [pkg.id],
  );
  await db.query(
    "update application_materials set status='candidate_review' where id=$1",
    [material.id],
  );
  await db.query(
    "update application_packages set status='ready_for_review' where id=$1",
    [pkg.id],
  );
  const task = await row(
    "insert into internal_tasks(workspace_id,opportunity_id,task_type,domain,title) values($1,$2,'prepare_application_package','application','Prepare') returning id",
    [workspace, opportunity],
  );
  await db.query(
    "insert into next_actions(workspace_id,opportunity_id,internal_task_id,action_type,title) values($1,$2,$3,'approve','Review package')",
    [workspace, opportunity, task.id],
  );
  const payload = {
    package_id: pkg.id,
    package_updated_at: (
      await row("select updated_at from application_packages where id=$1", [
        pkg.id,
      ])
    ).updated_at,
    material_ids: [material.id],
  };
  return { pkg, material, payload };
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
      "select public.bootstrap_personal_workspace('Synthetic HQ','synthetic-hq') as id",
    )
  ).id as string;
  principal = (await row("select public.current_principal_id() as id"))
    .id as string;
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
    "update evaluations set candidate_fit_score=89, opportunity_fit_score=76, opportunity_type='mutual_fit', evidence_confidence='high', problem_translation='Solve the employer need', recommended_next_action='pursue', evaluation_status='complete' where id=$1",
    [evaluation],
  );
  decision = (
    await row(
      "insert into next_actions(workspace_id,opportunity_id,assigned_to_principal_id,action_type,title) values($1,$2,$3,'decide','Decide whether to pursue') returning id",
      [workspace, opportunity, principal],
    )
  ).id as string;
});
afterEach(async () => {
  await db.exec("rollback");
});

describe("human transactions against real migration policies and triggers", () => {
  it("pursues once and replays the same request without duplicate work/history", async () => {
    const version = (
      await row("select updated_at from opportunities where id=$1", [
        opportunity,
      ])
    ).updated_at;
    const payload = await decisionPayload(),
      id = randomUUID();
    const first = await rpc("pursue", payload, id, version);
    expect(await rpc("pursue", payload, id, version)).toEqual(first);
    expect(
      (
        await row("select opportunity_stage from opportunities where id=$1", [
          opportunity,
        ])
      ).opportunity_stage,
    ).toBe("pursuing");
    expect(
      (await row("select status from next_actions where id=$1", [decision]))
        .status,
    ).toBe("completed");
    expect(
      (await row("select count(*)::int as count from internal_tasks")).count,
    ).toBe(1);
    expect(
      (await row("select count(*)::int as count from activity_events")).count,
    ).toBe(1);
    expect(
      await row(
        "select domain,trigger_type,trigger_reference from internal_tasks where id=$1",
        [first.task_id],
      ),
    ).toEqual({
      domain: "application",
      trigger_type: "candidate_action",
      trigger_reference: "candidate_decided_to_pursue",
    });
    await expect(rpc("pursue", payload)).rejects.toThrow(
      "eligible candidate decision",
    );
  });
  it("rejects reusing a request ID for a different action or payload", async () => {
    const id = randomUUID(),
      payload = await decisionPayload();
    await rpc("pursue", payload, id);
    await expect(
      rpc("pass", { ...payload, reason: "changed" }, id),
    ).rejects.toThrow("different input");
  });
  it("requires explicit current candidate decision rather than a score", async () => {
    await expect(
      rpc("pursue", { action_id: randomUUID(), action_updated_at: new Date() }),
    ).rejects.toThrow("eligible candidate decision");
    expect(
      (await row("select count(*)::int as count from internal_tasks")).count,
    ).toBe(0);
  });
  it("rejects stale opportunity and stale action reviews", async () => {
    await expect(
      rpc("pursue", await decisionPayload(), randomUUID(), new Date(0)),
    ).rejects.toThrow("opportunity changed");
    await expect(
      rpc("pursue", await decisionPayload({ action_updated_at: new Date(0) })),
    ).rejects.toThrow("decision changed");
  });
  it("preserves the pass reason, evaluation, and close semantics", async () => {
    await rpc(
      "pass",
      await decisionPayload({ reason: "Location does not fit" }),
    );
    expect(
      await row(
        "select opportunity_stage,closed_reason,is_currently_active from opportunities where id=$1",
        [opportunity],
      ),
    ).toEqual({
      opportunity_stage: "closed",
      closed_reason: "withdrawn",
      is_currently_active: false,
    });
    expect(
      (
        await row(
          "select details::jsonb->'request'->'payload'->>'reason' as reason from activity_events",
        )
      ).reason,
    ).toBe("Location does not fit");
    expect(
      (await row("select count(*)::int as count from evaluations")).count,
    ).toBe(1);
  });
  it("defers the human action without pursuit, preparation, or a new lifecycle state", async () => {
    await rpc(
      "defer",
      await decisionPayload({
        available_after: new Date(Date.now() + 86400000).toISOString(),
      }),
    );
    expect(
      await row(
        "select status,available_after > now() as deferred from next_actions where id=$1",
        [decision],
      ),
    ).toEqual({ status: "open", deferred: true });
    expect(
      (
        await row("select opportunity_stage from opportunities where id=$1", [
          opportunity,
        ])
      ).opportunity_stage,
    ).toBe("evaluating");
    expect(
      (await row("select count(*)::int as count from internal_tasks")).count,
    ).toBe(0);
  });
  it("denies an agent even if mistakenly assigned Owner permissions", async () => {
    await db.exec("reset role");
    await db.query("update principals set principal_type='agent' where id=$1", [
      principal,
    ]);
    await db.exec("set local role authenticated");
    await expect(rpc("pursue", await decisionPayload())).rejects.toThrow(
      "workspace human",
    );
  });
  it("denies cross-workspace and inactive membership access", async () => {
    const real = workspace;
    workspace = randomUUID();
    await expect(rpc("pursue", await decisionPayload())).rejects.toThrow(
      "workspace human",
    );
    workspace = real;
    await db.exec("reset role");
    const backup = await row(
      "insert into principals(principal_type,name) values('human','Synthetic backup owner') returning id",
    );
    await db.query(
      "insert into workspace_memberships(workspace_id,principal_id,role_id) select $1,$2,role_id from workspace_memberships where principal_id=$3",
      [workspace, backup.id, principal],
    );
    await db.query(
      "update workspace_memberships set status='inactive' where principal_id=$1",
      [principal],
    );
    await db.exec("set local role authenticated");
    await expect(rpc("pursue", {}, randomUUID(), new Date())).rejects.toThrow(
      "workspace human",
    );
  });
  it("keeps anonymous execution revoked and RPC security invoker", async () => {
    expect(
      await row(
        "select has_function_privilege('anon','public.hq_human_action(uuid,uuid,timestamptz,uuid,text,jsonb)','EXECUTE') as anon, (select prosecdef from pg_proc where proname='hq_human_action') as definer",
      ),
    ).toEqual({ anon: false, definer: false });
  });
  it("denies an inactive workspace even with an active Owner membership", async () => {
    await db.exec("reset role");
    await db.query("update workspaces set status='archived' where id=$1", [
      workspace,
    ]);
    await db.exec("set local role authenticated");
    await expect(rpc("pursue", {}, randomUUID(), new Date())).rejects.toThrow(
      "active workspace",
    );
  });
  it("denies a human missing one existing action permission without partial writes", async () => {
    await db.exec("reset role");
    await db.exec(
      "delete from role_permissions where permission_id in (select id from permissions where permission_key='internal_task.create')",
    );
    await db.exec("set local role authenticated");
    await expect(rpc("pursue", await decisionPayload())).rejects.toThrow(
      "permission is missing",
    );
    expect(
      (await row("select status from next_actions where id=$1", [decision]))
        .status,
    ).toBe("open");
    expect(
      (
        await row("select opportunity_stage from opportunities where id=$1", [
          opportunity,
        ])
      ).opportunity_stage,
    ).toBe("evaluating");
  });
  it("approves exact material versions and reconciles review/apply actions", async () => {
    const f = await packageFixture();
    await rpc("approve_package", f.payload);
    expect(
      await row(
        "select status,approved_by_principal_id from application_packages where id=$1",
        [f.pkg.id],
      ),
    ).toEqual({ status: "approved", approved_by_principal_id: principal });
    expect(
      (
        await row(
          "select count(*)::int as count from next_actions where action_type='approve' and status='open'",
        )
      ).count,
    ).toBe(0);
    expect(
      (
        await row(
          "select count(*)::int as count from next_actions where action_type='apply' and status='open'",
        )
      ).count,
    ).toBe(1);
  });
  it("rejects changed material selection and unresolved blocking gaps", async () => {
    const f = await packageFixture();
    await expect(
      rpc("approve_package", { ...f.payload, material_ids: [randomUUID()] }),
    ).rejects.toThrow("Material versions changed");
    await db.query(
      "insert into application_gaps(workspace_id,opportunity_id,evaluation_id,gap_type,description,blocking_status) values($1,$2,$3,'clarification_needed','Missing required answer','blocking')",
      [workspace, opportunity, evaluation],
    );
    await expect(rpc("approve_package", f.payload)).rejects.toThrow(
      "Resolve blocking",
    );
    expect(
      (
        await row("select status from application_materials where id=$1", [
          f.material.id,
        ])
      ).status,
    ).toBe("candidate_review");
  });
  it("resolves only the explicitly reviewed unlinked handoff and rejects stale versions", async () => {
    const f = await packageFixture();
    const selected = await row(
      "insert into next_actions(workspace_id,opportunity_id,action_type,title) values($1,$2,'approve','Review these materials') returning id,updated_at",
      [workspace, opportunity],
    );
    const unrelated = await row(
      "insert into next_actions(workspace_id,opportunity_id,action_type,title) values($1,$2,'approve','Other approval') returning id",
      [workspace, opportunity],
    );
    await expect(
      rpc("approve_package", {
        ...f.payload,
        review_action_id: selected.id,
        review_action_updated_at: new Date(0),
      }),
    ).rejects.toThrow("review action changed");
    expect(
      (
        await row("select status from application_packages where id=$1", [
          f.pkg.id,
        ])
      ).status,
    ).toBe("ready_for_review");
    await rpc("approve_package", {
      ...f.payload,
      review_action_id: selected.id,
      review_action_updated_at: selected.updated_at,
    });
    expect(
      (await row("select status from next_actions where id=$1", [selected.id]))
        .status,
    ).toBe("completed");
    expect(
      (await row("select status from next_actions where id=$1", [unrelated.id]))
        .status,
    ).toBe("open");
  });
  it("supersedes the selected review when asking the worker for changes", async () => {
    const f = await packageFixture();
    const review = await row(
      "select id,updated_at from next_actions where action_type='approve' limit 1",
    );
    const result = await rpc("request_changes", {
      ...f.payload,
      notes: "Revise the evidence",
      review_action_id: review.id,
      review_action_updated_at: review.updated_at,
    });
    expect(
      (await row("select status from next_actions where id=$1", [review.id]))
        .status,
    ).toBe("superseded");
    expect(
      (
        await row("select status from application_packages where id=$1", [
          result.package_id,
        ])
      ).status,
    ).toBe("draft");
  });
  it("saves positioning on a working package and freezes it after approval", async () => {
    const f = await packageFixture();
    await rpc("save_positioning", {
      ...f.payload,
      notes: "Lead with confirmed leadership evidence",
    });
    expect(
      (
        await row(
          "select candidate_notes from application_packages where id=$1",
          [f.pkg.id],
        )
      ).candidate_notes,
    ).toBe("Lead with confirmed leadership evidence");
    const payload = {
      ...f.payload,
      package_updated_at: (
        await row("select updated_at from application_packages where id=$1", [
          f.pkg.id,
        ])
      ).updated_at,
    };
    await rpc("approve_package", payload);
    await expect(
      rpc("save_positioning", {
        ...payload,
        package_updated_at: (
          await row("select updated_at from application_packages where id=$1", [
            f.pkg.id,
          ])
        ).updated_at,
        notes: "Overwrite",
      }),
    ).rejects.toThrow("Approved positioning is frozen");
  });
  it("rolls back material approval when the package lifecycle rejects context", async () => {
    const f = await packageFixture();
    // Supersede the formerly complete evaluation: existing package approval
    // trigger must reject it, rolling back preceding material approvals.
    await db.query(
      "update evaluations set evaluation_status='superseded' where id=$1",
      [evaluation],
    );
    await expect(rpc("approve_package", f.payload)).rejects.toThrow(
      "incomplete Evaluation",
    );
    expect(
      (
        await row("select status from application_materials where id=$1", [
          f.material.id,
        ])
      ).status,
    ).toBe("candidate_review");
    expect(
      (
        await row(
          "select count(*)::int as count from activity_events where event_type='candidate_approve_package'",
        )
      ).count,
    ).toBe(0);
  });
  it("requests worker revisions in a new package and freezes the approved original", async () => {
    const f = await packageFixture();
    await rpc("approve_package", f.payload);
    const approved = await row(
      "select * from application_packages where id=$1",
      [f.pkg.id],
    );
    const revised = await rpc("request_changes", {
      ...f.payload,
      package_updated_at: approved.updated_at,
      notes: "Emphasize the leadership evidence",
    });
    expect(revised.package_id).not.toBe(f.pkg.id);
    expect(
      await row("select * from application_packages where id=$1", [f.pkg.id]),
    ).toEqual(approved);
    expect(
      (
        await row("select status from application_materials where id=$1", [
          f.material.id,
        ])
      ).status,
    ).toBe("approved");
    expect(
      (
        await row(
          "select count(*)::int as count from next_actions where action_type='apply' and status='open'",
        )
      ).count,
    ).toBe(0);
  });
  it("requires explicit submission and reuses exact immutable database snapshots", async () => {
    const f = await packageFixture();
    await rpc("approve_package", f.payload);
    const payload = {
      ...f.payload,
      package_updated_at: (
        await row("select updated_at from application_packages where id=$1", [
          f.pkg.id,
        ])
      ).updated_at,
    };
    await expect(rpc("confirm_submission", payload)).rejects.toThrow(
      "Explicit candidate",
    );
    expect(
      (await row("select count(*)::int as count from applications")).count,
    ).toBe(0);
    const request = randomUUID();
    const submitted = await rpc(
      "confirm_submission",
      { ...payload, confirmed: true },
      request,
    );
    await expect(
      rpc("request_changes", { ...payload, notes: "Reopen submitted history" }),
    ).rejects.toThrow("Submitted package history");
    expect(
      await rpc("confirm_submission", { ...payload, confirmed: true }, request),
    ).toEqual(submitted);
    expect(
      await row(
        "select application_stage,submitted_by_principal_id from applications where id=$1",
        [submitted.application_id],
      ),
    ).toEqual({
      application_stage: "submitted",
      submitted_by_principal_id: principal,
    });
    const snapshot = await row(
      "select application_material_id,submitted_material_snapshot from application_submitted_materials",
    );
    expect(snapshot.application_material_id).toBe(f.material.id);
    expect((snapshot.submitted_material_snapshot as Data).content_text).toBe(
      "Original resume v1",
    );
    await db.exec("savepoint immutability");
    await expect(
      db.query(
        "update application_submitted_materials set submitted_material_snapshot='{}'::jsonb",
      ),
    ).rejects.toThrow();
    await db.exec(
      "rollback to savepoint immutability; release savepoint immutability",
    );
    expect(
      (
        await row(
          "select count(*)::int as count from next_actions where action_type='apply' and status='open'",
        )
      ).count,
    ).toBe(0);
  });
});
