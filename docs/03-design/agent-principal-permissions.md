# Agent Principals and Least-Privilege Roles

**Status:** IMPLEMENTED AND ACCEPTANCE-TESTED FOR EVALUATION AGENT  
**Updated:** 2026-09-27

## Purpose

JobsearchProblems uses distinct authenticated identities for humans and agents.

The database already supports:
- `human`
- `agent`
- `system`

Each agent should authenticate as its own Supabase Auth user, map to one `principals` row, join the candidate Workspace through `workspace_memberships`, and receive a role containing only the permissions needed for that workflow.

Google Workspace or other email identities may be attached to these users for operational convenience, but email identity is separate from database authorization.

## Why

This model preserves:
- least privilege;
- clear audit history;
- separation of duties;
- safer future autonomy;
- easier debugging;
- permission-scoped failure containment.

An Evaluation Agent should never gain application submission, outreach sending, workspace administration, Candidate Knowledge modification, Company Intelligence modification, or Opportunity modification merely because it can evaluate opportunities.

## Evaluation Agent

Auth identity:
- `evaluationuser@marencoai.com`

Principal:
- type: `agent`
- name: `Evaluation Agent`

Workspace role:
- `Evaluation Agent`

Current production permissions:
- `evaluation.create`
- `evaluation.read`
- `evaluation.update`
- `evaluation.complete`
- `application_gap.create`
- `application_gap.read`
- `application_gap.update`
- `candidate_knowledge.read`
- `company_intelligence.read`
- `company.read`
- `opportunity.read`
- `opportunity_source.read`
- `job_family.read`
- `settings.read`
- `workspace.read`

These additional read and Application Gap permissions support the actual evaluation workflow: reading the Opportunity, provenance, Company context, Candidate Settings, and Candidate Knowledge, then recording Opportunity-specific gaps.

Explicitly not granted:
- `application.submit`
- outreach sending
- `workspace.roles.manage`
- Candidate Knowledge modification
- Company Intelligence modification
- Opportunity modification

## Evaluation Lifecycle

Correct order:

1. authenticate as Evaluation Agent;
2. create Evaluation as `draft`;
3. snapshot the Opportunity/JD;
4. attach Candidate Knowledge evidence;
5. attach Company Intelligence snapshots;
6. record Opportunity-specific Application Gaps when appropriate;
7. write scores and analysis;
8. validate required inputs;
9. transition `draft -> complete`;
10. completed Evaluation becomes immutable;
11. later material change creates a new Evaluation version;
12. older completed versions may be marked `superseded` by an authorized Evaluation Agent.

Do not create an Evaluation as `complete` before its evidence and intelligence inputs are attached.

### Database execution rule

Draft creation/attachment and final completion should occur in separate database statements.

A PostgreSQL data-modifying CTE should not be used to insert an Evaluation and then update that same newly inserted row to `complete` within one statement. The SoundHound acceptance test demonstrated that the draft and evidence can persist while the same-statement completion update does not see/update the inserted row as intended.

Safe pattern:

1. statement/transaction A: create draft and attach evidence/intelligence/gaps;
2. verify the persisted draft inputs;
3. statement/transaction B: write final scores/analysis and transition to `complete`.

This also creates a clean recovery point if finalization fails.

## MOR Golden-Path Proof

MOR Furniture AI Solutions Manager verified the role, permission, evidence-linking, completion, and superseding behavior.

Evaluation v3:
- 10 Candidate Evidence records attached before completion;
- 3 Company Intelligence records attached with snapshots before completion;
- completed successfully while authenticated as Evaluation Agent;
- earlier v1 and v2 snapshots preserved and marked superseded;
- current scores remained Candidate Fit 86, Opportunity Fit 93, Pursuit Score 95.

Important limitation:
- the MOR v3 draft had originally been created by the human principal, then updated/completed by Evaluation Agent.
- MOR therefore did not prove that Evaluation Agent could create a new Evaluation from zero.

## SoundHound Clean-Agent Acceptance Proof

SoundHound AI — Account Manager, Enterprise was used on 2026-09-27 as the clean zero-to-one Evaluation Agent acceptance test.

Evaluation v1:
- Evaluation ID: `98c06f62-aa01-403f-97da-a759b3099f2a`
- created directly by Evaluation Agent as `draft`;
- `created_by_principal_id` = Evaluation Agent;
- `updated_by_principal_id` = Evaluation Agent;
- 10 confirmed Candidate Evidence records attached;
- 4 Company Intelligence snapshots attached;
- 3 Opportunity-specific Application Gaps recorded;
- completed by Evaluation Agent;
- Candidate Fit = 88;
- Opportunity Fit = 94;
- Pursuit Score = 94;
- opportunity type = `mutual_fit`;
- completed Evaluation immutability was verified.

Permission boundary test verified:
- Evaluation Agent resolves through `auth.uid()` -> `current_principal_id()`;
- `evaluation.create` = allowed;
- Opportunity update attempt = 0 rows;
- Candidate Knowledge update attempt = 0 rows;
- `application.submit` = false;
- `workspace.roles.manage` = false;
- editing the completed Evaluation is rejected with `Completed Evaluations are immutable`.

This closes the missing proof from MOR: Evaluation Agent can now be treated as acceptance-tested for a full Evaluation lifecycle beginning with agent-created v1.

## Token / Runtime Consideration

Least privilege is a database authorization concern, not a model-context concern.

The agent should not need to enumerate or reason through permissions on every run. Once the identity, role, and permissions are configured, normal workflows simply authenticate and execute. Permission-matrix checks belong in setup, tests, and diagnostics rather than routine candidate-facing execution.

## Repository / Migration History Note

Resolved 2026-09-27:

- production migration `20260926184412 evaluation_agent_identity` retained the exact SQL statement in Supabase migration history;
- that exact SQL was restored to GitHub as `supabase/migrations/20260926184412_evaluation_agent_identity.sql`;
- production was not re-run or repaired because the migration was already correctly applied.

Historical note:

- migrations 001-022 in GitHub use different filename timestamps from the corresponding applied Supabase migration-history timestamps, although their names and chronological order align;
- do not rename old deployed files or run migration-history repair casually to make the timestamps look identical;
- reconcile reproducible local bootstrap separately before relying on a from-scratch migration replay.

## Future Agent Pattern

Repeat the same structure for:
- Application Agent
- Tracking Agent
- Outreach Agent
- Interview Agent

Create each only when its workflow is ready to be tested. Do not pre-grant broad shared permissions.
