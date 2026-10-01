import { runNative } from "./native-domain-harness.mjs";
import { checkLedger } from "./native-ledger-check.mjs";
await runNative("interview", async (h) => {
  const {
    query,
    json,
    fixture,
    race,
    rpcResult,
    literal: l,
    randomUUID,
    assert,
  } = h;
  const source = () => ({
    verified: true,
    source_system: "synthetic",
    source_reference: randomUUID(),
    interview_type: "Panel",
    scheduled_start_at: "2026-11-01T12:00:00Z",
    instructions: "PRIVATE_INTERVIEW_LEDGER_MARKER",
  });
  let f = await fixture();
  let results = await race(
    f,
    "record_verified_interview",
    source(),
    randomUUID(),
  );
  assert.ok(results.every((r) => r.status === "fulfilled"));
  assert.deepEqual(rpcResult(results[0]), rpcResult(results[1]));
  assert.equal(
    await query(
      `select count(*) from interviews where opportunity_id=${l(f.id)}`,
    ),
    "1",
  );
  assert.equal(
    await query(
      `select count(*) from activity_events where opportunity_id=${l(f.id)} and event_type like 'interview_%'`,
    ),
    "1",
  );
  console.log(
    "PASS Interview identical source retry: observed Lock; one interview/event and exact result",
  );
  const interview = await json(
    `select row_to_json(i) from interviews i where opportunity_id=${l(f.id)}`,
  );
  f.updated_at = (
    await json(`select row_to_json(o) from opportunities o where id=${l(f.id)}`)
  ).updated_at;
  results = await race(
    f,
    "start_prep",
    { interview_id: interview.id, interview_updated_at: interview.updated_at },
    randomUUID(),
  );
  assert.ok(results.every((r) => r.status === "fulfilled"));
  assert.deepEqual(rpcResult(results[0]), rpcResult(results[1]));
  console.log(
    "PASS Interview identical prep start retry: observed Lock and identical result",
  );
  const prep = await json(
    `select row_to_json(p) from interview_preparations p where interview_id=${l(interview.id)}`,
  );
  const payload = {
    interview_id: interview.id,
    preparation_id: prep.id,
    preparation_updated_at: prep.updated_at,
    summary: "PRIVATE_INTERVIEW_LEDGER_MARKER",
    reviewed: true,
  };
  results = await race(
    f,
    "save_prep",
    payload,
    randomUUID(),
    "save_prep",
    { ...payload, summary: "Competing stale preparation" },
    randomUUID(),
  );
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.match(
    results[1].reason.message,
    /Editable preparation|Preparation changed/,
  );
  assert.equal(
    await query(
      `select count(*) from activity_events where opportunity_id=${l(f.id)} and event_type='interview_save_prep'`,
    ),
    "1",
  );
  assert.equal(
    await query(
      `select count(*) from interview_preparations where interview_id=${l(interview.id)} and summary='PRIVATE_INTERVIEW_LEDGER_MARKER' and status='reviewed'`,
    ),
    "1",
  );
  console.log(
    "PASS Interview competing final reviews: observed Lock; stale loser rejected and winner immutable",
  );
  const conflict = await fixture(),
    input = source(),
    request = randomUUID();
  const different = { ...input, source_reference: randomUUID() };
  results = await race(
    conflict,
    "record_verified_interview",
    input,
    request,
    "record_verified_interview",
    different,
    request,
  );
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.match(results[1].reason.message, /input mismatch/);
  console.log(
    "PASS interview concurrent reused request with changed input: observed Lock; mismatch rejected",
  );
  await checkLedger(h, "interview", "PRIVATE_INTERVIEW_LEDGER_MARKER");
});
