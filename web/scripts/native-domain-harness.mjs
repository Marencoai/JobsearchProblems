// A disposable native PostgreSQL cluster, private Unix socket, no TCP listener,
// no inherited database credentials, and exclusively synthetic test records.
// Usage: node scripts/concurrency-check.mjs /absolute/postgres/bin /absolute/psql
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, chmod, readFile, readdir, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";

export async function runNative(selectedDomain, run) {
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
    `do $$ begin perform set_config('request.jwt.claim.sub',${literal(user)},true); end $$; set local role authenticated;`;
  const domain = selectedDomain;
  const call = (f, command, payload, request) =>
    `select public.hq_${domain}_action(${literal(workspace)},${literal(f.id)},${literal(f.updated_at)},${literal(request)},${literal(command)},${literal(JSON.stringify(payload))}::jsonb);`;
  async function fixture() {
    return json(`begin; ${auth()}
    with company as (insert into companies(workspace_id,name) values(${literal(workspace)},'Synthetic company') returning id),
    opportunity as (insert into opportunities(workspace_id,company_id,title,opportunity_stage) select ${literal(workspace)},id,'Synthetic concurrent role','pursuing' from company returning id,updated_at),
    evaluation as (insert into evaluations(workspace_id,opportunity_id) select ${literal(workspace)},id from opportunity returning id,opportunity_id),
    decision as (insert into next_actions(workspace_id,opportunity_id,assigned_to_principal_id,action_type,title) select ${literal(workspace)},id,${literal(principal)},'decide','Synthetic decision' from opportunity returning id,updated_at)
    select json_build_object('id',o.id,'updated_at',o.updated_at,'evaluation_id',e.id,'action_id',d.id,'action_updated_at',d.updated_at) from opportunity o,evaluation e,decision d;
    commit;`);
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
    JSON.parse(
      result.value.split("\n").findLast((line) => line.startsWith("{")),
    );
  let started = false;
  try {
    const version = (
      await exec(join(binaryDirectory, "postgres"), ["--version"], {
        env: environment,
      })
    ).stdout.trim();
    assert.equal(version, "postgres (PostgreSQL) 17.6");
    console.log(version);
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
    await query(
      await readFile(
        new URL(
          `../../supabase/proposals/${domain}/001_${domain}.sql`,
          import.meta.url,
        ),
        "utf8",
      ),
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

    await run({
      query,
      json,
      auth,
      call,
      fixture,
      race,
      rpcResult,
      literal,
      user,
      workspace,
      principal,
      randomUUID,
      assert,
    });
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
}
