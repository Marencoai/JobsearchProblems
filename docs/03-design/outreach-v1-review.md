# Outreach V1 · consolidated production review

**Status:** Local Outreach proposal and gated UI only. Production Outreach remains off. No Outreach migration, permission rollout, data import, worker deployment or external communication has occurred.

This is the single Outreach domain approval package requested by the Master Build Brief §12 and the approved amendments. It implements reusable professional relationships and exact communication history using the existing Supabase/Principal/Workspace/task architecture, plus a gated local interface with synthetic browser acceptance. Production migration, hosted authenticated domain acceptance and live worker adoption remain approval/rollout gates.

## Scope and proposed migration

Forward proposal: [`20261001230000_outreach_domain.sql`](../../supabase/proposals/outreach/20261001230000_outreach_domain.sql). It deliberately lives outside `supabase/migrations/` so an automatic migration push cannot apply it before domain approval. The final production filename/order must be reconciled with the then-current reviewed migration inventory before promotion. No historical migration is edited.

| Proposed table                      | Purpose                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `contacts`                          | Reusable professional person, current company/title/address, source, status and integer revision                         |
| `opportunity_contacts`              | Role-specific relevance, recommendation/manual selection, reason/source and primary selection                            |
| `outreach_engagements`              | Relationship goal/context, durable relationship state, independent outreach state, timestamps and revision               |
| `outreach_engagement_opportunities` | Zero, one or many opportunities per reusable engagement                                                                  |
| `outreach_messages`                 | A row per exact draft version or exact incoming communication; actor/approval/sending metadata and frozen sent snapshots |
| `outreach_message_evidence`         | Exact workspace-scoped Candidate Knowledge references used by a specific message version                                 |
| `outreach_interactions`             | Recorded follow/connect/comment/referral/meeting activity supporting gradual relationship building                       |
| `relationship_notes`                | Append-only professional context with confirmed/inferred/review-needed provenance                                        |
| `outreach_task_links`               | Typed routing to the existing Internal Task engine; this is not another queue                                            |

All tables use UUID keys and explicit workspace scope with composite tenant foreign keys. Every new FK is indexed. The shared Contacts interface is stable and documented in [`outreach-contacts-contract.md`](outreach-contacts-contract.md). It exposes `full_name`, nullable `title`, and `UNIQUE(workspace_id,id)`. Interview must reference this table, not create another Contacts implementation.

The existing backend Opportunity lifecycle, derived seven-stage UX, human approval gates, Auth mapping, existing role grants, renderer, application snapshots, existing task lifecycle and planner priority rules remain authoritative. Outreach never implicitly moves an Opportunity to interviewing/offer or equates an application submission with outreach completion.

## Controlled operations

An additional non-exposed `private.outreach_action_requests` ledger retains bounded request/result objects for exact retries. It has RLS, no normal caller grants or read policy, tenant/actor/request uniqueness, indexed tenant FKs and append-only history protection. Generic Activity details retain only command/request identity and structured result IDs, never exact message bodies, recipient addresses or note text. A role with only existing `activity.read` cannot bypass the separate Contact/Outreach read permissions through the timeline. This does not add an exposed domain table or new permission.

`public.hq_outreach_action(workspace_uuid, request_uuid, command, payload)` is a small SECURITY INVOKER wrapper. Its controlled writer resides in the existing non-exposed `private` schema with SECURITY DEFINER and an empty search path. It authenticates the actual Principal, active membership and active Workspace, checks every command's explicit domain and existing workflow capabilities, and never accepts a client-supplied actor. All new table DML is revoked from normal callers, including Owner. No database password/service role is needed by the UI or worker.

| Command                                                       | Result                                                                                                                                       |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `save_contact`                                                | Create/edit a professional contact with source; edits require the reviewed revision                                                          |
| `add_manual_target` / `start_engagement`                      | Human-only atomic manual Contact + role junction + relationship creation, or reuse/open an existing active role-linked workstream            |
| `link_contact` / `select_primary_contact`                     | Preserve recommended/manual alternatives and atomically select a human's primary existing target                                             |
| `create_engagement` / `update_engagement` / `link_engagement` | Create/reuse/retire/reopen a workstream and associate multiple roles, preserving history                                                     |
| `save_draft`                                                  | Save a human's exact new version, archive a prior working version, supersede only its linked actions, create exact review task/action        |
| `request_draft`                                               | Queue a candidate-authorized `prepare_outreach_draft` task; no generation runs inside the browser or RPC                                     |
| `complete_draft`                                              | Accept authenticated worker output only for its exact running owned task, engagement, role and optional latest working version               |
| `approve_message`                                             | Optional approval of an exact version; no message is sent                                                                                    |
| `mark_sent`                                                   | Explicit human attestation of an already-sent exact version; snapshots and queue/action reconciliation commit atomically                     |
| `record_received`                                             | Record an exact verified incoming message with external reference; only an explicit `response_to_message_id` resolves that sent-message wait |
| `record_interaction` / `add_note`                             | Append professional relationship history and source/confirmation provenance                                                                  |
| `reconcile_follow_up`                                         | An owned worker task may surface one human follow-up review when its authoritative wait time is due; it never sends                          |
| `resolve_follow_up`                                           | Human closes the exact follow-up review with a reason without falsely recording a send                                                       |

Each command records an attributed append-only Activity Event and links it to its structured object. Relationship-wide events are discoverable through linked opportunities without duplicating the event. The historical Activity Link validator remains unchanged; only four new entity types are routed to a separate workspace-validating trigger. Unknown and all historical entity types keep their original validation.

V1 serializes Outreach transactions with a Workspace **`FOR NO KEY UPDATE`** row lock before dependent-object writes, plus reviewed integer revisions. This mode still serializes Outreach writers and permits existing Opportunity-first workflows' Workspace FK `KEY SHARE` checks. `FOR UPDATE` at Workspace caused a reproduced deadlock against the unchanged approved Phase 2 Pursue RPC. The native suite reproduces that old failure in its disposable cluster, restores the exact proposed implementation, and verifies both overlap orders for real Phase 2 `pursue` and `save_positioning` calls versus Outreach `link_contact`. Pursue completes its exact decision, moves the role to pursuing, queues one application preparation task and preserves the contact link. Existing Phase 2 SQL remains byte-for-byte unchanged. Peer Interview/Offer writers independently use FK-compatible Opportunity `FOR NO KEY UPDATE` locks; final mixed-domain tests, rather than a unilateral reorder of those writers, certify their compatibility. Outreach's order remains Workspace-first. Activity idempotency keys include Workspace/actor/request identity. Identical retries return the original result; reusing a request ID with changed input fails. Concurrent competing edits fail stale rather than silently overwrite.

### Exact mark-sent contract

The caller must confirm the saved latest version, exact body and subject (when present), named recipient and destination, actual sent timestamp, and either a future follow-up time or an explicit choice of no follow-up. The current contact address is checked for email/LinkedIn/phone/SMS. A historical actual send can be recorded without inventing a new send time. If the external message differs from the saved draft, save its exact replacement as a new version before attestation.

The RPC freezes message content, recipient snapshot and role/company snapshot; records the actual human sender; preserves an earlier approver; completes only the exact associated review/send action; and creates at most one authoritative wait task. An explicitly identified previous follow-up task may be resolved when this is a subsequent outreach message in the same engagement/role. General incoming messages do not cancel unrelated waits.

There is no second mandatory approval gate. A human can directly attest an already-sent reviewed draft; optional preapproval is supported as separate metadata. Agents cannot approve, select a manual primary target, request human authorization or record sent status, even if those permissions are mistakenly assigned to an agent role. No `outreach.send` permission, transport executor, Gmail send, LinkedIn send, real outreach or scheduling is implemented.

Sent/received/archived/rejected rows are immutable; saved content always changes through a new row/version. Replies are linked records, so response state is derived from exact incoming records without rewriting a historical sent row. Contact/company edits and Opportunity closure do not change historical snapshots. Relationship/evidence/interaction/note history cannot be deleted through this package.

## RLS and permission impact

Proposed new capabilities: `contact.read`, `contact.manage`, `outreach.read`, `outreach.manage`, `outreach.draft`, `outreach.approve`, `outreach.record_sent`, `outreach.record_received`, `outreach.record_interaction`.

The proposal grants these **nine new capabilities only to the existing global Owner role**, following the existing additive domain convention. No existing permission is changed. No agent identity, membership or grant is provisioned. This is an explicit part of the one domain approval; it is not live.

| Boundary                                                    | Proposed behavior                                                                                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous                                                   | No SELECT, table writes or RPC execution                                                                                                          |
| Active member with `contact.read`                           | Workspace-scoped Contact and Opportunity-Contact SELECT                                                                                           |
| Active member with `outreach.read`                          | Workspace-scoped remaining domain SELECT, including exact professional messages/history                                                           |
| Owner                                                       | Read and controlled operations, subject to human gates, revisions and exact-record checks; no direct table DML                                    |
| Inactive/suspended Principal, inactive membership/Workspace | No domain reads or operations                                                                                                                     |
| Another Workspace                                           | No domain reads; RPC and composite FK references reject foreign targets                                                                           |
| Future preparation worker                                   | Explicit `outreach.draft` plus required context/activity/task/action capabilities; exact owned running task only; no approval/send recording      |
| Future inbox worker                                         | Explicit `outreach.record_received` and required context/activity/task/action capabilities; verified external source reference; no sent inference |
| Future wait worker                                          | Existing task execution/read plus domain/activity/action capabilities; exact owned task and authoritative due/response condition only             |

Because the writer is privileged internally, it checks capabilities for all touched old domains explicitly. Existing table triggers still enforce their lifecycle/assignment rules. The SQL command matrix is authoritative: contact operations use company/opportunity read where appropriate; message review uses task/action read/create/update; human attestation requires approve/record_sent plus task update and action completion; incoming records require queue/action reconciliation capabilities. No permission is silently inferred from another role. Future worker provisioning requires a separate explicit role review, not a side effect of this migration. `contact.read` exposes professional relationship IDs/relevance in the workspace; `outreach.read` exposes the exact professional messages. These scopes should be included when reviewing any future role grants.

Applicable local security/performance catalog checks assert all nine tables have RLS, anonymous access is absent, authenticated raw DML is absent, the exposed function is invoker-only, definer implementations are private with fixed search paths, and every new FK has a usable index. Hosted Supabase advisors cannot validate a deliberately unapplied proposal. Run hosted security/performance advisors after the approved migration; triage existing findings separately without silently changing Auth or unrelated indexes.

Security rationale follows [Supabase database-function guidance](https://supabase.com/docs/guides/database/functions), [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security), and [PostgreSQL row-security/FK guidance](https://www.postgresql.org/docs/current/ddl-rowsecurity.html). Prefer invoker functions where table policies alone can enforce the transition; here direct DML must be denied to preserve multi-record history and workflow invariants, so the existing private controlled-writer pattern is used and tested explicitly.

## Worker and UI integration

Pure routing helpers in [`worker-support/outreach-contracts.ts`](../../worker-support/outreach-contracts.ts) validate the exact task/workspace/actor/engagement/message before existing workers prepare or reconcile. They perform no research, ranking, generation, database write, transport, permission change or external action. SQL integration tests pass actual queued records through these helpers. The worker keeps generation ownership and publishes through `complete_draft`; stale output fails safely after a human changes the engagement/version. No unattended consumer is deployed by this package.

The existing planner continues reading Next Actions. All role-related Outreach actions link to an Internal Task with `domain='outreach'`, allowing the existing derived UI stage engine to place each job once using its established priority rules. Relationship-only work can remain unbound to a role. Wait tasks create no premature human action; replies and elapsed waits reconcile exact contextual actions. `next_follow_up_at` is a cache of the earliest outstanding authoritative task wait time, not another scheduler.

The implemented local interface reads recommended/manual contacts and their relevance/source, permits manual people and reuse of existing contacts, and presents general networking separately from role-bound drafts within the same durable relationship. It displays whole-message version history, frozen sent recipient/role facts and actual timestamps, incoming history, evidence, certainty-labelled notes and professional interactions. Copy/open-profile controls leave sent status unchanged. Draft edits/replacements save a new immutable version; revision requests queue the existing worker. Mark-sent requires an unchecked explicit already-sent attestation, exact saved recipient/channel/body/subject/time and an explicit future-or-none follow-up choice. Outstanding waits can be resolved individually with a reason, or explicitly identified when a subsequent actual message resolves them.

`HQ_OUTREACH` defaults off and is independent of Phase 2's flag. Until approval/deployment, normal pages issue no Outreach table reads or RPC calls. The normal memory-only authenticated client permits only the nine new public SELECT paths and the exact `hq_outreach_action` RPC when this flag is explicitly enabled; private retry-ledger reads, raw DML, unrelated RPCs, foreign origins and admin routes remain blocked. Identity/membership is reverified before an action; generation checks discard results after workspace/sign-out changes. Mutation refresh preserves the role/stage and dialog while refreshing actual authoritative records. No privileged key/connector, browser generation, sending or agent provisioning is introduced.

Development-only `/qa?outreach=1` uses synthetic memory state and the same interface. It never connects to a database or executes workers and cannot substitute for live data. The production build always returns 404 for `/qa`. Synthetic SQL, real-SDK mocked transport, component tests and isolated headless browser/visual QA validate local behavior; [the dated evidence report](outreach-validation-2026-10-01.md) records exact results and screenshots. Hosted Auth/PostgREST and live consumer acceptance remain post-approval checks.

The UI required two additive commands after the earlier schema checkpoint: `add_manual_target` prevents a partially created Contact/role/workstream when any step fails; `start_engagement` safely reuses the active role-linked workstream on repeated human openings. Both are within the existing controlled writer, explicitly human-only, serialized/idempotent, scoped to the current Workspace and require their explicit existing/new domain permissions. The independent integration review additionally required the FK-compatible lock-mode correction above; Workspace-first ordering stays intact. No Contacts column, key, RLS policy, permission definition, grant or worker contract changed from the published shared Contacts checkpoint. The final proposal hash supersedes `2af79c2`'s SQL hash; dependent domain tests must pin the final reviewed commit.

## Data, backfill and compatibility

No existing row is rewritten or inferred into a Contact/message, and no personal contact dataset is imported. All nine domain tables start empty. Professional contacts/messages must be created only from explicit candidate entry or an appropriately authorized verified-source worker. Unrelated personal information is outside this model.

Existing Company/Opportunity/Principal/Activity/Task/Action tables are reused. Contacts/workstreams are independent of application state and survive Opportunity closure. Existing workers and the read-only UI continue operating before this proposal is promoted. Interview contact junctions depend on this canonical Contacts proposal being applied first; their migration package must not redefine it. Final deployment ordering and any Phase 2 dependency changes are reconciled before approval/application.

## Validation and reproducibility

Synthetic records use `.invalid` addresses. PGlite executes the real repository migration chain and proposal with an isolated Auth claim shim, no network, no connection string and no production rows. Its only adaptations omit the unavailable pgcrypto extension declaration and the two historical migrations tied to real production agent identities; no application policy or trigger is rewritten. Native PostgreSQL 17.6 executes the other 25 historical migrations and proposal unchanged, including pgcrypto, using a private owned Unix socket and TCP disabled.

```sh
cd web
npm ci --ignore-scripts
npm test
npm run typecheck
npm run lint
npm run format:check
node scripts/outreach-concurrency-check.mjs /absolute/postgres/bin /absolute/psql
```

The native script creates only its own synthetic cluster, does not inherit database credentials, observes real lock waits before asserting races, and stops/removes the owned cluster in `finally`. Test binaries on the Mac are the same pinned test-only registry package as Phase 2, `@embedded-postgres/darwin-arm64@17.6.0-beta.15`. No global database service or security preference was installed/changed. Docker is unavailable, so no full hosted-Supabase container claim is made.

Final test counts and exact commit/hash are recorded in the PR and dated evidence document after completion. Required coverage includes Owner/read-only/agent/anonymous/inactive/foreign-tenant allow/deny, raw-write denial, safe professional addresses, relationship reuse/manual alternatives, exact draft/body/subject versions, recipient and approver/sender attribution, historical sends, explicit no-follow-up, immutable history, record-specific action resolution, verified inbound deduplication, delayed follow-up reconciliation, worker-task ownership, atomic rollback and idempotency/concurrency.

## Rollback

First disable the future Outreach UI capability and stop its task consumer. Keep the canonical relationship/history tables and all records. If database write shutdown is needed, the proposed forward disable file [`disable_outreach_writes.sql`](../../supabase/proposals/outreach/disable_outreach_writes.sql) revokes execution of both public and private action functions from authenticated callers. Table DML is already revoked. It preserves reads, history, Contact dependencies, queue records and existing workflows. This production change still requires approval.

Do not drop Contacts after Interview/other domains reference them; do not remove sent/received versions, linked Activities or queued tasks. Re-enabling writes is another reviewed grant/consumer rollout. A pre-use removal migration is possible only if the domain is empty and no consumer/dependency exists, and would be a separately reviewed destructive production gate, not an automatic rollback. The local suite verifies the disable path and retention.

## Single approval gate

Once local review is complete, request **one Outreach domain approval** covering the exact proposed SQL, nine new Owner capabilities, new table policies and controlled writer/Activity-link extension. Approval to prepare this package is not approval to apply it. The parent batches this gate with the other completed domain packages; no ordinary field-by-field approval is needed.

Before application: confirm the then-current inventory, final base and dependency order; review the exact file/hash; promote only the approved forward file; never database reset/push unrelated migrations. After application: run hosted advisors and scoped normal-user/agent read validation, regenerate DB types, enable the approved UI capability and adopt worker consumers, verify exact transitions in separately authorized test fixtures, then perform hosted browser/end-to-end acceptance. Any real outreach remains separately authorized, and this package never sends it.

**Combined-stack blockers:** the parent coordinates final mixed-domain lock races and shared frontend integration before requesting production approval. The individual branches modify the same shell/session/QA/transport files; Outreach's fourth `readOnlyFetch` argument is its boolean capability, while other proposed domains use that slot differently. The isolated combined integration must consolidate an explicit capability contract and test default-off, each individual capability and all-on allow/deny matrices, workspace/sign-out reset and preserved fixture query flags. Per-domain passes do not certify that merged stack. This package does not authorize a production apply or claim full v1 acceptance while those checks remain.
