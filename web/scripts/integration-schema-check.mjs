import { runNative } from "./native-domain-harness.mjs";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
await runNative("interview", async (h) => {
  const {
    query,
    json,
    auth,
    fixture,
    call,
    workspace,
    user,
    principal,
    literal: l,
    randomUUID,
    assert,
  } = h;
  const pinned = [
    [
      "outreach/20261001230000_outreach_domain.sql",
      "9a8dffce9152ffa51220c5da6787d1c87f4444b11d4b21b3b697f6c04c194e6b",
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
  for (const [file, hash] of pinned) {
    const sql = await readFile(
      new URL(`../../supabase/proposals/${file}`, import.meta.url),
      "utf8",
    );
    assert.equal(createHash("sha256").update(sql).digest("hex"), hash);
    await query(sql);
  }
  const f = await fixture();
  const interview = await json(
    `begin;${auth()}${call(f, "record_verified_interview", { verified: true, source_system: "synthetic", source_reference: randomUUID(), interview_type: "Panel", scheduled_start_at: "2026-11-01T12:00:00Z" }, randomUUID())}commit;`,
  );
  const contact = await json(
    `begin;${auth()}select hq_outreach_action(${l(workspace)},${l(randomUUID())},'save_contact','{"full_name":"Canonical synthetic interviewer","source_system":"manual"}'::jsonb);commit;`,
  );
  await query(
    `begin;${auth()}insert into interview_contacts(workspace_id,interview_id,contact_id,interviewer_role,is_primary) values(${l(workspace)},${l(interview.interview_id)},${l(contact.contact_id)},'hiring_manager',true);commit;`,
  );
  const offerRole = await fixture();
  await query(
    `begin;${auth()}select hq_offer_action(${l(workspace)},${l(offerRole.id)},${l(offerRole.updated_at)},${l(randomUUID())},'record_offer','{"verified":true,"source_system":"synthetic","source_reference":"combined-schema-offer","received_at":"2026-10-02T12:00:00Z","terms":{"currency":"USD","base":150000}}'::jsonb);commit;`,
  );
  const current = await json(
    `select row_to_json(o) from opportunities o where id=${l(f.id)}`,
  );
  await query(
    `begin;${auth()}select hq_request_research_refresh(${l(workspace)},${l(f.id)},${l(current.updated_at)},${l(randomUUID())});commit;`,
  );
  assert.equal(
    await query(
      `select count(*) from interview_contacts j join contacts c on c.id=j.contact_id and c.workspace_id=j.workspace_id where j.interview_id=${l(interview.interview_id)}`,
    ),
    "1",
  );
  assert.equal(
    await query(
      `select count(*) from offers where opportunity_id=${l(offerRole.id)}`,
    ),
    "1",
  );
  assert.equal(
    await query(
      `select count(*) from internal_tasks where opportunity_id=${l(f.id)} and task_type='refresh_company_intelligence'`,
    ),
    "1",
  );
  const tables = [
    "contacts",
    "opportunity_contacts",
    "outreach_engagements",
    "outreach_engagement_opportunities",
    "outreach_messages",
    "outreach_message_evidence",
    "outreach_interactions",
    "relationship_notes",
    "outreach_task_links",
    "interview_processes",
    "interviews",
    "interview_contacts",
    "interview_preparations",
    "interview_questions",
    "interview_question_evidence",
    "offers",
    "offer_terms",
    "offer_negotiations",
    "offer_decisions",
    "application_material_artifacts",
  ];
  assert.equal(
    await query(
      `select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in(${tables.map(l).join(",")}) and c.relrowsecurity`,
    ),
    String(tables.length),
  );
  const foreignUser = randomUUID();
  await query(
    `insert into auth.users(id,email) values(${l(foreignUser)},'combined-foreign@example.invalid');select set_config('request.jwt.claim.sub',${l(foreignUser)},false);select bootstrap_personal_workspace('Combined foreign','combined-foreign');`,
  );
  const foreignAuth = `select set_config('request.jwt.claim.sub',${l(foreignUser)},true);set local role authenticated;`;
  for (const table of tables) {
    const count = await query(
      `begin;${foreignAuth}select count(*) from ${table} where workspace_id=${l(workspace)};commit;`,
    );
    assert.equal(count.split("\n").at(-1), "0");
    await assert.rejects(
      query(`begin;set local role anon;select count(*) from ${table};commit;`),
      /permission denied/,
    );
  }
  const agentRole = await fixture();
  await query(
    `update principals set principal_type='agent' where id=${l(principal)};`,
  );
  const denied = [
    `select hq_outreach_action(${l(workspace)},${l(randomUUID())},'add_manual_target','{}'::jsonb)`,
    call(
      agentRole,
      "record_verified_interview",
      {
        verified: true,
        source_system: "synthetic",
        source_reference: randomUUID(),
        interview_type: "Panel",
        scheduled_start_at: "2026-11-01T12:00:00Z",
      },
      randomUUID(),
    ),
    `select hq_offer_action(${l(workspace)},${l(offerRole.id)},${l(offerRole.updated_at)},${l(randomUUID())},'record_offer','{}'::jsonb)`,
    `select hq_request_research_refresh(${l(workspace)},${l(f.id)},${l(current.updated_at)},${l(randomUUID())})`,
  ];
  for (const operation of denied)
    await assert.rejects(
      query(`begin;${auth()}${operation};commit;`),
      /human|denied|not permitted|permission|authorized/i,
    );
  await query(
    `update principals set principal_type='human' where id=${l(principal)};select set_config('request.jwt.claim.sub',${l(user)},false);`,
  );
  console.log(
    "PASS complete exact proposed schema coexists: Interview canonical Contact FK, Offer terms, Research queue, 20 tables RLS, foreign/anonymous isolation, agent human-action denial; production untouched",
  );
});
