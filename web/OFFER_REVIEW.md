# Offer domain review · proposed only

Baseline: remote-verified Phase 2 `453c5e175d69c2e6856532aea9a7a9455902f04a`.
Proposal: [`001_offer.sql`](../supabase/proposals/offer/001_offer.sql).
No production migration, permission, data mutation, offer decision or communication.
`HQ_OFFER=0` by default; no new-table requests occur until explicitly enabled.

## Proposed behavior

Structured Offer records carry received date, negotiation state and final decision.
Immutable Terms versions retain currency/base period, base, variable, stated OTE,
equity/units/percent/vesting, benefits, start date, location/travel, quota, ramp,
territory, response deadline and notes. Unknown terms stay unknown. Negotiation
history records exact plans/proposals/responses as notes; no message is sent.
The role workspace displays current terms and previous versions with negotiation
and decision history. Revised terms append a version. Accept/Negotiate/Decline
controls open a dialog; terminal decisions require a reason and explicit checkbox.
The reviewed Terms ID, Offer timestamp and Opportunity timestamp go to one invoker
RPC with a stable request ID across uncertain retries. Raw browser writes are blocked.

A decision records the human's intent, not an external legally binding acceptance.
No external email, calendar, signature, contract, payment or employer submission.
The latest exact Terms version is mandatory. One active Offer per Opportunity
avoids ambiguity; revised terms remain inside that Offer. Accepted/declined Offer
history freezes and the Opportunity closes with existing `closed_reason=other`,
only if no active Offer remains. The immutable decision/event explains the precise
reason. No enum change, old-version decline, or stale action can close a revised
active negotiation. This mapping is a local proposal for the consolidated approval.

## RLS/permission impact

Adds offer.read/manage/decide and proposed global Owner grants only. Existing
Auth→Principal→active membership→permission architecture is retained. Every new
write is human-only; accidental agent Owner still cannot record terms, negotiation
or decisions. Existing opportunity.update/close, activity.read/create and
next_action.read/create/complete permissions are also required for relevant RPCs.
All child links use Workspace composite foreign keys, and final decisions name
exact latest Terms. Terms, negotiations and decisions have no UPDATE/DELETE grants.
No existing table RLS changes, agent role grants or automation authority changes.

## Data/backfill / rollback

No backfill or production fixtures. Old generic offer events remain historical.
Human-reviewed source recording must match the exact Opportunity; existing Gmail
worker continues activity/attention until separately authorized structured ingestion.
Do not derive authoritative compensation or commitments from ambiguous free text.

Rollback: disable HQ_OFFER and restart only HQ. Preserve additive tables, all terms,
negotiations, decisions, events and actions; do not reverse a recorded human decision
by deleting history. Any unused RPC removal/revocation is a separately reviewed
forward migration. Never reset/drop a populated domain or silently reopen a closed
Opportunity. No destructive DOWN script is provided.

## Local validation / remaining rollout gates

Synthetic PGlite tests replay actual baseline non-identity migrations and the exact
Offer proposal, with no network, connection string or production rows. Checks cover
atomic receipt/stage/action/history, retries/input mismatch, versioned terms,
immutable negotiation/decision history, latest-version/explicit-confirmation gates,
stale timestamps, invalid compensation atomic rollback, exact attribution,
agent/missing-permission denial, tenant isolation, archived Workspace, external-send
rejection and precise action reconciliation. Parent closure policy is covered by
actual existing Opportunity triggers. UI tests cover cancellation, confirmation,
negotiation-only recording, retry identity/input, SDK exact-version payload and
independent default-off transport. Deterministic rejected requests allow field correction
and cancellation; uncertain outcomes retain the exact frozen retry payload.

Synthetic desktop browser QA: negotiation history and explicit acceptance record
visibly appear; cancellation returns focus. At 390×844, width=390 and the terminal
checkbox/button dialog remains visible. Fixtures simulate domain state only;
parent Opportunity closure is proven by SQL tests, not claimed by the fixture shell.
Evidence: [desktop confirmation](qa-evidence/offer/desktop-confirmation.jpg),
[desktop history](qa-evidence/offer/desktop-history.jpg),
[mobile confirmation](qa-evidence/offer/mobile-confirmation.jpg).

Recommend one consolidated production approval for this exact additive domain,
including proposed permission grants and close-reason mapping, only after the parent
reviews final commit and confirms hosted preflight/rollout targets. Feature activation
is separate: hosted Auth/PostgREST tests, migration inventory recheck and security/
performance advisors are still required. Local schema tests do not prove hosted
Supabase or scheduled worker adoption. No independent approval prompt was sent.

### Retry privacy and explicit new-table permissions

`hq_offer_action_requests` stores exact compensation/request input separately from
Activity Events. Its SELECT/INSERT policies require the current active human,
offer.read/manage and active Workspace; records are append-only and actor-scoped.
The table is outside the frontend allowlist. Generic Activity details contain safe
references only. All new-table privileges are explicitly revoked before adding the
narrow authenticated grants, protecting against hosted default privileges. Catalog
tests confirm RLS, denied anonymous RPC execution and SECURITY INVOKER. New FK/audit
references have supporting indexes. Hosted advisors remain a rollout gate.
