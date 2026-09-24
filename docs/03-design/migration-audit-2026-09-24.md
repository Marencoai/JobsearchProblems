# Supabase Migration Audit

**Date:** 2026-09-24  
**Scope:** `supabase/migrations/`  
**Status:** Deployed and tested through Migration 021. Identity, tenant isolation, Candidate Knowledge, Evaluation, Workflow, and Daily Queue lifecycle tests are passing. Application end-to-end testing remains.

## Audited migration chain

Migrations 001 through 021 were reviewed in filename order for:

- SQL and migration ordering
- table and function dependencies
- trigger creation and interaction
- Row Level Security coverage
- permission catalog consistency
- PostgreSQL table grants
- Workspace / tenant isolation
- composite foreign-key integrity
- Principal and agent authority boundaries
- SECURITY DEFINER exposure
- lifecycle transitions
- historical immutability
- application submission snapshots
- Candidate Knowledge validation
- workflow / task integrity
- Daily Plan versioning
- Candidate Settings and progressive autonomy
- V1 schema completeness

## Final structural checks

- 21 sequential SQL migrations
- no missing migration numbers
- no non-SQL files in `supabase/migrations/`
- 43 expected V1 tables
- RLS enabled on all Workspace-owned V1 tables
- no duplicate table names
- no duplicate index names
- no unresolved duplicate trigger creation
- no duplicate policy names on the same table
- no simple cross-Workspace foreign-key gaps found
- authenticated table grants match explicit authenticated RLS operations
- SECURITY DEFINER implementations moved out of the exposed `public` schema
- public compatibility helpers are SECURITY INVOKER wrappers only

## Material fixes made during audit

### Migration file / SQL correctness

- Corrected the Evaluation foundation file extension to `.sql`.
- Fixed PostgreSQL function delimiter errors.
- Fixed duplicate Evidence Story context trigger creation.
- Hardened migration ordering and object replacement behavior.

### Workspace and authorization security

- Prevented agents from administering Roles or Memberships.
- Made Workspace Membership identity immutable.
- Restricted Candidate Settings and progressive-autonomy changes to human Principals.
- Preserved safe first-Workspace Candidate Settings initialization.
- Moved elevated SECURITY DEFINER implementations into the non-exposed `private` schema.
- Added explicit authenticated PostgreSQL table privileges derived from RLS policy operations.

### Opportunity integrity

- Added source-specific external job ID deduplication.
- Protected both entering and leaving archived Company state.
- Hardened Opportunity close/reopen authority.
- Required a close reason for closed Opportunities.
- Prevented a closed Opportunity from simultaneously presenting as active.

### Candidate Knowledge

- Added validation state to Skill evidence relationships.
- Required validation authority to confirm those capability claims.
- Added update attribution/history to Candidate Knowledge relationship tables.
- Required confirmed Candidate Knowledge support before a bare Skill may be used as direct Evaluation evidence.

### Evaluations

- Required one evidence source per Evaluation Evidence relationship.
- Closed the loophole that could move inputs out of a completed Evaluation.
- Added minimum completeness checks before Evaluation completion.
- Added deterministic Application Gap resolution timestamps.

### Workflow and Daily Plans

- Preserved append-only Activity history.
- Hardened task dependency and attempt behavior.
- Deployment testing found that dependency cycles were prevented but prerequisites did not yet block execution. Migration 020 now prevents a Task from entering `running` until `must_succeed` / `must_complete` prerequisites are satisfied while keeping `informational` dependencies non-blocking.
- Protected human-facing Next Action assignment.
- Preserved Daily Plan versions and historical priority snapshots.
- Deployment testing found that a Daily Plan could be completed while child Work Blocks or Plan Items remained unfinished. Migration 021 now requires Work Blocks to be `completed` / `skipped` and Plan Items to be `completed` / `carried_forward` / `removed` before Plan completion.
- Tightened internal helper exposure.

### Applications

- Enforced Evaluation / Opportunity / Template consistency.
- Hardened Package approval requirements.
- Froze approved Material version selection.
- Preserved exact submitted Material snapshots.
- Allowed safe retries after failed or withdrawn submission attempts while preventing duplicate active attempts.
- Preserved submission and confirmation history.

## Deliberately deferred from V1

The following remain deferred by design rather than missing accidentally:

- Artifact library
- Career Development Gaps
- ATS answer packets / submitted answers
- Contacts and outreach domain
- Interview domain
- External action execution
- Integration connections / sync state
- generalized workflow-run telemetry
- generalized audit-event domain

## Deployment gate

Deployment testing is in progress against the new Supabase project.

Completed:

1. migrations 001 through 021 applied successfully,
2. migration history verified,
3. schema security advisor reviewed,
4. test Auth user created,
5. first personal Workspace bootstrapped,
6. Owner permissions verified,
7. RLS isolation verified with a second Principal / Workspace,
8. agent self-escalation blocked,
9. Candidate Knowledge validation exercised,
10. Evaluation completion, versioning, snapshots, and immutability exercised,
11. Internal Task, Task Attempt, Activity Event, dependency, and Next Action lifecycle exercised,
12. Daily Plan versioning, Today's One Thing validation, queue snapshots, supersession, completion, and historical immutability exercised.

Remaining:

13. Application approval, submission, retry, and submitted-material snapshots.

Deployment testing produced two corrective migrations: Migration 020 enforces Task prerequisites at execution time, and Migration 021 requires Daily Plan child state to be reconciled before Plan completion.

The current Supabase schema security checks are clean. The only current Security Advisor warning is an Auth-project setting for leaked-password protection, which is outside the migration schema and should be enabled before production use.

No production or personal job-search data should be loaded until the remaining deployment tests pass.
