import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { databaseHarness } from "./database-harness";
let db: PGlite, workspace: string, opportunity: string, principal: string;
const user = randomUUID();
type Data = Record<string, unknown>;
async function row(sql: string, args: unknown[] = []) {
  return (await db.query<Data>(sql, args)).rows[0];
}
async function safe(sql: string, args: unknown[] = []) {
  await db.exec("savepoint attempt");
  try {
    const value = await row(sql, args);
    await db.exec("release savepoint attempt");
    return value;
  } catch (e) {
    await db.exec("rollback to savepoint attempt; release savepoint attempt");
    throw e;
  }
}
async function rpc(
  command: string,
  payload: Data,
  id = randomUUID(),
  version?: unknown,
) {
  return safe("select hq_offer_action($1,$2,$3,$4,$5,$6) as result", [
    workspace,
    opportunity,
    version ??
      (
        await row("select updated_at from opportunities where id=$1", [
          opportunity,
        ])
      ).updated_at,
    id,
    command,
    payload,
  ]);
}
const source = () => ({
  verified: true,
  source_system: "synthetic",
  source_reference: randomUUID(),
  received_at: "2026-10-01T12:00:00Z",
  terms: {
    currency: "USD",
    base: 140000,
    variable: 60000,
    ote: 200000,
    equity: "Options",
    quota: "1.5M ARR",
    ramp: "Six months",
    territory: "West",
    benefits_notes: "Synthetic health plan",
    location_travel: "Remote with travel",
  },
});
async function current() {
  const offer = await row("select * from offers");
  const term = await row(
    "select * from offer_terms order by version_number desc limit 1",
  );
  return {
    offer_id: offer.id,
    offer_updated_at: offer.updated_at,
    offer_terms_id: term.id,
  };
}
beforeAll(async () => {
  ({ db } = await databaseHarness());
  await db.exec(
    await readFile(
      new URL("../../supabase/proposals/offer/001_offer.sql", import.meta.url),
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec("begin");
  await db.query(
    "insert into auth.users(id,email) values($1,'offer@example.invalid')",
    [user],
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
  workspace = (
    await row(
      "select bootstrap_personal_workspace('Offer fixture','offer-fixture') as id",
    )
  ).id as string;
  principal = (await row("select current_principal_id() as id")).id as string;
  await db.exec("set local role authenticated");
  const company = await row(
    "insert into companies(workspace_id,name) values($1,'Synthetic employer') returning id",
    [workspace],
  );
  opportunity = (
    await row(
      "insert into opportunities(workspace_id,company_id,title,opportunity_stage) values($1,$2,'Synthetic offer role','interviewing') returning id",
      [workspace, company.id],
    )
  ).id as string;
});
afterEach(async () => {
  await db.exec("rollback");
});
it("records exact structured terms, stage, history and action atomically, retries once", async () => {
  const payload = source(),
    id = randomUUID(),
    version = (await row("select updated_at from opportunities")).updated_at;
  const first = await rpc("record_offer", payload, id, version);
  expect(await rpc("record_offer", payload, id, version)).toEqual(first);
  expect(
    (await row("select opportunity_stage from opportunities"))
      .opportunity_stage,
  ).toBe("offer");
  expect(
    await row(
      "select base::int,variable::int,ote::int,version_number from offer_terms",
    ),
  ).toEqual({ base: 140000, variable: 60000, ote: 200000, version_number: 1 });
  for (const table of [
    "offers",
    "offer_terms",
    "activity_events",
    "next_actions",
  ])
    expect((await row(`select count(*)::int as n from ${table}`)).n).toBe(1);
  await expect(
    rpc(
      "record_offer",
      { ...payload, received_at: "2026-10-02T00:00:00Z" },
      id,
      version,
    ),
  ).rejects.toThrow("mismatch");
});
it("preserves original terms and append-only negotiations when terms are revised", async () => {
  await rpc("record_offer", source());
  await rpc("negotiate", {
    ...(await current()),
    entry_type: "plan",
    exact_text: "Ask about quota and sign-on",
  });
  await rpc("revise_terms", {
    ...(await current()),
    terms: { currency: "USD", base: 150000, variable: 60000, ote: 210000 },
  });
  expect((await row("select count(*)::int as n from offer_terms")).n).toBe(2);
  expect(
    (await row("select base::int from offer_terms where version_number=1"))
      .base,
  ).toBe(140000);
  expect(
    (await row("select exact_text from offer_negotiations")).exact_text,
  ).toBe("Ask about quota and sign-on");
  await expect(
    safe("update offer_terms set base=1 returning id"),
  ).rejects.toThrow();
  await expect(
    safe("delete from offer_negotiations returning id"),
  ).rejects.toThrow();
});
it("explicit latest-version decision freezes history, closes using existing other reason and completes only linked action", async () => {
  await rpc("record_offer", source());
  await row(
    "insert into next_actions(workspace_id,opportunity_id,action_type,title) values($1,$2,'decide','Unrelated decision')",
    [workspace, opportunity],
  );
  const payload = {
      ...(await current()),
      confirmed: true,
      reason: "Reviewed terms meet my goals",
    },
    id = randomUUID(),
    version = (await row("select updated_at from opportunities")).updated_at;
  await rpc("accept", payload, id, version);
  await rpc("accept", payload, id, version);
  expect(await row("select status,final_decision from offers")).toEqual({
    status: "accepted",
    final_decision: "accepted",
  });
  expect(
    await row(
      "select opportunity_stage,closed_reason,is_currently_active from opportunities",
    ),
  ).toEqual({
    opportunity_stage: "closed",
    closed_reason: "other",
    is_currently_active: false,
  });
  expect(
    (await row("select created_by_principal_id from offer_decisions"))
      .created_by_principal_id,
  ).toBe(principal);
  expect(
    (
      await row(
        "select count(*)::int as n from next_actions where status='completed'",
      )
    ).n,
  ).toBe(1);
  expect(
    (
      await row(
        "select count(*)::int as n from next_actions where status='open'",
      )
    ).n,
  ).toBe(1);
  await expect(
    safe(
      "update offers set final_decision='declined',status='declined' returning id",
    ),
  ).rejects.toThrow("immutable");
  await expect(
    safe(
      "insert into offer_terms(workspace_id,offer_id,version_number,currency) values($1,$2,1,'USD')",
      [workspace, payload.offer_id],
    ),
  ).rejects.toThrow("Active offer");
});
it("refuses unconfirmed decision and stale terms; old revised version never closes opportunity", async () => {
  await rpc("record_offer", source());
  const old = await current();
  await expect(
    rpc("decline", { ...old, reason: "No", confirmed: false }),
  ).rejects.toThrow("confirmation");
  await rpc("revise_terms", {
    ...old,
    terms: { currency: "USD", base: 160000 },
  });
  const updated = await current();
  await expect(
    rpc("decline", {
      ...updated,
      offer_terms_id: old.offer_terms_id,
      reason: "Old terms",
      confirmed: true,
    }),
  ).rejects.toThrow("latest");
  expect(
    (await row("select opportunity_stage from opportunities"))
      .opportunity_stage,
  ).toBe("offer");
  expect((await row("select status from offers")).status).toBe("negotiating");
  await expect(
    safe(
      "update offers set status='accepted',final_decision='accepted',decision_at=now() returning id",
    ),
  ).rejects.toThrow("Explicit human");
});
it("decline records exact latest terms and immutable reason", async () => {
  await rpc("record_offer", source());
  const payload = {
    ...(await current()),
    reason: "Territory and quota do not fit",
    confirmed: true,
  };
  await rpc("decline", payload);
  expect(
    await row("select decision,offer_terms_id from offer_decisions"),
  ).toEqual({ decision: "declined", offer_terms_id: payload.offer_terms_id });
  await expect(
    safe("update offer_decisions set reason='overwrite' returning id"),
  ).rejects.toThrow();
});
it("invalid structured compensation rolls back every record and stage change", async () => {
  const payload = source();
  await expect(
    rpc("record_offer", { ...payload, terms: { currency: "usd", base: -1 } }),
  ).rejects.toThrow();
  for (const table of [
    "offers",
    "offer_terms",
    "activity_events",
    "next_actions",
  ])
    expect((await row(`select count(*)::int as n from ${table}`)).n).toBe(0);
  expect(
    (await row("select opportunity_stage from opportunities"))
      .opportunity_stage,
  ).toBe("interviewing");
});
it("rejects agent with Owner and missing decision authority without partial changes", async () => {
  await rpc("record_offer", source());
  const payload = { ...(await current()), reason: "Reviewed", confirmed: true },
    version = (await row("select updated_at from opportunities")).updated_at;
  await db.exec("reset role");
  await db.query("update principals set principal_type='agent' where id=$1", [
    principal,
  ]);
  await db.exec("set local role authenticated");
  await expect(rpc("accept", payload, randomUUID(), version)).rejects.toThrow(
    "human",
  );
  await expect(
    safe(
      "insert into offer_negotiations(workspace_id,offer_id,offer_terms_id,entry_type,exact_text) values($1,$2,$3,'plan','Agent')",
      [workspace, payload.offer_id, payload.offer_terms_id],
    ),
  ).rejects.toThrow();
  await db.exec("reset role");
  await db.query("update principals set principal_type='human' where id=$1", [
    principal,
  ]);
  await db.exec(
    "delete from role_permissions where permission_id in(select id from permissions where permission_key='offer.decide')",
  );
  await db.exec("set local role authenticated");
  await expect(rpc("accept", payload, randomUUID(), version)).rejects.toThrow(
    "permission",
  );
  expect((await row("select count(*)::int as n from offer_decisions")).n).toBe(
    0,
  );
});
it("hides offers and denies foreign tenant RPC/terms references", async () => {
  await rpc("record_offer", source());
  const payload = await current(),
    version = (await row("select updated_at from opportunities")).updated_at;
  await db.exec("reset role");
  const other = randomUUID();
  await db.query(
    "insert into auth.users(id,email) values($1,'other-offer@example.invalid')",
    [other],
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [other]);
  const foreign = (
    await row(
      "select bootstrap_personal_workspace('Other','other-offer') as id",
    )
  ).id;
  await db.exec("set local role authenticated");
  expect((await row("select count(*)::int as n from offers")).n).toBe(0);
  await expect(
    rpc(
      "accept",
      { ...payload, confirmed: true, reason: "Foreign" },
      randomUUID(),
      version,
    ),
  ).rejects.toThrow("human");
  await expect(
    safe(
      "insert into offer_terms(workspace_id,offer_id,version_number,currency) values($1,$2,1,'USD')",
      [foreign, payload.offer_id],
    ),
  ).rejects.toThrow();
});
it("denies inactive workspace reads and commands", async () => {
  await rpc("record_offer", source());
  const version = (await row("select updated_at from opportunities"))
      .updated_at,
    payload = await current();
  await db.exec("reset role");
  await db.query("update workspaces set status='archived' where id=$1", [
    workspace,
  ]);
  await db.exec("set local role authenticated");
  expect((await row("select count(*)::int as n from offers")).n).toBe(0);
  await expect(
    rpc(
      "accept",
      { ...payload, confirmed: true, reason: "Archived" },
      randomUUID(),
      version,
    ),
  ).rejects.toThrow("human");
});
it("stale offer update is rejected and source/identity cannot be rewritten", async () => {
  await rpc("record_offer", source());
  const payload = await current();
  await expect(
    rpc("negotiate", {
      ...payload,
      offer_updated_at: "2000-01-01T00:00:00Z",
      exact_text: "Plan",
    }),
  ).rejects.toThrow("Offer changed");
  await expect(
    safe("update offers set source_reference='rewrite' returning id"),
  ).rejects.toThrow("identity");
  expect(
    (await row("select count(*)::int as n from offer_negotiations")).n,
  ).toBe(0);
});
it("cannot mark external communication as sent through negotiation table", async () => {
  await rpc("record_offer", source());
  const payload = await current();
  await expect(
    safe(
      "insert into offer_negotiations(workspace_id,offer_id,offer_terms_id,entry_type,exact_text,external_message_sent) values($1,$2,$3,'candidate_proposal','External send',true)",
      [workspace, payload.offer_id, payload.offer_terms_id],
    ),
  ).rejects.toThrow();
});

it("keeps exact compensation retry input out of generic Activity permission", async () => {
  await rpc("record_offer", source());
  expect(
    (await row("select details from activity_events")).details,
  ).not.toContain("140000");
  expect(
    (await row("select request::text as body from hq_offer_action_requests"))
      .body,
  ).toContain("140000");
  await db.exec("reset role");
  await db.exec(
    "delete from role_permissions where permission_id in(select id from permissions where permission_key='offer.read')",
  );
  await db.exec("set local role authenticated");
  expect(
    (await row("select count(*)::int as n from hq_offer_action_requests")).n,
  ).toBe(0);
  expect((await row("select count(*)::int as n from activity_events")).n).toBe(
    1,
  );
});
it("local security catalog audit confirms caller-rights RPC, RLS and denied anon/delete surfaces", async () => {
  expect(
    (
      await row(
        "select prosecdef from pg_proc where oid='public.hq_offer_action(uuid,uuid,timestamptz,uuid,text,jsonb)'::regprocedure",
      )
    ).prosecdef,
  ).toBe(false);
  expect(
    (
      await row(
        "select has_function_privilege('anon','public.hq_offer_action(uuid,uuid,timestamptz,uuid,text,jsonb)','EXECUTE') as allowed",
      )
    ).allowed,
  ).toBe(false);
  for (const table of [
    "offers",
    "offer_terms",
    "offer_negotiations",
    "offer_decisions",
    "hq_offer_action_requests",
  ]) {
    expect(
      (
        await row(
          "select relrowsecurity from pg_class where oid=$1::regclass",
          [table],
        )
      ).relrowsecurity,
    ).toBe(true);
    expect(
      (
        await row("select has_table_privilege('anon',$1,'SELECT') as allowed", [
          table,
        ])
      ).allowed,
    ).toBe(false);
    expect(
      (
        await row(
          "select has_table_privilege('authenticated',$1,'DELETE') as allowed",
          [table],
        )
      ).allowed,
    ).toBe(false);
  }
});

it("revised-term replacement requires exact current terms even if parent timestamp did not change", async () => {
  await rpc("record_offer", source());
  const stale = await current();
  await row(
    "insert into offer_terms(workspace_id,offer_id,version_number,currency,base) values($1,$2,1,'USD',170000) returning id",
    [workspace, stale.offer_id],
  );
  await expect(
    rpc("revise_terms", { ...stale, terms: { currency: "USD", base: 150000 } }),
  ).rejects.toThrow("latest");
  expect((await row("select count(*)::int as n from offer_terms")).n).toBe(2);
});
