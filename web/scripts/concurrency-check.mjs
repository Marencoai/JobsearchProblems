// A disposable native PostgreSQL cluster, private Unix socket, no TCP listener,
// no inherited database credentials, and exclusively synthetic test records.
// Usage: node scripts/concurrency-check.mjs /absolute/postgres/bin /absolute/psql
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, chmod, readFile, readdir, rm } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";

const binaryDirectory = resolve(process.argv[2] ?? "");
const psql = resolve(process.argv[3] ?? "");
if (process.argv.length !== 4)
  throw new Error(
    "Pass PostgreSQL bin directory and psql executable explicitly",
  );
const root = await mkdtemp("/tmp/hq-pg-");
await chmod(root, 0o700);
const data = join(root, "data"),
  log = join(root, "server.log");
const environment = {
  PATH: "/usr/bin:/bin",
  LANG: "C",
  LC_ALL: "C",
  TZ: "UTC",
};
const exec = promisify(execFile);
const user = randomUUID();
let workspace, principal;
const literal = (value) => "'" + String(value).replaceAll("'", "''") + "'";
function query(sql, name = "hq-test") {
  return new Promise((resolve, reject) => {
    const child = spawn(
      psql,
      [
        "-X",
        "-w",
        "-qAt",
        "-h",
        root,
        "-p",
        "55432",
        "-U",
        "hq_test",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      { env: environment },
    );
    let output = "",
      error = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      error += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(output.trim()) : reject(new Error(error.trim())),
    );
    child.stdin.end(`set application_name=${literal(name)};\n${sql}`);
  });
}
async function json(sql) {
  const output = await query(sql);
  return JSON.parse(
    output.split("\n").findLast((line) => line.startsWith("{")),
  );
}
const auth = () =>
  `select set_config('request.jwt.claim.sub',${literal(user)},true); set local role authenticated;`;
const call = (f, command, payload, request) =>
  `select public.hq_human_action(${literal(workspace)},${literal(f.id)},${literal(f.updated_at)},${literal(request)},${literal(command)},${literal(JSON.stringify(payload))}::jsonb);`;
async function fixture() {
  return json(`begin; ${auth()}
    with company as (insert into companies(workspace_id,name) values(${literal(workspace)},'Synthetic company') returning id),
    opportunity as (insert into opportunities(workspace_id,company_id,title,opportunity_stage) select ${literal(workspace)},id,'Synthetic concurrent role','evaluating' from company returning id,updated_at),
    evaluation as (insert into evaluations(workspace_id,opportunity_id) select ${literal(workspace)},id from opportunity returning id,opportunity_id),
    decision as (insert into next_actions(workspace_id,opportunity_id,assigned_to_principal_id,action_type,title) select ${literal(workspace)},id,${literal(principal)},'decide','Synthetic decision' from opportunity returning id,updated_at)
    select json_build_object('id',o.id,'updated_at',o.updated_at,'evaluation_id',e.id,'action_id',d.id,'action_updated_at',d.updated_at) from opportunity o,evaluation e,decision d;
    commit;`);
}
async function evaluatedFixture() {
  const f = await fixture();
  await query(
    `begin; ${auth()} update evaluations set candidate_fit_score=90,opportunity_fit_score=85,opportunity_type='mutual_fit',evidence_confidence='high',problem_translation='Synthetic evidence',recommended_next_action='pursue',evaluation_status='complete' where id=${literal(f.evaluation_id)}; commit;`,
  );
  return f;
}
async function packageFixture() {
  let f = await evaluatedFixture();
  await query(
    `begin; ${auth()} ${call(f, "pursue", { action_id: f.action_id, action_updated_at: f.action_updated_at }, randomUUID())} commit;`,
  );
  const pkg = await json(
    `begin; ${auth()} insert into application_packages(workspace_id,opportunity_id,evaluation_id) values(${literal(workspace)},${literal(f.id)},${literal(f.evaluation_id)}) returning json_build_object('id',id); commit;`,
  );
  const material = await json(
    `begin; ${auth()} insert into application_materials(workspace_id,application_package_id,material_type,content_text) values(${literal(workspace)},${literal(pkg.id)},'resume','Synthetic original resume') returning json_build_object('id',id); commit;`,
  );
  await query(
    `begin; ${auth()} update application_packages set status='preparing' where id=${literal(pkg.id)}; update application_materials set status='candidate_review' where id=${literal(material.id)}; update application_packages set status='ready_for_review' where id=${literal(pkg.id)}; commit;`,
  );
  f = {
    ...f,
    ...(await json(
      `select json_build_object('updated_at',o.updated_at,'package_id',p.id,'package_updated_at',p.updated_at) from opportunities o join application_packages p on p.opportunity_id=o.id where p.id=${literal(pkg.id)};`,
    )),
  };
  f.payload = {
    package_id: pkg.id,
    package_updated_at: f.package_updated_at,
    material_ids: [material.id],
  };
  return f;
}
async function waitFor(name, type) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (
      (await query(
        `select count(*) from pg_stat_activity where application_name=${literal(name)} and wait_event_type=${literal(type)};`,
      )) === "1"
    )
      return;
    await new Promise((done) => setTimeout(done, 5));
  }
  throw new Error(`Did not observe ${name} waiting on ${type}`);
}
async function race(
  f,
  firstCommand,
  firstPayload,
  firstRequest,
  secondCommand = firstCommand,
  secondPayload = firstPayload,
  secondRequest = firstRequest,
) {
  // Session A holds the same Opportunity row lock used by the RPC. Session B
  // is observed waiting on a PostgreSQL Lock before A is allowed to finish.
  const first = query(
    `begin; ${auth()} select id from opportunities where id=${literal(f.id)} for update; select pg_sleep(1); ${call(f, firstCommand, firstPayload, firstRequest)} commit;`,
    "hq-race-first",
  );
  await waitFor("hq-race-first", "Timeout");
  const second = query(
    `begin; ${auth()} ${call(f, secondCommand, secondPayload, secondRequest)} commit;`,
    "hq-race-second",
  );
  // Attach rejection handling immediately so expected rejection cannot become
  // an unhandled promise before the lock observation completes.
  const settled = Promise.allSettled([first, second]);
  await waitFor("hq-race-second", "Lock");
  return settled;
}
const rpcResult = (result) =>
  JSON.parse(result.value.split("\n").findLast((line) => line.startsWith("{")));
let started = false;
try {
  console.log(
    (
      await exec(join(binaryDirectory, "postgres"), ["--version"], {
        env: environment,
      })
    ).stdout.trim(),
  );
  await exec(
    join(binaryDirectory, "initdb"),
    ["-D", data, "-U", "hq_test", "-A", "trust", "--no-locale"],
    { env: environment },
  );
  await exec(
    join(binaryDirectory, "pg_ctl"),
    [
      "-D",
      data,
      "-l",
      log,
      "-o",
      `-h '' -k ${root} -p 55432 -c max_connections=10`,
      "-w",
      "start",
    ],
    { env: environment },
  );
  started = true;
  assert.equal(await query("show listen_addresses;"), "");
  await query(`create role anon; create role authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select,insert,update,delete on storage.objects to authenticated;
    create schema auth;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb; $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create function public.rls_auto_enable() returns event_trigger language plpgsql as $$ begin return; end; $$;`);
  const migrations = new URL("../../supabase/migrations/", import.meta.url);
  let applied = 0;
  for (const name of (await readdir(migrations))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    if (name.endsWith("_agent_identity.sql")) continue;
    await query(await readFile(new URL(name, migrations), "utf8"));
    applied++;
  }
  console.log(
    `Replayed ${applied} unchanged migrations; skipped 2 production identity provisions`,
  );
  // Optional combined test mode. The path is an explicit frozen proposal tree,
  // not a connection/credential; these bytes can only enter this owned cluster.
  if (process.env.HQ_FROZEN_DOMAINS_ROOT) {
    const pins = [
      [
        "outreach/20261001230000_outreach_domain.sql",
        "9a8dffce9152ffa51220c5da6787d1c87f4444b11d4b21b3b697f6c04c194e6b",
      ],
      [
        "interview/001_interview.sql",
        "1c1d6aef2c244793d844db34e9c861aafe56d01475d3ab2f70d0deed53255f11",
      ],
      [
        "interview/002_interview_contacts.sql",
        "54db40039beb65379fd9493b839a9812987036bbcf809a25694e8b2c5863780f",
      ],
      [
        "offer/001_offer.sql",
        "f8b04664ef59d365c9a8a2703b1eedf413a559727a967a68fb26b10442d37851",
      ],
    ];
    for (const [name, sha256] of pins) {
      const sql = await readFile(
        join(process.env.HQ_FROZEN_DOMAINS_ROOT, name),
        "utf8",
      );
      assert.equal(createHash("sha256").update(sql).digest("hex"), sha256);
      await query(sql);
    }
    console.log(
      "Replayed exact frozen Outreach/Interview/Contact/Offer proposals before all hardening concurrency cases",
    );
  }
  const owner =
    await json(`insert into auth.users(id,email) values(${literal(user)},'synthetic-native-owner@example.invalid');
    select set_config('request.jwt.claim.sub',${literal(user)},false);
    select json_build_object('workspace',public.bootstrap_personal_workspace('Native concurrency tests','synthetic-native'),'principal',public.current_principal_id());`);
  workspace = owner.workspace;
  // Read identity in a new statement after bootstrap's inserted Principal is
  // visible to the STABLE current_principal_id helper.
  principal = (
    await json(
      `select set_config('request.jwt.claim.sub',${literal(user)},false); select json_build_object('id',public.current_principal_id());`,
    )
  ).id;

  // Prove the request-scoped advisory lock serializes separate connections.
  async function intakeRace(changed = false) {
    const request = randomUUID(),
      key = "hq:manual-intake:" + principal + ":" + request;
    const evidence = {
      mode: "url",
      url: "https://example.invalid/native-role",
    };
    const intakeCall = (input) =>
      `select hq_request_job_intake(${literal(workspace)},${literal(request)},${literal(JSON.stringify(input))}::jsonb);`;
    const first = query(
      `begin; ${auth()} select pg_advisory_xact_lock(hashtextextended(${literal(workspace + key)},0)); select pg_sleep(1); ${intakeCall(evidence)} commit;`,
      "hq-intake-first",
    );
    const firstHandled = first.then(
      (value) => ({ status: "fulfilled", value }),
      (reason) => ({ status: "rejected", reason }),
    );
    await waitFor("hq-intake-first", "Timeout");
    const second = query(
      `begin; ${auth()} ${intakeCall(changed ? { ...evidence, url: "https://example.invalid/different" } : evidence)} commit;`,
      "hq-intake-second",
    );
    const secondHandled = second.then(
      (value) => ({ status: "fulfilled", value }),
      (reason) => ({ status: "rejected", reason }),
    );
    await waitFor("hq-intake-second", "Lock");
    const results = await Promise.all([firstHandled, secondHandled]);
    assert.equal(results[0].status, "fulfilled");
    if (changed) {
      assert.equal(results[1].status, "rejected");
      assert.match(results[1].reason.message, /different intake evidence/);
    } else {
      assert.equal(results[1].status, "fulfilled");
      assert.deepEqual(rpcResult(results[0]), rpcResult(results[1]));
    }
    assert.equal(
      await query(
        `select count(*) from activity_events where idempotency_key=${literal(key)};`,
      ),
      "1",
    );
    assert.equal(
      await query(
        `select count(*) from internal_tasks where idempotency_key=${literal(key + ":task")};`,
      ),
      "1",
    );
    console.log(
      changed
        ? "PASS conflicting manual intake retry: second payload rejected; one event/task"
        : "PASS identical manual intake retry: same result and one event/task; second connection observed Lock wait",
    );
  }
  await intakeRace();
  await intakeRace(true);

  // Both retry identity and per-role queue coalescing are exercised with real
  // advisory-lock waits. No completed evaluation or opportunity fact changes.
  async function researchRace(sameKey) {
    const f = await evaluatedFixture(),
      firstKey = randomUUID(),
      secondKey = sameKey ? firstKey : randomUUID();
    const before = await query(
      `select row_to_json(e) from evaluations e where id=${literal(f.evaluation_id)}; select row_to_json(o) from opportunities o where id=${literal(f.id)};`,
    );
    const requestCall = (key) =>
      `select hq_request_research_refresh(${literal(workspace)},${literal(f.id)},${literal(f.updated_at)},${literal(key)});`;
    const lock = sameKey
      ? workspace + "hq:research-refresh:" + principal + ":" + firstKey
      : workspace + ":research:" + f.id;
    const first = query(
      `begin; ${auth()} select pg_advisory_xact_lock(hashtextextended(${literal(lock)},0)); select pg_sleep(1); ${requestCall(firstKey)} commit;`,
      "hq-research-first",
    );
    const firstHandled = first.then(
      (value) => ({ status: "fulfilled", value }),
      (reason) => ({ status: "rejected", reason }),
    );
    await waitFor("hq-research-first", "Timeout");
    const second = query(
      `begin; ${auth()} ${requestCall(secondKey)} commit;`,
      "hq-research-second",
    );
    const secondHandled = second.then(
      (value) => ({ status: "fulfilled", value }),
      (reason) => ({ status: "rejected", reason }),
    );
    await waitFor("hq-research-second", "Lock");
    const outcomes = await Promise.all([firstHandled, secondHandled]);
    assert.ok(
      outcomes.every((r) => r.status === "fulfilled"),
      JSON.stringify(outcomes),
    );
    const a = rpcResult(outcomes[0]),
      b = rpcResult(outcomes[1]);
    assert.equal(a.task_id, b.task_id);
    if (sameKey) assert.deepEqual(a, b);
    assert.equal(
      await query(
        `select count(*) from internal_tasks where opportunity_id=${literal(f.id)};`,
      ),
      "1",
    );
    assert.equal(
      await query(
        `select count(*) from activity_events where opportunity_id=${literal(f.id)} and event_type='research_refresh_requested';`,
      ),
      sameKey ? "1" : "2",
    );
    assert.equal(
      await query(
        `select count(*) from next_actions where opportunity_id=${literal(f.id)};`,
      ),
      "1",
    );
    assert.equal(
      await query(
        `select row_to_json(e) from evaluations e where id=${literal(f.evaluation_id)}; select row_to_json(o) from opportunities o where id=${literal(f.id)};`,
      ),
      before,
    );
    console.log(
      sameKey
        ? "PASS concurrent identical research refresh: one event/task, same result; observed Lock wait"
        : "PASS concurrent distinct research requests: two attributed events, one task, completed evaluation unchanged; observed Lock wait",
    );
  }
  await researchRace(true);
  await researchRace(false);

  const pursuit = await evaluatedFixture();
  let results = await race(
    pursuit,
    "pursue",
    {
      action_id: pursuit.action_id,
      action_updated_at: pursuit.action_updated_at,
    },
    randomUUID(),
  );
  assert.ok(results.every((result) => result.status === "fulfilled"));
  assert.deepEqual(rpcResult(results[0]), rpcResult(results[1]));
  assert.equal(
    await query(
      `select count(*) from internal_tasks where opportunity_id=${literal(pursuit.id)};`,
    ),
    "1",
  );
  assert.equal(
    await query(
      `select count(*) from activity_events where opportunity_id=${literal(pursuit.id)};`,
    ),
    "1",
  );
  console.log(
    "PASS concurrent identical Pursue: one task/event and identical result; second session observed Lock wait",
  );

  const competing = await evaluatedFixture();
  const decision = {
    action_id: competing.action_id,
    action_updated_at: competing.action_updated_at,
  };
  results = await race(
    competing,
    "pursue",
    decision,
    randomUUID(),
    "pass",
    { ...decision, reason: "Synthetic competing decision" },
    randomUUID(),
  );
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.match(results[1].reason.message, /opportunity changed/);
  assert.equal(
    await query(
      `select opportunity_stage from opportunities where id=${literal(competing.id)};`,
    ),
    "pursuing",
  );
  assert.equal(
    await query(
      `select count(*) from activity_events where opportunity_id=${literal(competing.id)};`,
    ),
    "1",
  );
  console.log(
    "PASS competing Pursue/Pass: stale loser rejected; no conflicting history",
  );

  const revision = await packageFixture();
  results = await race(
    revision,
    "request_changes",
    { ...revision.payload, notes: "Synthetic revision" },
    randomUUID(),
    "request_changes",
    { ...revision.payload, notes: "Competing revision" },
    randomUUID(),
  );
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.match(results[1].reason.message, /latest application package/);
  assert.equal(
    await query(
      `select count(*) from application_packages where opportunity_id=${literal(revision.id)};`,
    ),
    "2",
  );
  assert.equal(
    await query(
      `select count(*) from internal_tasks where opportunity_id=${literal(revision.id)};`,
    ),
    "2",
  );
  console.log(
    "PASS competing revision requests: one new draft/task; stale original rejected",
  );

  const approval = await packageFixture();
  results = await race(
    approval,
    "approve_package",
    approval.payload,
    randomUUID(),
  );
  assert.ok(results.every((result) => result.status === "fulfilled"));
  assert.deepEqual(rpcResult(results[0]), rpcResult(results[1]));
  assert.equal(
    await query(
      `select count(*) from next_actions where opportunity_id=${literal(approval.id)} and action_type='apply' and status='open';`,
    ),
    "1",
  );
  assert.equal(
    await query(
      `select count(*) from activity_events where opportunity_id=${literal(approval.id)} and event_type='candidate_approve_package';`,
    ),
    "1",
  );
  console.log(
    "PASS concurrent identical approval: one apply action and one approval event",
  );

  const submitted = await packageFixture();
  await query(
    `begin; ${auth()} ${call(submitted, "approve_package", submitted.payload, randomUUID())} commit;`,
  );
  submitted.payload.package_updated_at = (
    await json(
      `select json_build_object('updated_at',updated_at) from application_packages where id=${literal(submitted.package_id)};`,
    )
  ).updated_at;
  results = await race(
    submitted,
    "confirm_submission",
    { ...submitted.payload, confirmed: true },
    randomUUID(),
  );
  assert.ok(results.every((result) => result.status === "fulfilled"));
  assert.deepEqual(rpcResult(results[0]), rpcResult(results[1]));
  assert.equal(
    await query(
      `select count(*) from applications where opportunity_id=${literal(submitted.id)};`,
    ),
    "1",
  );
  assert.equal(
    await query(
      `select count(*) from application_submitted_materials s join applications a on a.id=s.application_id where a.opportunity_id=${literal(submitted.id)};`,
    ),
    "1",
  );
  assert.equal(
    await query(
      `select count(*) from activity_events where opportunity_id=${literal(submitted.id)} and event_type='candidate_confirm_submission';`,
    ),
    "1",
  );
  console.log(
    "PASS concurrent identical submission: one attempt/snapshot/event",
  );

  // Forward proposal: actual competing connections, not simulated row counts.
  const planCall = (f, plan) =>
    `insert into daily_plan_items(workspace_id,daily_plan_id,next_action_id,display_order) values(${literal(workspace)},${literal(plan)},${literal(f.action_id)},1);`;
  const makePlan = async () =>
    (
      await json(
        `begin; ${auth()} insert into daily_plans(workspace_id,plan_date) values(${literal(workspace)},current_date) returning json_build_object('id',id); commit;`,
      )
    ).id;
  const handle = (promise) =>
    promise.then(
      (value) => ({ status: "fulfilled", value }),
      (reason) => ({ status: "rejected", reason }),
    );

  // The selection sees the committed deferral after waiting for its row lock.
  const deferred = await evaluatedFixture(),
    deferredPlan = await makePlan();
  let first = handle(
    query(
      `begin; ${auth()} update next_actions set available_after=clock_timestamp()+interval '1 hour' where id=${literal(deferred.action_id)}; select pg_sleep(1); commit;`,
      "hq-defer-first",
    ),
  );
  await waitFor("hq-defer-first", "Timeout");
  let second = handle(
    query(
      `begin; ${auth()} ${planCall(deferred, deferredPlan)} commit;`,
      "hq-selection-second",
    ),
  );
  await waitFor("hq-selection-second", "Lock");
  let outcomes = await Promise.all([first, second]);
  assert.equal(outcomes[0].status, "fulfilled");
  assert.equal(outcomes[1].status, "rejected");
  assert.match(outcomes[1].reason.message, /candidate-eligible/);
  assert.equal(
    await query(
      `select count(*) from daily_plan_items where daily_plan_id=${literal(deferredPlan)};`,
    ),
    "0",
  );
  console.log(
    "PASS committed future deferral vs raw selection: observed Lock wait, no Plan Item written",
  );

  // clock_timestamp is captured after waiting; transaction-start now() would
  // incorrectly exclude this same action whose due boundary elapsed meanwhile.
  const due = await evaluatedFixture();
  first = handle(
    query(
      `begin; ${auth()} update next_actions set available_after=clock_timestamp()+interval '500 milliseconds' where id=${literal(due.action_id)}; select pg_sleep(1); commit;`,
      "hq-due-first",
    ),
  );
  await waitFor("hq-due-first", "Timeout");
  second = handle(
    query(
      `begin; ${auth()} select hq_planner_inputs(${literal(workspace)},null); commit;`,
      "hq-due-planner",
    ),
  );
  await waitFor("hq-due-planner", "Lock");
  outcomes = await Promise.all([first, second]);
  assert.ok(outcomes.every((r) => r.status === "fulfilled"));
  assert.ok(rpcResult(outcomes[1]).eligible_action_ids.includes(due.action_id));
  console.log(
    "PASS due boundary elapsed under planner Lock wait: same action eligible using post-lock database time",
  );

  // Reverse ordering is also serializable: preserve what was selected, but
  // remove it from current delivery when the later deferral commits.
  const selected = await evaluatedFixture(),
    selectedPlan = await makePlan();
  await query(`begin; ${auth()} ${planCall(selected, selectedPlan)} commit;`);
  first = handle(
    query(
      `begin; ${auth()} update daily_plans set todays_one_thing_action_id=${literal(selected.action_id)},status='active' where id=${literal(selectedPlan)}; select pg_sleep(1); commit;`,
      "hq-selection-first",
    ),
  );
  await waitFor("hq-selection-first", "Timeout");
  second = handle(
    query(
      `begin; ${auth()} ${call(selected, "defer", { action_id: selected.action_id, action_updated_at: selected.action_updated_at, available_after: new Date(Date.now() + 3_600_000).toISOString() }, randomUUID())} commit;`,
      "hq-deferral-second",
    ),
  );
  await waitFor("hq-deferral-second", "Lock");
  outcomes = await Promise.all([first, second]);
  assert.ok(
    outcomes.every((r) => r.status === "fulfilled"),
    JSON.stringify(outcomes),
  );
  const delivery = await json(
    `begin; ${auth()} select hq_planner_inputs(${literal(workspace)},${literal(selectedPlan)}); commit;`,
  );
  assert.deepEqual(delivery.delivery_item_ids, []);
  assert.equal(delivery.one_thing_action_id, null);
  assert.equal(
    await query(
      `select todays_one_thing_action_id from daily_plans where id=${literal(selectedPlan)};`,
    ),
    selected.action_id,
  );
  console.log(
    "PASS selection vs later human deferral: observed Lock wait; historical One Thing retained, current delivery excluded",
  );

  async function initialFixture() {
    let f = await evaluatedFixture();
    const pursued = await json(
      `begin; ${auth()} ${call(f, "pursue", { action_id: f.action_id, action_updated_at: f.action_updated_at }, randomUUID())} commit;`,
    );
    const handoffCall = `select hq_preparation_target(${literal(workspace)},${literal(pursued.task_id)});`;
    return { ...f, task_id: pursued.task_id, handoffCall };
  }
  const initial = await initialFixture();
  first = handle(
    query(
      `begin; ${auth()} select id from opportunities where id=${literal(initial.id)} for update; select pg_sleep(1); ${initial.handoffCall} commit;`,
      "hq-initial-first",
    ),
  );
  await waitFor("hq-initial-first", "Timeout");
  second = handle(
    query(
      `begin; ${auth()} ${initial.handoffCall} commit;`,
      "hq-initial-second",
    ),
  );
  await waitFor("hq-initial-second", "Lock");
  outcomes = await Promise.all([first, second]);
  assert.ok(
    outcomes.every((r) => r.status === "fulfilled"),
    JSON.stringify(outcomes),
  );
  assert.deepEqual(rpcResult(outcomes[0]), rpcResult(outcomes[1]));
  assert.equal(
    await query(
      `select count(*) from application_packages where opportunity_id=${literal(initial.id)} and hq_preparation_task_id=${literal(initial.task_id)};`,
    ),
    "1",
  );
  console.log(
    "PASS simultaneous initial Owner handoff: observed Lock wait; one exact Package/binding and identical result",
  );

  async function managedFixture(preparing = false) {
    const f = await initialFixture();
    const handoff = await json(`begin; ${auth()} ${f.handoffCall} commit;`);
    if (preparing)
      await query(
        `begin; ${auth()} update application_packages set status='preparing' where id=${literal(handoff.package_id)}; commit;`,
      );
    return {
      ...f,
      package_id: handoff.package_id,
      ...(await json(
        `select json_build_object('updated_at',o.updated_at,'package_updated_at',p.updated_at) from opportunities o join application_packages p on p.opportunity_id=o.id where p.id=${literal(handoff.package_id)};`,
      )),
    };
  }
  const insertMaterial = (f) =>
    `insert into application_materials(workspace_id,application_package_id,material_type,content_text,hq_preparation_task_id) values(${literal(workspace)},${literal(f.package_id)},'resume','Concurrent synthetic evidence',${literal(f.task_id)});`;
  const revisionPayload = (f) => ({
    package_id: f.package_id,
    package_updated_at: f.package_updated_at,
    notes: "Concurrent verified revision",
  });

  const fenced = await managedFixture();
  first = handle(
    query(
      `begin; ${auth()} select id from opportunities where id=${literal(fenced.id)} for update; select pg_sleep(1); ${call(fenced, "request_changes", revisionPayload(fenced), randomUUID())} commit;`,
      "hq-revision-first",
    ),
  );
  await waitFor("hq-revision-first", "Timeout");
  second = handle(
    query(
      `begin; ${auth()} ${insertMaterial(fenced)} commit;`,
      "hq-material-second",
    ),
  );
  await waitFor("hq-material-second", "Lock");
  outcomes = await Promise.all([first, second]);
  assert.equal(outcomes[0].status, "fulfilled");
  assert.equal(outcomes[1].status, "rejected");
  assert.match(outcomes[1].reason.message, /Exact current bound/);
  assert.equal(
    await query(
      `select count(*) from application_materials where application_package_id=${literal(fenced.package_id)};`,
    ),
    "0",
  );
  console.log(
    "PASS revision vs old-target Material INSERT: observed Lock wait; refreshed bound-target guard rejects with zero Materials",
  );

  const reverse = await managedFixture();
  first = handle(
    query(
      `begin; ${auth()} ${insertMaterial(reverse)} select pg_sleep(1); commit;`,
      "hq-material-first",
    ),
  );
  await waitFor("hq-material-first", "Timeout");
  second = handle(
    query(
      `begin; ${auth()} ${call(reverse, "request_changes", revisionPayload(reverse), randomUUID())} commit;`,
      "hq-revision-second",
    ),
  );
  await waitFor("hq-revision-second", "Lock");
  outcomes = await Promise.all([first, second]);
  assert.ok(
    outcomes.every((r) => r.status === "fulfilled"),
    JSON.stringify(outcomes),
  );
  assert.equal(
    await query(
      `select count(*) from application_materials where application_package_id=${literal(reverse.package_id)};`,
    ),
    "1",
  );
  assert.equal(
    await query(
      `select count(*) from application_packages where opportunity_id=${literal(reverse.id)};`,
    ),
    "2",
  );
  console.log(
    "PASS Material INSERT vs later revision: observed Lock wait; valid earlier Material retained, new target bound separately",
  );

  // UPDATE has already locked its row when a BEFORE trigger runs. NOWAIT is
  // deliberate: release that row via transaction failure instead of creating
  // a reverse-order deadlock with the Opportunity-first revision command.
  const ready = await managedFixture(true);
  let firstFinished = false;
  first = handle(
    query(
      `begin; ${auth()} select id from opportunities where id=${literal(ready.id)} for update; select pg_sleep(1); ${call(ready, "request_changes", revisionPayload(ready), randomUUID())} commit;`,
      "hq-ready-revision",
    ),
  ).then((result) => {
    firstFinished = true;
    return result;
  });
  await waitFor("hq-ready-revision", "Timeout");
  second = handle(
    query(
      `begin; ${auth()} update application_packages set status='ready_for_review' where id=${literal(ready.package_id)}; commit;`,
      "hq-ready-update",
    ),
  );
  const denied = await second;
  assert.equal(denied.status, "rejected");
  assert.match(denied.reason.message, /changed concurrently; refresh handoff/);
  assert.equal(firstFinished, false);
  const revisionResult = await first;
  assert.equal(revisionResult.status, "fulfilled");
  assert.equal(
    await query(
      `select status from application_packages where id=${literal(ready.package_id)};`,
    ),
    "preparing",
  );
  const current = rpcResult(revisionResult);
  await query(
    `begin; ${auth()} update application_packages set status='preparing' where id=${literal(current.package_id)}; commit;`,
  );
  console.log(
    "PASS revision vs raw Package UPDATE: contention rejected before held Opportunity releases, no deadlock; refreshed exact target retry succeeds",
  );

  const readyFirst = await managedFixture(true);
  first = handle(
    query(
      `begin; ${auth()} update application_packages set status='ready_for_review' where id=${literal(readyFirst.package_id)}; select pg_sleep(1); commit;`,
      "hq-readiness-first",
    ),
  );
  await waitFor("hq-readiness-first", "Timeout");
  second = handle(
    query(
      `begin; ${auth()} ${call(readyFirst, "request_changes", revisionPayload(readyFirst), randomUUID())} commit;`,
      "hq-readiness-revision",
    ),
  );
  await waitFor("hq-readiness-revision", "Lock");
  outcomes = await Promise.all([first, second]);
  assert.equal(outcomes[0].status, "fulfilled");
  assert.equal(outcomes[1].status, "rejected");
  assert.match(outcomes[1].reason.message, /package changed/);
  assert.equal(
    await query(
      `select count(*) from application_packages where opportunity_id=${literal(readyFirst.id)};`,
    ),
    "1",
  );
  console.log(
    "PASS readiness UPDATE vs reviewed-version revision: observed Lock wait; stale reviewed Package version rejected with no successor",
  );

  const successiveBase = await managedFixture();
  const firstRevision = await json(
    `begin; ${auth()} ${call(successiveBase, "request_changes", revisionPayload(successiveBase), randomUUID())} commit;`,
  );
  const successive = {
    ...successiveBase,
    package_id: firstRevision.package_id,
    task_id: firstRevision.task_id,
    ...(await json(
      `select json_build_object('updated_at',o.updated_at,'package_updated_at',p.updated_at) from opportunities o join application_packages p on p.opportunity_id=o.id where p.id=${literal(firstRevision.package_id)};`,
    )),
  };
  first = handle(
    query(
      `begin; ${auth()} select id from opportunities where id=${literal(successive.id)} for update; select pg_sleep(1); ${call(successive, "request_changes", revisionPayload(successive), randomUUID())} commit;`,
      "hq-successive-revision",
    ),
  );
  await waitFor("hq-successive-revision", "Timeout");
  second = handle(
    query(
      `begin; ${auth()} ${insertMaterial(successive)} commit;`,
      "hq-successive-material",
    ),
  );
  await waitFor("hq-successive-material", "Lock");
  outcomes = await Promise.all([first, second]);
  assert.equal(outcomes[0].status, "fulfilled");
  assert.equal(outcomes[1].status, "rejected");
  assert.match(outcomes[1].reason.message, /Exact current bound/);
  assert.equal(
    await query(
      `select count(*) from application_packages where opportunity_id=${literal(successive.id)} and hq_preparation_task_id is not null;`,
    ),
    "3",
  );
  assert.equal(
    await query(
      `select count(*) from application_materials where application_package_id=${literal(successive.package_id)};`,
    ),
    "0",
  );
  console.log(
    "PASS successive bound revisions vs old successor Material: observed Lock wait; third target uniquely bound, second-target insert rejected",
  );

  const changing = await managedFixture();
  await query(`begin; ${auth()} ${insertMaterial(changing)} commit;`);
  let materialRevisionFinished = false;
  first = handle(
    query(
      `begin; ${auth()} select id from opportunities where id=${literal(changing.id)} for update; select pg_sleep(1); ${call(changing, "request_changes", revisionPayload(changing), randomUUID())} commit;`,
      "hq-update-revision",
    ),
  ).then((result) => {
    materialRevisionFinished = true;
    return result;
  });
  await waitFor("hq-update-revision", "Timeout");
  second = handle(
    query(
      `begin; ${auth()} update application_materials set is_current_package_version=false where application_package_id=${literal(changing.package_id)}; commit;`,
      "hq-material-update",
    ),
  );
  const updateDenied = await second;
  assert.equal(updateDenied.status, "rejected");
  assert.match(
    updateDenied.reason.message,
    /changed concurrently; refresh handoff/,
  );
  assert.equal(materialRevisionFinished, false);
  assert.equal((await first).status, "fulfilled");
  assert.equal(
    await query(
      `select count(*) from application_materials where application_package_id=${literal(changing.package_id)} and is_current_package_version;`,
    ),
    "1",
  );
  console.log(
    "PASS revision vs raw Material current-version UPDATE: immediate retry error before fence release, original version selection unchanged",
  );

  const held = await managedFixture(),
    independent = await managedFixture();
  let heldFinished = false;
  first = handle(
    query(
      `begin; ${auth()} select id from opportunities where id=${literal(held.id)} for update; select pg_sleep(1); ${call(held, "request_changes", revisionPayload(held), randomUUID())} commit;`,
      "hq-independent-held",
    ),
  ).then((result) => {
    heldFinished = true;
    return result;
  });
  await waitFor("hq-independent-held", "Timeout");
  second = handle(
    query(
      `begin; ${auth()} ${insertMaterial(independent)} commit;`,
      "hq-independent-material",
    ),
  );
  assert.equal((await second).status, "fulfilled");
  assert.equal(heldFinished, false);
  assert.equal((await first).status, "fulfilled");
  console.log(
    "PASS unrelated Opportunity preparation progresses before held revision fence releases; no Workspace-wide/global serialization",
  );

  // Test-only shim in this disposable cluster widens the exact helper→invoker
  // read window. Production SQL has no sleep, GUC bypass or test hook.
  await query(`alter function private.hq_lock_planner_scope(uuid,uuid) rename to hq_lock_planner_scope_test_core;
    create function private.hq_lock_planner_scope(w uuid,p uuid) returns jsonb language plpgsql security definer set search_path='' as $$
      declare captured jsonb; begin captured:=private.hq_lock_planner_scope_test_core(w,p); perform pg_sleep(1); return captured; end; $$;
    revoke all on function private.hq_lock_planner_scope(uuid,uuid) from public,anon;
    grant execute on function private.hq_lock_planner_scope(uuid,uuid) to authenticated;`);
  const phantom = await evaluatedFixture();
  let capturedFinished = false;
  first = handle(
    query(
      `begin; ${auth()} select hq_planner_inputs(${literal(workspace)},null); commit;`,
      "hq-captured-planner",
    ),
  ).then((result) => {
    capturedFinished = true;
    return result;
  });
  await waitFor("hq-captured-planner", "Timeout");
  const inserted =
    await json(`begin; ${auth()} insert into next_actions(workspace_id,opportunity_id,assigned_to_principal_id,action_type,title)
    values(${literal(workspace)},${literal(phantom.id)},${literal(principal)},'review','Concurrent inserted action') returning json_build_object('id',id); commit;`);
  await query(
    `begin; ${auth()} update next_actions set available_after=clock_timestamp()+interval '1 hour' where id=${literal(inserted.id)}; commit;`,
  );
  assert.equal(capturedFinished, false);
  const captured = await first;
  assert.equal(captured.status, "fulfilled");
  assert.ok(
    !rpcResult(captured).deduplication_action_ids.includes(inserted.id),
  );
  assert.ok(!rpcResult(captured).eligible_action_ids.includes(inserted.id));
  await query(`drop function private.hq_lock_planner_scope(uuid,uuid);
    alter function private.hq_lock_planner_scope_test_core(uuid,uuid) rename to hq_lock_planner_scope;`);
  const refreshed = await json(
    `begin; ${auth()} select hq_planner_inputs(${literal(workspace)},null); commit;`,
  );
  assert.ok(refreshed.deduplication_action_ids.includes(inserted.id));
  assert.ok(!refreshed.eligible_action_ids.includes(inserted.id));
  console.log(
    "PASS insert then deferral in widened post-lock read window: unlocked phantom excluded from captured result; fresh call retains it for deduplication and excludes delivery",
  );
} finally {
  if (started)
    await exec(
      join(binaryDirectory, "pg_ctl"),
      ["-D", data, "-m", "fast", "-w", "stop"],
      { env: environment },
    );
  await rm(root, { recursive: true, force: true });
  console.log("Stopped and removed the owned synthetic cluster");
}
