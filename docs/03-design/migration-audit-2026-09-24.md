# Supabase Migration Audit

**Date:** 2026-09-24  
**Scope:** `supabase/migrations/`  
**Status:** Static audit passed, ready for deployment testing in a new Supabase project.

## Audited migration chain

Migrations 001 through 018 were reviewed in filename order for:

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

- 18 sequential SQL migrations
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
- Protected human-facing Next Action assignment.
- Preserved Daily Plan versions and historical priority snapshots.
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

The source migration chain is ready for the next phase: execution against a brand-new Supabase project.

Static review cannot replace an actual PostgreSQL execution test. The deployment test should:

1. apply migrations 001 through 018 in order,
2. confirm all migrations succeed,
3. inspect Supabase security and performance advisors,
4. create a test Auth user,
5. bootstrap the first personal Workspace,
6. verify Owner permissions,
7. verify RLS isolation with a second test Principal / Workspace,
8. verify an agent cannot self-escalate,
9. exercise Candidate Knowledge validation,
10. exercise Evaluation completion and immutability,
11. exercise Task / Next Action lifecycle,
12. exercise Daily Plan versioning,
13. exercise Application approval, submission, retry, and submitted-material snapshots.

No production or personal job-search data should be loaded until this deployment test passes.
