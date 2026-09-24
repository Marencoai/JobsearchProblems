# Database Deployment Validation Report

**Project:** JobsearchProblems  
**Repository:** `Marencoai/JobsearchProblems`  
**Validation date:** 2026-09-24  
**Supabase project:** `JobsearchProblems`  
**Project ref:** `xhhfnxswwspejdxjyvzz`  
**Final migration under test:** 022  
**Result:** V1 database deployment gate passed

## 1. Purpose

This document records the runtime deployment validation performed after the static migration audit.

The static migration audit answered:

> Does the SQL and schema design look structurally correct before deployment?

This document answers:

> What happened when the schema was actually deployed, exercised through authenticated users, deliberately stressed, and tested for lifecycle and authorization failures?

All destructive or synthetic validation data was created only for testing and was rolled back or otherwise verified absent after each test.

## 2. Scope

Validation covered the V1 database domains that were intentionally included in the schema:

- Identity, Workspace, Roles, Permissions, and RLS
- Core Opportunity
- Candidate Knowledge
- Evaluations
- Workflow
- Daily Work Queue
- Applications
- Candidate Settings and Automation Policies
- SECURITY DEFINER hardening
- Authenticated table grants

The following domains remain intentionally deferred from V1:

- Artifact library
- Career Development Gaps
- ATS answer packets / submitted answers
- Contacts and outreach
- Interview domain
- External action execution
- Integration connection / sync state
- Generalized workflow-run telemetry
- Generalized audit-event domain

## 3. Deployment Result Summary

| Domain / Control | Runtime tested | Result | Corrective migration |
| --- | --- | --- | --- |
| First-user bootstrap | Yes | Pass | None |
| Owner permissions | Yes | Pass | None |
| Workspace tenant isolation | Yes | Pass | None |
| Agent privilege escalation | Yes | Pass | None |
| Candidate Knowledge validation | Yes | Pass | None |
| Evaluation versioning and immutability | Yes | Pass | None |
| Workflow / Task lifecycle | Yes | Pass after fix | 020 |
| Daily Queue / Daily Plan lifecycle | Yes | Pass after fix | 021 |
| Application lifecycle and snapshots | Yes | Pass after fix | 022 |
| RLS helper exposure | Yes | Pass after fix | 019 |
| Security Advisor schema findings | Yes | Pass | 019 |
| Supabase Auth leaked-password protection | Reviewed | Accepted current-plan limitation | None |

## 4. Migration Chain

The deployed chain now contains 22 migrations.

| # | Migration | Purpose / deployment note |
| ---: | --- | --- |
| 001 | `identity_foundation` | Identity, Workspace, Role, Permission foundation |
| 002 | `identity_rls` | Identity RLS, permission helpers, first-Workspace bootstrap |
| 003 | `core_opportunity` | Company, Job Family, Opportunity, Opportunity Source, Company Intelligence |
| 004 | `core_opportunity_rls` | Opportunity-domain RLS and lifecycle controls |
| 005 | `core_integrity_hardening` | FK and Workspace integrity hardening; SQL was applied manually in Supabase SQL Editor because the connector blocked destructive constraint replacement, then migration history was recorded |
| 006 | `candidate_knowledge` | Work Experiences, Projects, Evidence Stories, Skills, Tools, relationships |
| 007 | `candidate_knowledge_rls` | Candidate Knowledge RLS and validation authority |
| 008 | `evaluation_foundation` | Evaluations, Evaluation Evidence, Company Intelligence links, Application Gaps; SQL was applied manually because the connector blocked destructive FK actions, then migration history was recorded |
| 009 | `evaluation_rls` | Evaluation lifecycle, completion, snapshot immutability |
| 010 | `workflow_foundation` | Activity Events, Internal Tasks, Dependencies, Attempts, Next Actions |
| 011 | `workflow_rls` | Workflow RLS, authorship, ownership, lifecycle controls |
| 012 | `daily_work_queue` | Daily Plans, Work Blocks, Daily Plan Items |
| 013 | `daily_work_queue_rls` | Daily Queue lifecycle, Today's One Thing, historical snapshots |
| 014 | `application_foundation` | Templates, Packages, Materials, Applications, submitted snapshots |
| 015 | `application_rls` | Application permissions, lifecycle, approval and submission controls |
| 016 | `candidate_settings_and_automation` | Candidate Settings and progressive autonomy policies |
| 017 | `security_definer_hardening` | Elevated implementations moved to private schema; public wrappers remain SECURITY INVOKER where needed |
| 018 | `authenticated_table_grants` | Explicit table privileges aligned to RLS operations |
| 019 | `rls_auto_enable_hardening` | Removed direct API-role execution of the RLS auto-enable SECURITY DEFINER helper |
| 020 | `task_dependency_execution_guard` | Made Task prerequisites operational at execution time |
| 021 | `daily_plan_completion_reconciliation` | Prevented completed Daily Plans from retaining unfinished child state |
| 022 | `withdrawn_submission_retry_support` | Preserved intended retry behavior after a previously submitted Application is withdrawn |

## 5. Identity, Bootstrap, and Tenant Isolation

### 5.1 First personal Workspace bootstrap

A test Auth user was created and `public.bootstrap_personal_workspace(workspace_name, workspace_slug)` was executed under the authenticated role.

Verified:

- Human Principal created
- Workspace created
- Active Owner membership created
- Owner role resolved correctly
- Candidate Settings initialized automatically
- Candidate Settings defaults included:
  - `search_strategy = balanced`
  - `daily_opportunity_target = 4`
  - `minimum_successful_grade = B`
- No Automation Policy rows were automatically seeded, by design

### 5.2 Authenticated helper behavior

Verified under an authenticated request context:

- `current_principal_id()` resolves the Auth user to the correct Principal
- `current_principal_is_human()` returns true for the human user
- `is_workspace_member()` resolves membership correctly
- `has_permission()` resolves Owner permissions correctly
- RLS exposes the user's own Candidate Settings

### 5.3 Two-Workspace tenant isolation

A second Auth user and second Workspace were created.

Verified:

- User 1 can see Workspace 1 but not Workspace 2
- User 2 can see Workspace 2 but not Workspace 1
- Each user can see only their own Candidate Settings
- Permission checks return false for the other Workspace
- Cross-Workspace updates affect zero rows
- Cross-Workspace Principal assignment is blocked

### 5.4 Agent privilege escalation

A human test Principal was temporarily treated as an agent while retaining a powerful membership.

Verified:

- The system recognizes the actor as non-human
- The agent cannot administer Workspace membership / authority
- A powerful Role does not bypass the human-only administration rule

All temporary identity changes were rolled back and the second test Principal was verified as `human` afterward.

## 6. Candidate Knowledge Validation

Runtime tests used synthetic Projects, Skills, Evidence Stories, and capability relationships.

Verified:

- Agents with create/update authority may create draft Candidate Knowledge
- Validation-bearing records default to `candidate_review_needed`
- A Principal without `candidate_knowledge.validate` cannot confirm a Project or Evidence Story
- A human Owner with validation permission can confirm records
- A confirmed Candidate Knowledge record cannot be silently rewritten by an actor lacking validation permission
- Skills remain taxonomy rows rather than independent proof
- A Skill cannot be used as direct Evaluation evidence without confirmed supporting Candidate Knowledge
- Once confirmed support exists, the Skill can be used as Evaluation evidence
- Evaluation Evidence snapshots include the confirmed support that justified the Skill

## 7. Evaluation Lifecycle and Historical Integrity

Verified:

- Evaluation version numbers are assigned by the database
- Caller-supplied version numbers are ignored
- Opportunity facts are snapshotted when the Evaluation is created
- A later Opportunity change appears in a later Evaluation version without rewriting the earlier snapshot
- A Principal without `evaluation.complete` cannot finalize an Evaluation
- Completion requires the minimum decision fields
- `evaluated_at` is assigned by the database
- Draft → superseded is blocked
- Draft → complete succeeds only when valid
- Completed Evaluations are immutable
- Evaluation Evidence freezes after completion
- Complete → superseded is allowed with the correct authority
- Superseded Evaluations are immutable

## 8. Workflow Runtime Validation

Verified:

- Activity Events are append-only
- Activity Event actors must be active Principals in the same Workspace
- Activity Reply authorship is forced to the authenticated Principal
- Another Principal cannot update someone else's Activity Reply
- Unsupported Activity Event link types are rejected
- Internal Task owners must be active Principals in the same Workspace
- Waiting Tasks require `not_before` or a waiting condition
- Task status transitions are controlled
- Task dependency cycles are rejected
- Task Attempt numbers are database-assigned
- Attempt executor identity is database-assigned
- Failed Attempts synchronize the parent Task to failed
- Successful Attempts synchronize the parent Task to completed
- Retry limits are enforced
- Finalized Task Attempts are immutable
- Execute-only authority cannot redesign a Task
- Next Actions may only be assigned to active human Principals
- Complete-only authority can complete a Next Action without gaining general edit authority
- Completed / dismissed / superseded Next Actions are terminal and immutable

### 8.1 Issue discovered: dependency labels did not block execution

Before Migration 020, `task_dependencies` prevented cycles but did not actually stop a dependent Task from entering `running`.

A child Task with a pending `must_succeed` predecessor was able to start.

### 8.2 Migration 020 behavior

Migration 020 added an execution guard.

Verified after deployment:

- `must_succeed`: predecessor must be `completed`
- `must_complete`: predecessor must be finished
  - `completed`
  - `cancelled`
  - or `failed` with all attempts exhausted
- a retryable failed predecessor continues blocking
- `informational` dependencies do not block execution

## 9. Daily Work Queue Runtime Validation

Verified:

- Daily Plan version numbers are database-assigned
- Caller-supplied version values are ignored
- New Daily Plans begin as `draft`
- A Plan cannot activate without at least one Plan Item
- Daily Plan Item priority is snapshotted from the Next Action
- Action text/context is snapshotted
- Later Next Action changes do not rewrite the Plan snapshot
- Today's One Thing must:
  - be included in that Daily Plan
  - not be background-only
  - remain eligible
  - remain open at activation
- Work Blocks cannot be attached to items from a different Daily Plan
- Active Work Block structure is frozen
- Active Daily Plan Item structure is frozen
- activating v2 automatically supersedes active v1
- only one active Plan exists for a Workspace/date
- the older Plan preserves its historical Today's One Thing
- Plan completion requires both grade and numeric score
- completed/superseded Plans are immutable
- `daily_plan.complete` authority cannot silently change structural plan content

### 9.1 Issue discovered: a completed Plan could contain unfinished children

Before Migration 021, an active Daily Plan could transition to `completed` while:

- Work Blocks remained `planned` or `active`
- Daily Plan Items remained `pending`

Because historical Plans and children are immutable, that could permanently preserve inconsistent history.

### 9.2 Migration 021 behavior

Plan completion now requires:

- Work Blocks: `completed` or `skipped`
- Daily Plan Items: `completed`, `carried_forward`, or `removed`

Both negative and valid completion paths were retested successfully.

## 10. Application Runtime Validation

The Application domain was tested as the full working-RO → final-RO lifecycle.

### 10.1 Templates and Packages

Verified:

- Template version numbers are database-assigned
- Template keys are normalized
- New Template versions start as draft
- Active Template content is immutable
- Package numbers are database-assigned
- New Packages begin as draft
- Package preparation origin is database-controlled
- Package lifecycle follows:
  - draft
  - preparing
  - ready_for_review
  - approved
- a prepare-only actor cannot approve a Package
- Package approval requires at least one approved current Material
- Package approval is blocked while current Materials still require preparation/review
- approved Package content is frozen
- an approved Package cannot be reopened after it has been used by an Application attempt
- a Package cannot use an Evaluation from another Opportunity
- an incomplete Evaluation blocks Package approval
- a Package cannot be used to submit against a different Opportunity

### 10.2 Material versioning and evidence

Verified:

- Material version numbers are database-assigned
- a new Material version becomes current and the previous version stops being current
- Material content/version identity is immutable
- content changes require a new Material row/version
- prepare-only authority cannot approve a Material
- new Material versions cannot be added after Package approval
- only confirmed Candidate Knowledge may support Application Materials
- Material Evidence is frozen after Material approval
- approved Package Material version selection is frozen

### 10.3 Application attempts and submission

Verified:

- an unapproved Package cannot begin a Package-backed Application attempt
- `application.submit` is required to create an Application attempt
- Application attempt numbers are database-assigned
- caller-supplied stage/timestamps are overwritten by database lifecycle rules
- duplicate active attempts for the same Package are prevented
- failed attempts are terminal
- a new retry after failure receives the next attempt number
- Package approval origin is copied into the historical Application
- submitter and submission timestamp are database-controlled
- a submit-only Principal cannot confirm
- a confirm-only Principal can confirm an already submitted Application
- confirmation preserves the original submitter and submission timestamp
- submitted Application facts are immutable

### 10.4 Submitted-material snapshot

When an Application becomes `submitted`, the database automatically snapshots every eligible current Material.

Verified:

- the exact current résumé version is captured
- the exact current cover-letter version is captured
- snapshot content matches the source Material content
- source Materials transition to `submitted`
- normal authenticated users have read-only access to submitted snapshots
- submitted snapshots cannot be rewritten through normal application access

### 10.5 Issue discovered: retry after a withdrawn successful submission

The intended schema allowed Package reuse after a failed or withdrawn Application.

However, after a successful submission the exact Material versions transition from `approved` to `submitted`. If that Application was later withdrawn, a new Application attempt could be created but could not reach `submitted`, because the submission guard required current Materials with status `approved`.

### 10.6 Migration 022 behavior

Migration 022 treats unchanged current `submitted` Material versions as eligible for a retry of the same approved Package.

Verified:

- Attempt 1 submitted and created its own immutable snapshot
- Attempt 1 was later withdrawn
- Attempt 2 was created with the next attempt number
- Attempt 2 successfully submitted the unchanged Package
- the Material remained immutable and `submitted`
- Attempt 2 received its own submitted-material snapshot
- the retry snapshot content matched the exact Material version

This preserves historical truth without reopening or rewriting a previously submitted Material.

## 11. Security Hardening and Advisor State

### 11.1 Migration 019

The initial post-deployment Security Advisor found that `public.rls_auto_enable()`, a SECURITY DEFINER helper used by the `ensure_rls` event trigger, was directly executable by API roles.

Migration 019 revoked direct execution from:

- `public`
- `anon`
- `authenticated`

The event trigger retained its internal ability to execute the function.

After Migration 019, schema-level Security Advisor findings were cleared.

### 11.2 Current Auth warning

The current Security Advisor still reports:

**Leaked Password Protection Disabled**

This is not evidence that a password has leaked.

It means Supabase Auth is not checking new/changed passwords against the Have I Been Pwned known-compromised-password database.

The setting was reviewed in the Dashboard. Supabase makes this protection available only on Pro plans and above. The current project plan does not provide the feature.

**Disposition:** accepted development-environment platform limitation. Reconsider before broad public-user deployment or when upgrading the Supabase plan.

Other password hardening settings can be reviewed separately before production use.

## 12. Cleanup Verification

After runtime testing, synthetic test records were checked and confirmed absent.

Verified zero remaining synthetic records across the tested domains, including:

- Companies
- Opportunities
- Candidate Knowledge records
- Evaluations
- Activity Events / Replies
- Internal Tasks / Attempts / Dependencies
- Next Actions
- Daily Plans / Work Blocks / Daily Plan Items
- Application Templates
- Application Packages
- Application Materials
- Applications
- Submitted Material snapshots
- temporary Roles / Memberships

The second test Principal was also verified restored to `human`.

## 13. Final Gate Decision

**V1 DATABASE DEPLOYMENT GATE: PASSED**

The deployed database now has runtime evidence for:

- tenant isolation
- role and permission enforcement
- agent authority boundaries
- Candidate Knowledge validation
- historical snapshots
- lifecycle enforcement
- immutable finalized records
- workflow retries and dependencies
- Daily Queue versioning and completion integrity
- Application preparation / approval / submission separation
- exact submitted-material history
- safe Application retry behavior

The three issues discovered only through runtime testing were fixed through forward migrations rather than editing deployed migration history:

- Migration 020: Task dependency execution guard
- Migration 021: Daily Plan completion reconciliation
- Migration 022: withdrawn submission retry support

That forward-only correction pattern is the required model for future production schema evolution.

## 14. Related Documentation

- [System Design](./system-design.md)
- [Database Schema](./database-schema.md)
- [Migration Audit](./migration-audit-2026-09-24.md)
- [Database Change Management](./database-change-management.md)
