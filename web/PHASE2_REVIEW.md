# Job Hunt HQ human actions · proposed migration review

**October 2 rollout update supersedes earlier holds:** both user-verified live
scheduled prompt insertions pass exact mechanical comparison. The single
approved migration was applied at 01:56:36 UTC; hosted body/grant/catalog checks
pass. `HQ_HUMAN_ACTIONS` remains unactivated. Actual authenticated human/agent
and scheduled deferral/revision acceptance remain pending; normal data has no
such cases and no test fixture mutations were authorized. See the authoritative
[hosted validation report](PHASE2_HOSTED_VALIDATION.md). All earlier observations
below are retained as historical review evidence.

**Rollout clarification supersedes the earlier deployment-target/runtime
blocker below:** the live queues are ChatGPT scheduled automations. Node helpers
are tested reference/CI contracts, not hosted prerequisites. Parent's authorized
additive edits to both tasks were denied (`You cannot modify this task.`), with
no changes. Current hold is matching instruction adoption/readback, followed by
hosted normal-data validation after migration and before flag activation. Do not
retry denied edits through browser/another route. See [database boundary audit
and conditional consolidated proposal](AUTOMATION_DB_BOUNDARY_AUDIT.md). Exact
approved SQL and the original user-authored instruction snapshot remain unchanged.

**Date:** October 1, 2026  
**Status:** Implemented and validated locally; not deployed or applied to production.  
**Baseline:** Phase 1 commit `16a0e32`, draft PR [#1](https://github.com/Marencoai/JobsearchProblems/pull/1). This work is stacked on that branch.

## Approved rollout preflight · October 1, 2026

Diana subsequently approved **only** migration `20261001205019_hq_existing_human_actions.sql` as reviewed at commit `3b047da5cb6017c8275761491e636456b0ed8b6f`, for existing project `xhhfnxswwspejdxjyvzz`. The reviewed SQL and current local file both have Git blob `0ef9a55b7158d19a99cdf426a628b234191ee318`; no SQL edits were made. This supersedes the earlier withheld-approval checkpoint.

Read-only live preflight confirmed the project is `ACTIVE_HEALTHY` on PostgreSQL **17.6**, with the expected 26-migration baseline ending at `20260930005924_candidate_application_reference_data`. Historic local/live timestamp differences are already documented in the repository; migration names and sequence match. The proposed RPC and deferral column are absent. All seven affected tables have RLS enabled, and required helper signatures and existing column types match the reviewed SQL.

**Blocked before application:** The actual Morning Planner and Application Preparation deployment/execution targets cannot yet be established. The connected hosted-automation inventory exposes zero automations, matching local Codex automation configurations are absent, and accessible Page metadata contains no matching worker Page. Supabase has no deployed Edge Functions or Cron schema. The existing `application.queue` and `daily_plan.morning` policy rows are enabled with `prepare_only` authority, but their rules/notes contain no runner/installation reference. The app catalog identifies the `Job Hunting` ChatGPT project, not a verifiable scheduled worker configuration. These observations do not establish that the scheduled workers do not exist elsewhere.

The explicit rollout instruction requires stopping before apply when the worker installation target cannot be established. **No migration application or worker deployment was attempted.** A parent-provided task/job ID or deployment location, its source/ref installation target, and a supported read-back/version check are required to resume. Installing files only in this local checkout would not prove hosted adoption. Do not invent replacement workers, grant new authority, or deploy a different backend to bypass this blocker.

The known Phase 1 loopback public-config response has no human-action capability field and runs the read-only Phase 1 code. The Phase 2 loopback returns 503 without configuration and fails closed. No feature flag was activated. A hosted HQ runtime has not been identified, so its flag state cannot be certified. **It is not safe to enable `HQ_HUMAN_ACTIONS`: migration and hosted worker verification remain incomplete.**

Exact before-inventory and observed state: [`qa-evidence/phase2-rollout-preflight.json`](qa-evidence/phase2-rollout-preflight.json). No after-apply inventory exists because apply was not attempted. Repeat live inventory/compatibility checks immediately before any future apply; this earlier preflight is not a substitute for that check. Hosted RPC/grant validation remains pending until the approved migration is applied. No test fixtures or job-search workflow mutations were issued during this preflight.

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

The worker contracts now have executable, network-free helpers in [`worker-support/hq-contracts.ts`](../worker-support/hq-contracts.ts), called by the two skills through [`worker-support/cli.mts`](../worker-support/cli.mts). The planner helper returns separate deduplication, eligible-action, and existing-plan delivery ID sets. The preparation helper checks explicit candidate task authority, scopes the exact revision target to the Workspace/Opportunity, rejects missing/foreign/archived/superseded targets, and avoids regeneration on a completed preparation retry. These helpers do not rank actions, compose artifacts, write data, or change worker authority.

Roll out the updated Morning Planner skill with the migration: future `available_after` actions remain in deduplication but are excluded from ranking, One Thing, Plan Items, and delivery. Filter existing Plan Items against live action state; historical Plan snapshots remain immutable. HQ also filters deferred actions and shows the review date. Pre-migration read-only mode never queries the new column.

Linked application review actions are reconciled. Historical unlinked approval actions require their exact ID/version in the candidate dialog; unrelated unlinked approvals stay open.

## Local verification

- 114 tests passed, including 21 SQL tests executing actual migrations, RLS policies, and triggers in PostgreSQL 17.5 through pinned PGlite. Production uses PostgreSQL 17.6.
- Ten worker-contract tests cover future/exact-boundary deferral, existing-plan delivery filtering, tenant/assignee filtering, invalid inputs, initial preparation, exact revision routing, immutable history, invalid revision targets, and retry disposition. Two tests execute the exact CLI commands named by the skills.
- SQL integration tests feed actual deferred rows to the planner helper and pass the actual queued revision/new Package through the preparation helper. A synthetic Application Agent with exactly the historical prepare-only role's 12 permissions creates new Materials and reaches `ready_for_review`; the approved original remains unchanged and the agent's approval attempt is denied. No `internal_task.execute`, approval, or submission permission is added.
- Five additional native PostgreSQL **17.6** concurrency scenarios pass in a disposable database on a private Unix socket with TCP disabled. Each observes Session B waiting on a PostgreSQL Lock held by Session A: identical Pursue, competing Pursue/Pass, competing revisions, identical approval, and identical submission. The checks assert one authorized task/event, one revision draft/task, one apply action, and one application/snapshot/event as appropriate. All 25 non-identity migrations replay unchanged, including pgcrypto. The owned cluster is stopped and removed after the run.
- SQL tests cover human/agent boundaries, inactive membership/Workspace, cross-Workspace denial, missing permissions, exact-once retries, mismatched retry IDs, stale records, explicit decisions, deferral, pass history, blocking gaps, atomic rollback, selected review reconciliation, positioning freeze, new revision Packages, submitted-history protection, exact snapshots, and snapshot immutability.
- Component and SDK tests cover explicit confirmation, cancellation, retry IDs, concurrent-click prevention, exact Material IDs, stage controls, default read-only behavior, and a transport allowlist permitting only the proposed RPC when enabled.
- Lint, TypeScript, formatting, and optimized production build pass.
- Synthetic desktop and 390×844 mobile browser QA exercised Pursue, Pass reason/cancel, deferral, approval checkbox, revision notes, submission checkbox, Escape cancellation, focus return, and sidebar navigation preserving action-preview mode. Mobile document width equals viewport width (390 pixels).
- Production preview returns 404 for `/qa` even with `HQ_QA_FIXTURES=1`; missing public configuration fails closed with 503. `/jobs` remains available as the sign-in surface.

Evidence: [desktop submission dialog](qa-evidence/submission-desktop.png), [mobile submission dialog](qa-evidence/submission-mobile.png). These are synthetic previews; their callback displays confirmation without persisting a workflow or executing a worker.

### Limits of verification

The PGlite harness has no network, connection string, persistent data directory, or production rows. It uses a synthetic hosted-Auth claim shim, omits the unavailable pgcrypto extension declaration (core UUID generation is present), and skips the two historical migrations provisioning specific production agent identities. The native PostgreSQL concurrency suite uses the same synthetic hosted-Auth claim interface and skips the same identity provisions, but replays the other SQL unchanged. Its PostgreSQL 17.6 binary is pinned to the test-only registry package `@embedded-postgres/darwin-arm64@17.6.0-beta.15`; no global service was installed or started.

Local native concurrency is now verified; it does not replace hosted Supabase Auth/PostgREST validation or prove live scheduled workers have adopted the new helpers. That adoption still requires rollout of the matching repository/skills, followed by authorized hosted validation. The local Docker daemon is unavailable, so full Supabase-container testing has not been performed.

To reproduce native concurrency with existing test binaries, run from `web`:

```sh
node scripts/concurrency-check.mjs /absolute/postgres/bin /absolute/psql
```

The script creates only its own synthetic cluster, ignores inherited database credentials, uses a private Unix socket with no TCP listener, verifies observed lock waits, and stops/removes the owned cluster in `finally`. It cannot target an existing database via a connection string.

Read-only production advisor baseline on October 1: one security warning for disabled leaked-password protection; performance information includes 95 unindexed foreign keys and 26 unused indexes. Those are existing conditions outside this proposal. No Auth or unrelated index setting was changed.

## Data/backfill impact

Existing actions receive null `available_after`, meaning available now. No data backfill is required. No production fixtures, real decisions, applications, approvals, messages, or snapshots were created. New columns/functions are not live. Activity history is append-only through existing permissions and triggers.

## Approval and rollout gates

1. **Phase 1 accepted, October 1, 2026:** Diana confirmed normal sign-in as Diana and review of multiple real opportunities, stage organization, evaluation scores, tabs, navigation, and real Supabase data. She explicitly approved Phase 1 real-data acceptance. See [PHASE1_QA.md](PHASE1_QA.md). The two recorded later product improvements are non-blocking and have not been started.
2. **Exact migration approval received; deployment-target blocker remains:** Diana approved this exact SQL at commit `3b047da5cb6017c8275761491e636456b0ed8b6f` for Supabase project `JobsearchProblems` (`xhhfnxswwspejdxjyvzz`). Her earlier withholding is superseded. Before apply, establish the actual hosted worker installation/version-verification targets and resolve the preflight blocker above. Feature-flag activation is not authorized. The Master Build Brief §23 migration gate is satisfied only for this exact reviewed forward migration.
3. Before applying, recheck migration inventory and PostgreSQL compatibility against the then-current project. Apply only the reviewed forward migration, never a reset or automatic push of unrelated migrations.
4. Roll out the matching UI and worker consumer contracts. Keep `HQ_HUMAN_ACTIONS` disabled until separate explicit activation approval is received and the RPC/column and hosted worker versions are verified. Verify hosted human/agent boundaries without creating production test rows. Any test mutation requires separately identified non-production fixtures.
5. Resume remaining v1 work under the existing approvals. Production domain migrations still need one consolidated approval per Outreach, Interview, and Offer domain.

## Rollback

Disable `HQ_HUMAN_ACTIONS` and restart only the HQ runtime to restore the existing read-only transport/query behavior. Keep new deferral-aware planner filtering for any saved deferrals. Preserve the additive column, attributed Activity Events, new Packages, tasks, and submission history. If database rollback is necessary, propose a reviewed forward migration revoking/dropping only the unused RPC. Do not delete recorded human history or drop the column while consumers or saved deferrals depend on it. Dropping objects is a separate production migration gate.

## Remaining v1 work

This is the first production-gated human-action change, not completed v1. Phase 1 is accepted; exact Phase 2 migration approval has been received, but application is blocked on establishing the actual hosted worker deployment/verification target. Hosted action validation remains pending, and the feature flag stays disabled. Durable PDF/DOCX delivery and the research-refresh worker request integration remain to finish. Manual intake, structured Outreach/Interview/Offer, and full end-to-end validation are subsequent phases. The two deferred non-blocking product improvements are tracked in [`docs/02-requirements/requirements.md`](../docs/02-requirements/requirements.md#job-hunt-hq-deferred-product-improvements). No completed-phase claim substitutes for remaining gates or checks.

### Master Build Brief §26 · Definition of Done checkpoint

This checklist follows the actual 18-item Definition of Done; local verification is distinguished from delivered hosted behavior.

| Item                                              | Current evidence                                                                              | Remaining work                                                                                                                |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1. Sign in as Diana                               | Diana explicitly accepted real sign-in.                                                       | Phase 1 acceptance complete.                                                                                                  |
| 2. Active jobs grouped by stage                   | Stage organization accepted with real opportunities.                                          | Preserve the approved seven derived stages.                                                                                   |
| 3. One coherent role workspace                    | Core experience, tabs, and navigation accepted.                                               | Extend that same workspace for later domains.                                                                                 |
| 4. Candidate Fit and Opportunity Fit              | Real evaluation scores accepted.                                                              | Preserve separate scores and recorded evidence.                                                                               |
| 5. Company/opportunity research and freshness     | Read-only recorded intelligence/freshness UI exists.                                          | Research-refresh worker request integration remains; richer recent signals are a separately tracked non-blocking improvement. |
| 6. Pursue, Pass, Defer                            | Local UI/RPC, RLS, retry, and native concurrency checks pass.                                 | Resolve worker target, apply exact approved migration, verify hosted behavior; keep flag disabled until authorized.           |
| 7. Review generated application materials         | Existing version/status/text/artifact record viewers exist; preparation remains worker-owned. | Verify the hosted generation-to-review handoff with an authorized non-production strategy.                                    |
| 8. Preview/download exact resume and cover letter | Recorded safe artifact links and text previews exist.                                         | Complete durable PDF/DOCX delivery and exact-version preview/download.                                                        |
| 9. Approve a package                              | Exact immutable Material approval tested locally.                                             | Hosted rollout/validation remains blocked as above.                                                                           |
| 10. Open employer ATS with answers/files visible  | Existing employer URLs and recorded materials are available as sources.                       | Finish the strongest apply-link and complete approved answer/file packet experience.                                          |
| 11. Explicitly record submission                  | Local explicit confirmation, attribution, retries, and native concurrency pass.               | Hosted rollout/validation; no real submission is authorized during validation.                                                |
| 12. Exact materials employer received             | Existing snapshot reader and immutable trigger tests pass.                                    | Verify the integrated confirmation-to-history experience safely.                                                              |
| 13. Recommended/manual outreach contacts          | Structured Outreach is not delivered.                                                         | Coordinator assigned separate local Outreach preparation; consolidated domain approval before production migration.           |
| 14. Exact outreach message and sent state         | Structured Outreach is not delivered.                                                         | Same separate Outreach work; retain explicit human sent-state confirmation and external-action gates.                         |
| 15. Interview preparation in role workspace       | Derived view exists; structured domain is pending.                                            | Complete Interview schema/RLS/UI/hooks/tests/rollback, then one domain migration approval.                                    |
| 16. Offer review/management in role workspace     | Derived view exists; structured domain is pending.                                            | Complete Offer schema/RLS/UI/decisions/tests/rollback, then one domain migration approval.                                    |
| 17. Manual URL, pasted JD, or upload intake       | Existing intake/evaluation workers are the intended pipeline; UI intake is pending.           | Implement all three intake modes through that pipeline without a duplicate evaluator.                                         |
| 18. Clear next steps without raw worker output    | Phase 1 candidate workspace accepted; raw queues remain hidden.                               | Preserve that UX across mutations and all structured domains; expose only actionable blocked states.                          |

Phase 7 remains a complete safe end-to-end pass through manual/automated discovery → Evaluate → Pursue → generation/review/approval → application confirmation/history → Outreach → Interview → Offer, including closed/history behavior and desktop/mobile QA. Ordinary manual-intake and document-delivery development can proceed independently while this deployment-location blocker is resolved. Do not duplicate the separately assigned Outreach implementation, and do not apply unapproved new domain migrations.
