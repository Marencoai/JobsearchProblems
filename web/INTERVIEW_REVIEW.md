# Interview domain review · proposed only

Baseline: remote-verified Phase 2 `453c5e175d69c2e6856532aea9a7a9455902f04a`.
No production SQL, permissions, data, invitations, or email were changed.
`HQ_INTERVIEW` defaults off. Domain files live outside automatic migration inventory.

## Proposed domain

Core proposal: [`001_interview.sql`](../supabase/proposals/interview/001_interview.sql).
Contacts proposal: [`002_interview_contacts.sql`](../supabase/proposals/interview/002_interview_contacts.sql).

Processes, rounds/time/format/link, contact associations, preparation, questions
and story/project/skill evidence follow canonical schema §7. The role workspace
shows round, localized date/time, interviewers, source-distinguished questions,
recorded context/research freshness, evidence, risks and questions to ask. It
starts manual prep, saves a structured concise preparation, freezes explicitly
reviewed versions and downloads a bounded plain-text cheat sheet. No facts are
invented and no automatic research/preparation is represented as completed.

The verified-source RPC requires an explicit human review of the source and exact
Opportunity match. Existing Gmail worker authority is unchanged: it continues to
record activity/attention. Installing automated structured ingestion remains a
separate worker rollout and permission decision; ambiguous matches must continue
creating review actions. This UI does not send messages or calendar invites.

## Permission/RLS impact

Adds interview.read/manage permission definitions and proposed grants to global
Owner only. Uses existing Auth→Principal→membership→permission chain, active
Workspace checks, Workspace composite FKs, human-only writes, and no delete grant.
No existing RLS semantics change. Agent with an accidentally broad Owner role
still cannot manage Interview records or call its RPC. Existing opportunity,
activity and next-action permissions are independently required by the invoker RPC.
No admin credentials or frontend privileged access.

## Data/backfill and rollback

No backfill. Historical generic interview activity remains intact, and existing
application/outreach state is untouched. Do not interpret all old interview emails
as verified structured rounds. Optional migration from historical sources needs
explicit reviewed provenance and identity matching.

Rollback: turn HQ_INTERVIEW off and restart only the HQ runtime. Preserve additive
schema, contact links, preparations, activity and actions. Do not drop historical
records. If SQL removal is needed, review a new forward migration revoking the RPC
before considering unused objects; dropping or changing production permissions is
another approval gate. No automatic DOWN/reset script is supplied.

## Validation and approval recommendation

Core PGlite integration tests execute all baseline non-agent-identity migrations
and the exact proposal using synthetic Auth claims, in memory, no connection string
or network. They cover atomic source recording, retries/input mismatch, matching,
stale writes, invalid time/link, actor attribution, agent and missing-permission
rejection, inactive membership/Workspace, second-tenant denial, scoped evidence,
reviewed prep/child freeze, specific action reconciliation and denied deletion.

Synthetic browser QA at 390×844: document width=390; desktop and mobile show the
same role workspace. Start prep and manual reviewed save visibly update the fixture.
Cheat-sheet content contract is unit-tested; IAB download-event capture timed out,
so actual browser download completion is not claimed.

Evidence: [desktop](qa-evidence/interview/desktop.jpg), [mobile](qa-evidence/interview/mobile.jpg).

Contacts contract is pending Outreach owner's final schema confirmation. The exact
002 proposal must execute against that reviewed migration and pass contact tenant
and agent-boundary tests before recommending production approval. Hosted Supabase
Auth/PostgREST validation, advisors, worker rollout targets and flag activation
remain production-gated. Local tests do not prove hosted rollout.
