import { runNative } from "./native-domain-harness.mjs";
import { readFile } from "node:fs/promises";
await runNative("interview", async (h) => {
  const {
    query,
    json,
    auth,
    call,
    literal: l,
    workspace,
    principal,
    randomUUID,
    assert,
  } = h;
  await query(
    await readFile(
      new URL(
        "../../supabase/proposals/outreach/20261001230000_outreach_domain.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const contact = await json(
    `begin;${auth()}select hq_outreach_action(${l(workspace)},${l(randomUUID())},'save_contact','{"full_name":"Synthetic lock contact","source_system":"synthetic"}'::jsonb);commit;`,
  );
  async function fixture() {
    return json(`begin; ${auth()}
    with company as (insert into companies(workspace_id,name) values(${l(workspace)},'Synthetic company') returning id),
    opportunity as (insert into opportunities(workspace_id,company_id,title,opportunity_stage) select ${l(workspace)},id,'Synthetic concurrent role','evaluating' from company returning id,updated_at),
    evaluation as (insert into evaluations(workspace_id,opportunity_id) select ${l(workspace)},id from opportunity returning id,opportunity_id),
    decision as (insert into next_actions(workspace_id,opportunity_id,assigned_to_principal_id,action_type,title) select ${l(workspace)},id,${l(principal)},'decide','Synthetic decision' from opportunity returning id,updated_at)
    select json_build_object('id',o.id,'updated_at',o.updated_at,'evaluation_id',e.id,'action_id',d.id,'action_updated_at',d.updated_at) from opportunity o,evaluation e,decision d;
    commit;`);
  }

  const f = await fixture();
  await query(
    `begin;${auth()}update evaluations set candidate_fit_score=90,opportunity_fit_score=85,opportunity_type='mutual_fit',evidence_confidence='high',problem_translation='Synthetic evidence',recommended_next_action='pursue',evaluation_status='complete' where id=${l(f.evaluation_id)};commit;`,
  );
  const input = {
    contact_id: contact.contact_id,
    opportunity_id: f.id,
    selection_method: "recommended",
    relevance: "Synthetic exact role",
    source_system: "synthetic",
  };
  const first = query(
    `begin;${auth()}select id from workspaces where id=${l(workspace)} for no key update;select pg_sleep(1);select hq_outreach_action(${l(workspace)},${l(randomUUID())},'link_contact',${l(JSON.stringify(input))}::jsonb);commit;`,
    "review-workspace-first",
  );
  const pending = [first];
  let settled;
  const observed = async (name, event) => {
    for (let i = 0; i < 200; i++) {
      if (
        (await query(
          `select count(*) from pg_stat_activity where application_name=${l(name)} and wait_event_type=${l(event)}`,
        )) === "1"
      )
        return;
      await new Promise((r) => setTimeout(r, 5));
    }
    throw new Error("Lock observation failed");
  };
  await observed("review-workspace-first", "Timeout");
  const source = {
    verified: true,
    source_system: "synthetic",
    source_reference: randomUUID(),
    interview_type: "Panel",
    scheduled_start_at: "2026-11-01T12:00:00Z",
  };
  const second = query(
    `begin;${auth()}select id from opportunities where id=${l(f.id)} for update;select hq_human_action(${l(workspace)},${l(f.id)},${l(f.updated_at)},${l(randomUUID())},'pursue',${l(JSON.stringify({ action_id: f.action_id, action_updated_at: f.action_updated_at }))}::jsonb);commit;`,
    "review-opportunity-first",
  );
  settled = Promise.allSettled([first, second]);

  const results = await settled;
  for (const result of results)
    assert.equal(
      result.status,
      "fulfilled",
      result.status === "rejected" ? result.reason.message : "",
    );
  assert.equal(
    await query(
      `select count(*) from opportunity_contacts where opportunity_id=${l(f.id)}`,
    ),
    "1",
  );
  assert.equal(
    await query(
      `select opportunity_stage from opportunities where id=${l(f.id)}`,
    ),
    "pursuing",
  );
  console.log(
    "PASS unchanged Phase2 Opportunity FOR UPDATE with proposed Outreach Workspace FOR NO KEY UPDATE: both complete, one link, human pursue recorded",
  );
});
