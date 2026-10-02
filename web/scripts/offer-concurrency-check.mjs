import { runNative } from "./native-domain-harness.mjs";
import { checkLedger } from "./native-ledger-check.mjs";
await runNative("offer", async (h) => {
  const {
    query,
    json,
    auth,
    call,
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
    received_at: "2026-10-01T12:00:00Z",
    terms: {
      currency: "USD",
      base: 140000,
      terms_notes: "PRIVATE_OFFER_LEDGER_MARKER",
    },
  });
  async function current(f) {
    const offer = await json(
      `select row_to_json(f) from offers f where opportunity_id=${l(f.id)}`,
    );
    const term = await json(
      `select row_to_json(t) from offer_terms t where offer_id=${l(offer.id)} order by version_number desc limit 1`,
    );
    f.updated_at = (
      await json(
        `select row_to_json(o) from opportunities o where id=${l(f.id)}`,
      )
    ).updated_at;
    return {
      offer_id: offer.id,
      offer_updated_at: offer.updated_at,
      offer_terms_id: term.id,
    };
  }
  async function recorded() {
    const f = await fixture();
    await query(
      `begin;${auth()} ${call(f, "record_offer", source(), randomUUID())}commit;`,
    );
    return f;
  }
  let f = await fixture();
  let results = await race(f, "record_offer", source(), randomUUID());
  assert.ok(results.every((r) => r.status === "fulfilled"));
  assert.deepEqual(rpcResult(results[0]), rpcResult(results[1]));
  assert.equal(
    await query(`select count(*) from offers where opportunity_id=${l(f.id)}`),
    "1",
  );
  console.log(
    "PASS Offer identical receipt retry: observed Lock; one offer and exact result",
  );
  let payload = {
    ...(await current(f)),
    terms: { currency: "USD", base: 150000 },
  };
  results = await race(
    f,
    "revise_terms",
    payload,
    randomUUID(),
    "revise_terms",
    { ...payload, terms: { currency: "USD", base: 160000 } },
    randomUUID(),
  );
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.match(results[1].reason.message, /Offer changed|latest exact/);
  assert.equal(
    await query(
      `select count(*) from offer_terms where offer_id=${l(payload.offer_id)}`,
    ),
    "2",
  );
  console.log(
    "PASS Offer competing terms: observed Lock; exactly one new version, stale loser rejected",
  );
  payload = {
    ...(await current(f)),
    reason: "PRIVATE_OFFER_LEDGER_MARKER",
    confirmed: true,
  };
  results = await race(
    f,
    "accept",
    payload,
    randomUUID(),
    "decline",
    { ...payload, reason: "Competing decline" },
    randomUUID(),
  );
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.match(
    results[1].reason.message,
    /Opportunity changed|Active opportunity/,
  );
  assert.equal(
    await query(
      `select count(*) from offer_decisions where offer_id=${l(payload.offer_id)}`,
    ),
    "1",
  );
  assert.equal(
    await query(`select status from offers where id=${l(payload.offer_id)}`),
    "accepted",
  );
  console.log(
    "PASS Offer competing Accept/Decline: observed Lock; one exact-terms decision and immutable winner",
  );
  f = await recorded();
  payload = {
    ...(await current(f)),
    reason: "Synthetic explicit decline",
    confirmed: true,
  };
  results = await race(f, "decline", payload, randomUUID());
  assert.ok(results.every((r) => r.status === "fulfilled"));
  assert.deepEqual(rpcResult(results[0]), rpcResult(results[1]));
  assert.equal(
    await query(
      `select count(*) from offer_decisions where offer_id=${l(payload.offer_id)}`,
    ),
    "1",
  );
  console.log(
    "PASS Offer identical terminal retry: observed Lock; one decision and exact result",
  );
  const conflict = await fixture(),
    input = source(),
    request = randomUUID();
  const different = { ...input, source_reference: randomUUID() };
  results = await race(
    conflict,
    "record_offer",
    input,
    request,
    "record_offer",
    different,
    request,
  );
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.match(results[1].reason.message, /input mismatch/);
  console.log(
    "PASS offer concurrent reused request with changed input: observed Lock; mismatch rejected",
  );
  await checkLedger(h, "offer", "PRIVATE_OFFER_LEDGER_MARKER");
});
