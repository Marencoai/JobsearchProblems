import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
// Exact pinned proposed Outreach SQL; no caller credentials inherited by the harness.
export async function checkCrossDomain(h, domain) {
  const {
    query,
    json,
    auth,
    fixture,
    call,
    literal: l,
    workspace,
    randomUUID,
    assert,
  } = h;
  if (!process.env.HQ_OUTREACH_PROPOSAL)
    throw new Error("Pass the pinned test-only HQ_OUTREACH_PROPOSAL path");
  const sql = await readFile(process.env.HQ_OUTREACH_PROPOSAL, "utf8");
  assert.equal(
    createHash("sha256").update(sql).digest("hex"),
    "b6162b864581cdfac8b043b79ff8038cd8ae7e8d169712195dc679f10c65c906",
  );
  await query(sql);
  const contact = await json(
    `begin;${auth()}select hq_outreach_action(${l(workspace)},${l(randomUUID())},'save_contact','{"full_name":"Synthetic concurrent contact","source_system":"synthetic"}'::jsonb);commit;`,
  );
  const wait = async (name, type) => {
    for (let n = 0; n < 200; n++) {
      if (
        (await query(
          `select count(*) from pg_stat_activity where application_name=${l(name)} and wait_event_type=${l(type)}`,
        )) === "1"
      )
        return;
      await new Promise((r) => setTimeout(r, 5));
    }
    throw new Error("Expected concurrent lock/sleep was not observed");
  };
  for (const direction of ["outreach-first", "domain-first"]) {
    const f = await fixture();
    const input = {
      contact_id: contact.contact_id,
      opportunity_id: f.id,
      selection_method: "recommended",
      relevance: "Synthetic exact role",
      source_system: "synthetic",
    };
    const outreach = `select hq_outreach_action(${l(workspace)},${l(randomUUID())},'link_contact',${l(JSON.stringify(input))}::jsonb);`;
    const source = {
      verified: true,
      source_system: "synthetic",
      source_reference: randomUUID(),
      ...(domain === "interview"
        ? {
            interview_type: "Panel",
            scheduled_start_at: "2026-11-01T12:00:00Z",
          }
        : {
            received_at: "2026-10-01T12:00:00Z",
            terms: { currency: "USD", base: 140000 },
          }),
    };
    const invoke = call(
      f,
      domain === "interview" ? "record_verified_interview" : "record_offer",
      source,
      randomUUID(),
    );
    const first = query(
      `begin;${auth()}select id from ${direction === "outreach-first" ? "workspaces" : "opportunities"} where id=${l(direction === "outreach-first" ? workspace : f.id)} for ${direction === "outreach-first" ? "update" : "no key update"};select pg_sleep(1);${direction === "outreach-first" ? outreach : invoke}commit;`,
      "cross-first",
    );
    await wait("cross-first", "Timeout");
    const second = query(
      `begin;${auth()}${direction === "outreach-first" ? invoke : outreach}commit;`,
      "cross-second",
    );
    const settled = Promise.allSettled([first, second]);
    if (direction === "outreach-first") await wait("cross-second", "Lock");
    const results = await settled;
    for (const r of results)
      assert.equal(
        r.status,
        "fulfilled",
        r.status === "rejected" ? r.reason.message : "",
      );
    assert.equal(
      await query(
        `select count(*) from opportunity_contacts where opportunity_id=${l(f.id)}`,
      ),
      "1",
    );
    assert.equal(
      await query(
        `select count(*) from ${domain === "interview" ? "interviews" : "offers"} where opportunity_id=${l(f.id)}`,
      ),
      "1",
    );
    assert.equal(
      await query(
        `select count(*) from activity_events where opportunity_id=${l(f.id)} and event_type=${l(domain === "interview" ? "interview_record_verified_interview" : "offer_record_offer")}`,
      ),
      "1",
    );
    console.log(
      `PASS ${domain}/${direction}: overlapping exact RPCs commit once without deadlock; ${direction === "outreach-first" ? "second Lock wait observed" : "Outreach FK lock compatible with held Opportunity lock"}`,
    );
  }
}
