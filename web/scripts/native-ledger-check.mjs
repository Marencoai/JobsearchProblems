export async function checkLedger(h, domain, marker) {
  const {
    query,
    json,
    auth,
    literal: l,
    user,
    workspace,
    principal,
    randomUUID,
    assert,
  } = h;
  const table = `hq_${domain}_action_requests`;
  assert.notEqual(
    await query(`begin;${auth()} select count(*) from ${table};commit;`),
    "0",
  );
  assert.equal(
    await query(
      `select count(*) from activity_events where details like ${l("%" + marker + "%")}`,
    ),
    "0",
  );
  await assert.rejects(
    query(`begin;${auth()} update ${table} set result='{}';commit;`),
    /permission denied/,
  );
  await assert.rejects(
    query(`begin;${auth()} delete from ${table};commit;`),
    /permission denied/,
  );
  const other = randomUUID();
  await query(
    `insert into auth.users(id,email) values(${l(other)},'synthetic-ledger-other@example.invalid');select set_config('request.jwt.claim.sub',${l(other)},false);select bootstrap_personal_workspace('Ledger other','ledger-other');`,
  );
  const second = (
    await json(
      `select set_config('request.jwt.claim.sub',${l(other)},false);select json_build_object('id',current_principal_id());`,
    )
  ).id;
  const otherAuth = `do $$ begin perform set_config('request.jwt.claim.sub',${l(other)},true); end $$;set local role authenticated;`;
  assert.equal(
    await query(`begin;${otherAuth}select count(*) from ${table};commit;`),
    "0",
  );
  await query(
    `select set_config('request.jwt.claim.sub',${l(user)},false);insert into workspace_memberships(workspace_id,principal_id,role_id) select ${l(workspace)},${l(second)},role_id from workspace_memberships where workspace_id=${l(workspace)} and principal_id=${l(principal)};`,
  );
  assert.equal(
    await query(
      `begin;${otherAuth}select has_permission(${l(workspace)},${l(domain + ".manage")});commit;`,
    ),
    "t",
  );
  assert.equal(
    await query(`begin;${otherAuth}select count(*) from ${table};commit;`),
    "0",
  );
  const entry = await json(`select row_to_json(r) from ${table} r limit 1`);
  await assert.rejects(
    query(
      `begin;${otherAuth}insert into ${table}(workspace_id,actor_principal_id,request_id,request,result,activity_event_id) values(${l(workspace)},${l(principal)},${l(randomUUID())},${l(JSON.stringify(entry.request))}::jsonb,${l(JSON.stringify(entry.result))}::jsonb,${l(entry.activity_event_id)});commit;`,
    ),
    /row-level security/,
  );
  await query(
    `update principals set principal_type='agent' where id=${l(principal)};`,
  );
  assert.equal(
    await query(`begin;${auth()}select count(*) from ${table};commit;`),
    "0",
  );
  await query(
    `update principals set principal_type='human' where id=${l(principal)};select set_config('request.jwt.claim.sub',${l(other)},false);update workspace_memberships set status='suspended' where workspace_id=${l(workspace)} and principal_id=${l(principal)};`,
  );
  assert.equal(
    await query(`begin;${auth()}select count(*) from ${table};commit;`),
    "0",
  );
  await query(
    `select set_config('request.jwt.claim.sub',${l(other)},false);update workspace_memberships set status='active' where workspace_id=${l(workspace)} and principal_id=${l(principal)};delete from role_permissions where permission_id in(select id from permissions where permission_key=${l(domain + ".manage")});`,
  );
  assert.equal(
    await query(`begin;${auth()}select count(*) from ${table};commit;`),
    "0",
  );
  console.log(
    `PASS ${domain} private ledger: foreign tenant/same-workspace Owner/agent/suspended/missing permission denied; append-only and generic Activity contains no sensitive marker`,
  );
}
