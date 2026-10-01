// A disposable native PostgreSQL cluster, private Unix socket, no TCP listener,
// no inherited database credentials, and exclusively synthetic test records.
// Usage: node scripts/concurrency-check.mjs /absolute/postgres/bin /absolute/psql
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, chmod, readFile, readdir, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
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
  await query(`create role anon; create role authenticated; create schema auth;
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
