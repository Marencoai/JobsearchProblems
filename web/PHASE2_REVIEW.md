# Job Hunt HQ human actions · proposed migration review

**Date:** October 1, 2026  
**Status:** Implemented and validated locally; not deployed or applied to production.  
**Baseline:** Phase 1 commit `16a0e32`, draft PR [#1](https://github.com/Marencoai/JobsearchProblems/pull/1). This work is stacked on that branch.

## Problem and resulting behavior

The read-only HQ can display candidate decisions and prepared packages but cannot record human decisions. This proposal enables Pursue, Pass with a reason, Save for later, working-package positioning notes, package review/approval, requests for new versions, and explicit application submission confirmation.

Pursue authorizes the existing application worker once. There is no second strategy approval. Request changes creates a new draft Package and a worker task; the previous Package and Materials remain intact. Approval and submission confirm exact immutable Material IDs. Existing lifecycle triggers continue to own attribution, approval, and submission snapshots. The UI never sends an employer application.

The default runtime remains read-only. `HQ_HUMAN_ACTIONS=1` is a server-controlled rollout flag, not an authority grant. RLS and command-specific permissions remain authoritative even if a caller bypasses the browser transport.

## Proposed database change

[`20261001205019_hq_existing_human_actions.sql`](../supabase/migrations/20261001205019_hq_existing_human_actions.sql) is one additive, transactional migration generated with the Supabase CLI. It adds:

- Nullable `next_actions.available_after` for candidate deferral. `due_at` keeps its deadline meaning.
- `public.hq_human_action(uuid, uuid, timestamptz, uuid, text, jsonb)` with SECURITY INVOKER and an empty search path. PUBLIC and `anon` execution are revoked; `authenticated` execution is granted.

There are no policy replacements, SECURITY DEFINER functions, role-permission changes, admin keys, frontend table writes, or edits to deployed migrations. The caller must be an active human with active membership in an active Workspace. All record queries include Workspace and Opportunity scope. Each mutation runs in a single transaction, locks the Opportunity, validates reviewed timestamps, and rolls back on any lifecycle/RLS failure.

An attributed Activity Event stores the exact request and result with a human-scoped idempotency key. An identical retry replays the result; reusing the key for different input fails. The UI retains the same request ID across an uncertain retry and prevents concurrent confirmation clicks.

## Existing permission matrix

Every command requires `workspace.read`, `opportunity.read`, `activity.read`, and `activity.create`, plus:

| Command            | Existing permissions                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| Pursue             | `opportunity.update`, `evaluation.read`, `internal_task.read/create`, `next_action.read/complete` |
| Pass               | `opportunity.update/close`, `next_action.read/update`                                             |
| Save for later     | `next_action.read/update`                                                                         |
| Approve package    | `application.read/approve`, `application_gap.read`, `next_action.read/complete/create`            |
| Request changes    | `application.read/prepare`, `internal_task.read/create`, `next_action.read/update`                |
| Save positioning   | `application.read/prepare`                                                                        |
| Confirm submission | `application.read/submit`, `next_action.read/complete`                                            |

Agents are explicitly denied even with a mistakenly broad role. A missing permission aborts the transaction. No permission is added to Application Agent or any other actor.

## Worker and consumer integration

Preparation tasks retain `domain=application`, `task_type=prepare_application_package`, `trigger_type=candidate_action`, and `trigger_reference=candidate_decided_to_pursue`. Revisions identify their new draft Package in the task description; the updated Prepare Application skill requires the worker to validate/reuse that Package, read its notes, and create new Material versions there. The UI only queues work.

Roll out the updated Morning Planner skill with the migration: future `available_after` actions remain in deduplication but are excluded from ranking, One Thing, Plan Items, and delivery. Filter existing Plan Items against live action state; historical Plan snapshots remain immutable. HQ also filters deferred actions and shows the review date. Pre-migration read-only mode never queries the new column.

Linked application review actions are reconciled. Historical unlinked approval actions require their exact ID/version in the candidate dialog; unrelated unlinked approvals stay open.

## Local verification

- 102 tests passed, including 19 SQL tests executing actual migrations, RLS policies, and triggers in PostgreSQL 17.5 through pinned PGlite. Production uses PostgreSQL 17.6.
- SQL tests cover human/agent boundaries, inactive membership/Workspace, cross-Workspace denial, missing permissions, exact-once retries, mismatched retry IDs, stale records, explicit decisions, deferral, pass history, blocking gaps, atomic rollback, selected review reconciliation, positioning freeze, new revision Packages, submitted-history protection, exact snapshots, and snapshot immutability.
- Component and SDK tests cover explicit confirmation, cancellation, retry IDs, concurrent-click prevention, exact Material IDs, stage controls, default read-only behavior, and a transport allowlist permitting only the proposed RPC when enabled.
- Lint, TypeScript, formatting, and optimized production build pass.
- Synthetic desktop and 390×844 mobile browser QA exercised Pursue, Pass reason/cancel, deferral, approval checkbox, revision notes, submission checkbox, Escape cancellation, focus return, and sidebar navigation preserving action-preview mode. Mobile document width equals viewport width (390 pixels).
- Production preview returns 404 for `/qa` even with `HQ_QA_FIXTURES=1`; missing public configuration fails closed with 503. `/jobs` remains available as the sign-in surface.

Evidence: [desktop submission dialog](qa-evidence/submission-desktop.png), [mobile submission dialog](qa-evidence/submission-mobile.png). These are synthetic previews; their callback displays confirmation without persisting a workflow or executing a worker.

### Limits of verification

The database harness has no network, connection string, persistent data directory, or production rows. It uses a synthetic hosted-Auth claim shim, omits the unavailable pgcrypto extension declaration (core UUID generation is present), and skips the two historical migrations provisioning specific production agent identities. It validates actual policies/triggers but does not replace hosted authenticated acceptance or a multi-connection concurrency test. The local Docker daemon is unavailable, so full Supabase-container testing has not been performed.

Read-only production advisor baseline on October 1: one security warning for disabled leaked-password protection; performance information includes 95 unindexed foreign keys and 26 unused indexes. Those are existing conditions outside this proposal. No Auth or unrelated index setting was changed.

## Data/backfill impact

Existing actions receive null `available_after`, meaning available now. No data backfill is required. No production fixtures, real decisions, applications, approvals, messages, or snapshots were created. New columns/functions are not live. Activity history is append-only through existing permissions and triggers.

## Approval and rollout gates

1. Finish Phase 1 acceptance: Diana signs in normally at `http://127.0.0.1:3000/jobs` and browses real active opportunities, evaluation details, and history through her existing RLS. This is still pending; no password/session is copied from another app.
2. Obtain explicit approval to apply this exact migration to Supabase project `JobsearchProblems` (`xhhfnxswwspejdxjyvzz`). The Master Build Brief §23 gates “applying production schema migrations”; the approved plan also gates production changes on authenticated Phase 1 acceptance.
3. Before applying, recheck migration inventory and PostgreSQL compatibility against the then-current project. Apply only the reviewed forward migration, never a reset or automatic push of unrelated migrations.
4. Roll out the matching UI and worker consumer contracts; enable `HQ_HUMAN_ACTIONS=1` only after the RPC/column exist. Verify hosted human/agent boundaries without creating production test rows. Any test mutation requires separately identified non-production fixtures.
5. Resume remaining v1 work under the existing approvals. Production domain migrations still need one consolidated approval per Outreach, Interview, and Offer domain.

## Rollback

Disable `HQ_HUMAN_ACTIONS` and restart only the HQ runtime to restore the existing read-only transport/query behavior. Keep new deferral-aware planner filtering for any saved deferrals. Preserve the additive column, attributed Activity Events, new Packages, tasks, and submission history. If database rollback is necessary, propose a reviewed forward migration revoking/dropping only the unused RPC. Do not delete recorded human history or drop the column while consumers or saved deferrals depend on it. Dropping objects is a separate production migration gate.

## Remaining v1 work

This is the first production-gated human-action change, not completed v1. Hosted Phase 1 acceptance and hosted action validation remain pending. Durable PDF/DOCX delivery and the research-refresh worker request integration remain to finish. Manual intake, structured Outreach/Interview/Offer, and full end-to-end validation are subsequent phases. No completed-phase claim substitutes for those gates or checks.
