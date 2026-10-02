# Scheduled automation rollout and database boundary audit

User clarification: Morning Job Queue and Application Queue are ChatGPT
scheduled automations. Node helpers are pinned, tested reference/CI contracts;
their execution is not a hosted deployment prerequisite. Database/RPC remains
authoritative for human actions. Exact approved Phase2 SQL stays Git blob
`0ef9a55b7158d19a99cdf426a628b234191ee318`, unchanged.

**October 2 authoritative update:** user-verified prompt adoption passed exact
comparison and the single approved migration is applied; earlier task-access
and pre-migration holds below are historical. Hosted read-only definitions
confirm the two selection gaps still exist. A strict database-rejection
requirement therefore needs the consolidated controlled path even if a worker
behavioral test succeeds. See [enforcement and bounded fixture proposal](PHASE2_ENFORCEMENT_AND_FIXTURE_PROPOSAL.md)
and [applied migration audit](PHASE2_HOSTED_VALIDATION.md). No new hardening SQL,
fixtures, permissions, schedules or flags were changed.

Parent reported both exact additive task-instruction updates returned
**`You cannot modify this task.`** No updates occurred. This is a task-edit
access denial, not a runtime deficiency. Do not retry through browser or another
route. Parent asked Diana to apply the two additions in existing task settings
and provide updated instructions. Matching adoption/readback evidence is the
current pre-migration hold. The preserved user snapshot is evidence of original
instructions, not proof that proposed additions were adopted. Subsequent hosted
read-only/normal-data validation precedes any flag activation; do not create
production test rows or run real human/application/outreach actions for QA.

## What the reviewed database actually enforces

| Invariant                                          | Deterministic enforcement / remaining consumer obligation                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Human decisions, package approval and submission   | Reviewed caller-invoker RPC requires active human/workspace, existing command permissions, expected row versions, exact current Material IDs and explicit submission confirmation; scoped locks/idempotency and lifecycle triggers preserve attribution/history. A prepare-only agent cannot approve/submit.                                                                          |
| Candidate deferral storage                         | RPC writes a future `available_after` onto the existing open decision; no replacement task/action or preparation authority. `due_at` remains a deadline.                                                                                                                                                                                                                              |
| Deferral exclusion from ranking/new plans/delivery | **Not independently enforced by existing plan triggers/RLS.** `prepare_daily_plan_item` checks scoped action existence and `status='open'`, but not the new timestamp. Existing active Plan Items retain historical snapshots. The scheduled planner must query current eligible actions and filter existing-item delivery; raw read availability does not mean delivery eligibility. |
| Revision request target creation                   | RPC creates a new draft Package and ready candidate-authorized task atomically, with exact Package ID in the description and candidate notes. It does not reopen submitted history; competing revisions reject stale versions.                                                                                                                                                        |
| Exact working Package routing by automation        | **Not independently bound by existing Material-write RLS.** It validates same-Workspace Package and mutable lifecycle but permits `application.prepare` on other accessible working Packages. Task description has no structured task→Package foreign key. Owner must resolve/validate exact target before dispatch and recheck before writes/readiness.                              |
| Older approved/submitted content protection        | Existing Material content/version immutability, Package lifecycle/permission checks and submission snapshots protect history. Material insertion into an approved Package is rejected; a prepare-only agent cannot reopen/approve it. These controls do not prove which of several draft Packages a worker selected.                                                                  |

Source evidence: approved migration's deferral and revision branches;
`supabase/migrations/20260924011500_daily_work_queue.sql`
`prepare_daily_plan_item` (line621, open-state check); application foundation
Package columns; `20260924020000_application_rls.sql`
`enforce_application_material_lifecycle` (line898, permitted working statuses,
immutable identity/content) and approval/submission/snapshot triggers.
Existing SQL/role tests exercise real deferrals and exact queued revision through
the reference contract, immutable approved originals, denied narrow-agent
approval/submission/task execution, and retries. Reference helpers do not add
database enforcement and must not be represented as such.

## Safe adaptation using current architecture

Morning instructions must keep two sets: all scoped open actions for deduplication,
and only current unassigned/Diana-assigned open actions with null/past deferral
for ranking, One Thing, new items and existing-plan delivery. Read those fields
from the database after deployment, not old Plan snapshots. No timestamp access
before migration. Failure to resolve current action state stops delivery.

Application instructions must verify existing task type/domain/candidate trigger,
extract its exact draft ID, read the same Workspace/Opportunity's latest
non-archived Package and notes, reject wrong/stale/non-working targets, and pass
the exact validated ID to the narrow preparer. Reuse already reviewed results;
never regenerate an approved original. After long form/research work, reread
before creating Materials/readiness. These are deterministic database queries
expressible through the scheduled automation's existing authorized tools; no
Node process, new evaluator, permission expansion or strategy approval is needed.

This supports the user's instruction-adoption then hosted-validation rollout.
It does **not** certify arbitrary automation mistakes as database-rejected.
Parent must verify updated instructions and normal-data behavior before enabling.

## One conditional consolidated enforcement proposal

If hosted validation shows either consumer cannot reliably honor these checks,
or approval requires rejection even when it selects the wrong input, bring one
separate forward proposal covering both gaps; do not modify approved Phase2 SQL:

1. A caller-invoker planner input/delivery function returns current eligible
   action/item IDs under existing RLS; guard new Plan Items/One Thing against
   future deferral with an FK-compatible lock protocol. Recheck current state at
   delivery; preserve stored historical plans and all open-action deduplication.
2. A structured immutable revision task/Package binding plus caller-invoker
   preparation handoff validates exact current working target/candidate authority.
   Any write enforcement must use that binding for managed HQ preparation,
   including readiness, with explicit compatibility for existing authorized
   initial preparation. It must not silently require the narrow agent to gain
   Task read/execute, approve/submit, or service credentials.
3. Review exact SQL/caller-policy/grant impact, legacy compatibility, native
   cross-domain lock races, future/exact-boundary deferral, existing-plan delivery,
   wrong/stale/foreign target, retries and unchanged history before one production
   approval. This is a concise design proposal, not implemented or applied DDL.

A database function cannot police free-text external message composition; its
filtered results still require the adopted automation delivery contract. Node
availability alone is no reason to introduce this conditional schema change.
