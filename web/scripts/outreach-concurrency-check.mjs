// Disposable PostgreSQL only. No connection strings, inherited credentials,
// production records, TCP listeners, global services, or external messages.
// node scripts/outreach-concurrency-check.mjs /absolute/postgres/bin /absolute/psql
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, chmod, readFile, readdir, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";

if (process.argv.length !== 4)
  throw new Error("Pass explicit PostgreSQL bin directory and psql executable");
const binaryDirectory = resolve(process.argv[2]),
  psql = resolve(process.argv[3]);
const root = await mkdtemp("/tmp/hq-outreach-pg-");
await chmod(root, 0o700);
const data = join(root, "data"),
  log = join(root, "server.log");
const environment = {
  PATH: "/usr/bin:/bin",
  LANG: "C",
  LC_ALL: "C",
  TZ: "UTC",
};
const exec = promisify(execFile),
  literal = (v) => "'" + String(v).replaceAll("'", "''") + "'";
const user = randomUUID();
let workspace, principal, company, opportunity;
let started = false;
function query(sql, name = "outreach-test") {
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
        "55433",
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
    child.stdout.on("data", (c) => {
      output += c;
    });
    child.stderr.on("data", (c) => {
      error += c;
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
  return JSON.parse(output.split("\n").findLast((l) => l.startsWith("{")));
}
const auth = () =>
  `select set_config('request.jwt.claim.sub',${literal(user)},true);set local role authenticated;`;
const call = (command, payload, request = randomUUID()) =>
  `select public.hq_outreach_action(${literal(workspace)},${literal(request)},${literal(command)},${literal(JSON.stringify(payload))}::jsonb);`;
async function rpc(command, payload) {
  return json(`begin;${auth()}${call(command, payload)}commit;`);
}
async function revision(id) {
  return Number(
    await query(
      `select revision from outreach_engagements where id=${literal(id)};`,
    ),
  );
}
async function fixture() {
  const contact = await rpc("save_contact", {
    company_id: company,
    full_name: "Synthetic native recruiter",
    email: "native@example.invalid",
    source_system: "candidate",
  });
  const engagement = await rpc("create_engagement", {
    contact_id: contact.contact_id,
  });
  await rpc("link_engagement", {
    engagement_id: engagement.engagement_id,
    expected_revision: await revision(engagement.engagement_id),
    opportunity_id: opportunity,
  });
  return { contact: contact.contact_id, engagement: engagement.engagement_id };
}
async function draft(f) {
  return rpc("save_draft", {
    engagement_id: f.engagement,
    expected_revision: await revision(f.engagement),
    opportunity_id: opportunity,
    channel: "email",
    content: "Exact native concurrency draft",
  });
}
async function waitFor(name, type) {
  for (let count = 0; count < 100; count++) {
    if (
      (await query(
        `select count(*) from pg_stat_activity where application_name=${literal(name)} and wait_event_type=${literal(type)};`,
      )) === "1"
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`No observed ${type} wait for ${name}`);
}
async function race(
  firstCommand,
  firstPayload,
  firstId,
  secondCommand = firstCommand,
  secondPayload = firstPayload,
  secondId = firstId,
) {
  const first = query(
    `begin;${auth()}select id from workspaces where id=${literal(workspace)} for no key update;select pg_sleep(0.7);${call(firstCommand, firstPayload, firstId)}commit;`,
    "outreach-race-first",
  );
  const allFirst = Promise.allSettled([first]);
  await waitFor("outreach-race-first", "Timeout");
  const second = query(
    `begin;${auth()}${call(secondCommand, secondPayload, secondId)}commit;`,
    "outreach-race-second",
  );
  const allSecond = Promise.allSettled([second]);
  await waitFor("outreach-race-second", "Lock");
  return [...(await allFirst), ...(await allSecond)];
}
const resultOf = (r) =>
  JSON.parse(r.value.split("\n").findLast((l) => l.startsWith("{")));
async function count(table, condition) {
  return Number(
    await query(`select count(*) from ${table} where ${condition};`),
  );
}
async function phase2Overlap(
  mode,
  reverse = false,
  command = "save_positioning",
) {
  const mixed = await json(
    `begin;${auth()}insert into opportunities(workspace_id,company_id,title,opportunity_stage) values(${literal(workspace)},${literal(company)},'Synthetic mixed-domain role',${literal(command === "pursue" ? "evaluating" : "pursuing")}) returning json_build_object('id',id,'updated_at',updated_at);commit;`,
  );
  let pkg = null,
    decision = null;
  if (command === "save_positioning")
    pkg = await json(
      `begin;${auth()}insert into application_packages(workspace_id,opportunity_id) values(${literal(workspace)},${literal(mixed.id)}) returning json_build_object('id',id,'updated_at',updated_at);commit;`,
    );
  else {
    const evaluation = await json(
      `begin;${auth()}insert into evaluations(workspace_id,opportunity_id) values(${literal(workspace)},${literal(mixed.id)}) returning json_build_object('id',id);commit;`,
    );
    await query(
      `begin;${auth()}update evaluations set candidate_fit_score=89,opportunity_fit_score=76,opportunity_type='mutual_fit',evidence_confidence='high',problem_translation='Synthetic employer need',recommended_next_action='pursue',evaluation_status='complete' where id=${literal(evaluation.id)};commit;`,
    );
    decision = await json(
      `begin;${auth()}insert into next_actions(workspace_id,opportunity_id,assigned_to_principal_id,action_type,title) values(${literal(workspace)},${literal(mixed.id)},${literal(principal)},'decide','Synthetic candidate pursuit decision') returning json_build_object('id',id,'updated_at',updated_at);commit;`,
    );
    mixed.updated_at = (
      await json(
        `select json_build_object('updated_at',updated_at) from opportunities where id=${literal(mixed.id)};`,
      )
    ).updated_at;
  }
  const person = await rpc("save_contact", {
    full_name: "Synthetic mixed-domain contact",
    source_system: "candidate",
  });
  const outreach = call("link_contact", {
    opportunity_id: mixed.id,
    contact_id: person.contact_id,
    selection_method: "manual",
    relevance: "Synthetic cross-domain race",
    source_system: "candidate",
  });
  const human = `select public.hq_human_action(${literal(workspace)},${literal(mixed.id)},${literal(mixed.updated_at)}::timestamptz,${literal(randomUUID())},${literal(command)},${literal(JSON.stringify(command === "pursue" ? { action_id: decision.id, action_updated_at: decision.updated_at } : { package_id: pkg.id, package_updated_at: pkg.updated_at, notes: "Exact mixed-race positioning" }))}::jsonb);`;
  let first, second;
  if (!reverse) {
    first = query(
      `begin;${auth()}select id from workspaces where id=${literal(workspace)} for ${mode};select pg_sleep(0.3);${outreach}commit;`,
      "mixed-outreach",
    );
    const pendingFirst = Promise.allSettled([first]);
    await waitFor("mixed-outreach", "Timeout");
    second = query(
      `begin;${auth()}select id from opportunities where id=${literal(mixed.id)} for update;select pg_sleep(0.6);${human}commit;`,
      "mixed-phase2",
    );
    const pendingSecond = Promise.allSettled([second]);
    await waitFor("mixed-phase2", "Timeout");
    await waitFor("mixed-outreach", "Lock");
    return {
      results: [...(await pendingFirst), ...(await pendingSecond)],
      mixed,
      pkg,
      person,
      decision,
    };
  }
  first = query(
    `begin;${auth()}select id from opportunities where id=${literal(mixed.id)} for update;select pg_sleep(0.3);${human}commit;`,
    "mixed-phase2",
  );
  const pendingFirst = Promise.allSettled([first]);
  await waitFor("mixed-phase2", "Timeout");
  second = query(`begin;${auth()}${outreach}commit;`, "mixed-outreach");
  const pendingSecond = Promise.allSettled([second]);
  await waitFor("mixed-outreach", "Lock");
  return {
    results: [...(await pendingFirst), ...(await pendingSecond)],
    mixed,
    pkg,
    person,
    decision,
  };
}
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
      `-h '' -k ${root} -p 55433 -c max_connections=10`,
      "-w",
      "start",
    ],
    { env: environment },
  );
  started = true;
  assert.equal(await query("show listen_addresses;"), "");
  await query(`create role anon;create role authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select,insert,update,delete on storage.objects to authenticated;
create schema auth;create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;
    create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb;$$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
    create function public.rls_auto_enable() returns event_trigger language plpgsql as $$begin return;end;$$;`);
  const migrations = new URL("../../supabase/migrations/", import.meta.url);
  let applied = 0;
  for (const name of (await readdir(migrations))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    if (name.endsWith("_agent_identity.sql")) continue;
    await query(await readFile(new URL(name, migrations), "utf8"));
    applied++;
  }
  await query(
    await readFile(
      new URL(
        "../../supabase/proposals/outreach/20261001230000_outreach_domain.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  console.log(
    `Replayed ${applied} unchanged migrations and Outreach proposal; skipped 2 production identity provisions`,
  );
  workspace = (
    await json(
      `insert into auth.users values(${literal(user)},'synthetic-native@example.invalid');select set_config('request.jwt.claim.sub',${literal(user)},false);select json_build_object('id',public.bootstrap_personal_workspace('Synthetic native Outreach','synthetic-native-outreach'));`,
    )
  ).id;
  principal = (
    await json(
      `select set_config('request.jwt.claim.sub',${literal(user)},false);select json_build_object('id',public.current_principal_id());`,
    )
  ).id;
  company = (
    await json(
      `begin;${auth()}insert into companies(workspace_id,name) values(${literal(workspace)},'Native synthetic company') returning json_build_object('id',id);commit;`,
    )
  ).id;
  opportunity = (
    await json(
      `begin;${auth()}insert into opportunities(workspace_id,company_id,title,opportunity_stage) values(${literal(workspace)},${literal(company)},'Native synthetic role','pursuing') returning json_build_object('id',id);commit;`,
    )
  ).id;

  let f = await fixture();
  let payload = {
    engagement_id: f.engagement,
    expected_revision: await revision(f.engagement),
    opportunity_id: opportunity,
    channel: "email",
    content: "Identical concurrent draft",
  };
  let results = await race("save_draft", payload, randomUUID());
  assert.ok(results.every((r) => r.status === "fulfilled"));
  assert.deepEqual(resultOf(results[0]), resultOf(results[1]));
  assert.equal(
    await count(
      "outreach_messages",
      `outreach_engagement_id=${literal(f.engagement)}`,
    ),
    1,
  );
  assert.equal(
    await count(
      "internal_tasks",
      `id=${literal(resultOf(results[0]).review_task_id)}`,
    ),
    1,
  );
  console.log(
    "PASS concurrent identical draft: one exact version/review task/action; observed Lock wait",
  );

  f = await fixture();
  const base = await draft(f);
  payload = {
    engagement_id: f.engagement,
    expected_revision: await revision(f.engagement),
    opportunity_id: opportunity,
    message_id: base.message_id,
    channel: "email",
    content: "Revision A",
  };
  results = await race(
    "save_draft",
    payload,
    randomUUID(),
    "save_draft",
    { ...payload, content: "Revision B" },
    randomUUID(),
  );
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.match(results[1].reason.message, /Engagement changed/);
  assert.equal(
    await count(
      "outreach_messages",
      `outreach_engagement_id=${literal(f.engagement)}`,
    ),
    2,
  );
  assert.equal(
    await count(
      "outreach_messages",
      `outreach_engagement_id=${literal(f.engagement)} and message_status='review'`,
    ),
    1,
  );
  console.log(
    "PASS competing draft revisions: stale loser rejected; one current version; observed Lock wait",
  );

  f = await fixture();
  const d = await draft(f);
  payload = {
    engagement_id: f.engagement,
    expected_revision: await revision(f.engagement),
    message_id: d.message_id,
    confirmed: true,
    exact_content: "Exact native concurrency draft",
    recipient: {
      name: "Synthetic native recruiter",
      address: "native@example.invalid",
    },
    sent_at: new Date().toISOString(),
    follow_up_at: new Date(Date.now() + 86400000).toISOString(),
  };
  results = await race("mark_sent", payload, randomUUID());
  assert.ok(results.every((r) => r.status === "fulfilled"));
  assert.deepEqual(resultOf(results[0]), resultOf(results[1]));
  assert.equal(
    await count(
      "outreach_task_links",
      `outreach_engagement_id=${literal(f.engagement)} and purpose='follow_up'`,
    ),
    1,
  );
  assert.equal(
    await count(
      "activity_events",
      `event_type='outreach_mark_sent' and details::jsonb->'result'->>'message_id'=${literal(d.message_id)}`,
    ),
    1,
  );
  console.log(
    "PASS identical mark-sent: one sent record/wait task/event; observed Lock wait; no transport",
  );

  f = await fixture();
  const pending = await draft(f);
  payload = {
    engagement_id: f.engagement,
    expected_revision: await revision(f.engagement),
    message_id: pending.message_id,
    confirmed: true,
    exact_content: "Exact native concurrency draft",
    recipient: {
      name: "Synthetic native recruiter",
      address: "native@example.invalid",
    },
    sent_at: new Date().toISOString(),
    follow_up_choice: "none",
  };
  results = await race(
    "mark_sent",
    payload,
    randomUUID(),
    "save_draft",
    {
      engagement_id: f.engagement,
      expected_revision: payload.expected_revision,
      opportunity_id: opportunity,
      message_id: pending.message_id,
      channel: "email",
      content: "Competing edited version",
    },
    randomUUID(),
  );
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.match(results[1].reason.message, /Engagement changed/);
  assert.equal(
    await count(
      "outreach_messages",
      `outreach_engagement_id=${literal(f.engagement)}`,
    ),
    1,
  );
  console.log(
    "PASS mark-sent versus edit: sent version wins atomically, edit rejected; observed Lock wait",
  );

  f = await fixture();
  payload = {
    engagement_id: f.engagement,
    expected_revision: await revision(f.engagement),
    opportunity_id: opportunity,
    channel: "email",
    content: "Exact native received reply",
    received_at: new Date().toISOString(),
    source_system: "gmail",
    external_reference: randomUUID(),
  };
  results = await race(
    "record_received",
    payload,
    randomUUID(),
    "record_received",
    payload,
    randomUUID(),
  );
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.equal(
    await count(
      "outreach_messages",
      `outreach_engagement_id=${literal(f.engagement)}`,
    ),
    1,
  );
  console.log(
    "PASS competing received-message records: one exact inbound/history/review; observed Lock wait",
  );

  // Native adversarial tenant read and controlled writer denial.
  // Prove the reviewed failure in this owned synthetic cluster, then restore
  // the exact candidate implementation and exercise real unchanged Phase 2 RPCs.
  const implementation = (
    await json(
      "select json_build_object('definition',pg_get_functiondef('private.hq_outreach_action(uuid,uuid,text,jsonb)'::regprocedure));",
    )
  ).definition;
  const historical = implementation.replace(
    "where id=target_workspace_id for no key update;",
    "where id=target_workspace_id for update;",
  );
  assert.notEqual(historical, implementation);
  await query(historical);
  const oldCycle = await phase2Overlap("update", false, "pursue");
  assert.equal(
    oldCycle.results.filter(
      (r) =>
        r.status === "rejected" && /deadlock detected/.test(r.reason.message),
    ).length,
    1,
  );
  assert.equal(
    oldCycle.results.filter((r) => r.status === "fulfilled").length,
    1,
  );
  console.log(
    "PASS reproduced historical Workspace UPDATE / exact unchanged Phase 2 Pursue deadlock in isolated cluster",
  );
  await query(implementation);
  for (const command of ["save_positioning", "pursue"])
    for (const reverse of [false, true]) {
      const mixed = await phase2Overlap("no key update", reverse, command);
      assert.ok(
        mixed.results.every((r) => r.status === "fulfilled"),
        JSON.stringify(
          mixed.results.map((r) =>
            r.status === "rejected" ? r.reason.message : r.status,
          ),
        ),
      );
      assert.equal(
        await count(
          "opportunity_contacts",
          `opportunity_id=${literal(mixed.mixed.id)} and contact_id=${literal(mixed.person.contact_id)}`,
        ),
        1,
      );
      if (command === "save_positioning")
        assert.equal(
          await query(
            `select candidate_notes from application_packages where id=${literal(mixed.pkg.id)};`,
          ),
          "Exact mixed-race positioning",
        );
      else {
        assert.equal(
          await query(
            `select opportunity_stage from opportunities where id=${literal(mixed.mixed.id)};`,
          ),
          "pursuing",
        );
        assert.equal(
          await query(
            `select status from next_actions where id=${literal(mixed.decision.id)};`,
          ),
          "completed",
        );
        assert.equal(
          await count(
            "internal_tasks",
            `opportunity_id=${literal(mixed.mixed.id)} and task_type='prepare_application_package' and domain='application' and status='ready' and trigger_type='candidate_action' and trigger_reference='candidate_decided_to_pursue'`,
          ),
          1,
        );
      }
      console.log(
        `PASS mixed Outreach / exact unchanged Phase 2 ${command} (${reverse ? "Phase 2 starts first" : "Outreach starts first"}): observed Lock wait; both exact operations committed without deadlock`,
      );
    }
  const foreign = randomUUID();
  await query(
    `insert into auth.users values(${literal(foreign)},'foreign-native@example.invalid');select set_config('request.jwt.claim.sub',${literal(foreign)},false);select public.bootstrap_personal_workspace('Foreign native','synthetic-foreign-native');`,
  );
  assert.equal(
    await query(
      `begin;select set_config('request.jwt.claim.sub',${literal(foreign)},true);set local role authenticated;select count(*) from contacts;rollback;`,
    ).then((s) => s.split("\n").at(-1)),
    "0",
  );
  await assert.rejects(
    query(
      `begin;select set_config('request.jwt.claim.sub',${literal(foreign)},true);set local role authenticated;${call("save_contact", { full_name: "Foreign", source_system: "candidate" })}commit;`,
    ),
    /active workspace/,
  );
  console.log("PASS native tenant isolation and controlled RPC denial");

  // Local equivalents of applicable advisor checks for proposed objects. The
  // hosted advisors cannot inspect a migration that is deliberately not live.
  const proposed =
    "('contacts','opportunity_contacts','outreach_engagements','outreach_engagement_opportunities','outreach_messages','outreach_message_evidence','outreach_interactions','relationship_notes','outreach_task_links','outreach_action_requests')";
  assert.equal(
    await query(
      `select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ${proposed} and not c.relrowsecurity;`,
    ),
    "0",
  );
  assert.equal(
    await query(
      `select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ${proposed} and (has_table_privilege('anon',c.oid,'SELECT') or has_table_privilege('authenticated',c.oid,'INSERT') or has_table_privilege('authenticated',c.oid,'UPDATE') or has_table_privilege('authenticated',c.oid,'DELETE'));`,
    ),
    "0",
  );
  assert.equal(
    await query(
      `select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='hq_outreach_action' and p.prosecdef;`,
    ),
    "0",
  );
  const missing = await query(
    `select c.relname||':'||fk.conname from pg_constraint fk join pg_class c on c.oid=fk.conrelid where fk.contype='f' and c.relname in ${proposed} and not exists(select 1 from pg_index i where i.indrelid=fk.conrelid and i.indisvalid and i.indpred is null and (i.indkey::smallint[])[0:array_length(fk.conkey,1)-1] @> fk.conkey);`,
  );
  assert.equal(missing, "");
  assert.equal(
    await query(
      "select relrowsecurity from pg_class where oid='private.outreach_action_requests'::regclass;",
    ),
    "t",
  );
  assert.equal(
    await query(
      "select has_table_privilege('authenticated','private.outreach_action_requests','SELECT');",
    ),
    "f",
  );
  assert.equal(
    await query(
      "select count(*) from activity_events where event_type like 'outreach_%' and details::jsonb ? 'request';",
    ),
    "0",
  );
  console.log(
    "PASS local security/performance catalog checks: all new tables RLS, no anon/raw writes/public definer, all new FKs indexed",
  );
  assert.equal(
    await query(
      `select opportunity_stage from opportunities where id=${literal(opportunity)};`,
    ),
    "pursuing",
  );
  assert.ok(principal);
  console.log(
    "PASS backend Opportunity lifecycle unchanged; production untouched",
  );
  const retained = await query("select count(*) from outreach_messages;");
  await query(
    await readFile(
      new URL(
        "../../supabase/proposals/outreach/disable_outreach_writes.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(
    await query(
      "select has_function_privilege('authenticated','public.hq_outreach_action(uuid,uuid,text,jsonb)','EXECUTE');",
    ),
    "f",
  );
  assert.equal(
    await query(
      "select has_function_privilege('authenticated','private.hq_outreach_action(uuid,uuid,text,jsonb)','EXECUTE');",
    ),
    "f",
  );
  assert.equal(
    await query("select count(*) from outreach_messages;"),
    retained,
  );
  console.log(
    "PASS native forward-disable rollback: both write entry points revoked, exact history retained",
  );
} finally {
  if (started)
    await exec(
      join(binaryDirectory, "pg_ctl"),
      ["-D", data, "-m", "fast", "-w", "stop"],
      { env: environment },
    );
  await rm(root, { recursive: true, force: true });
}
