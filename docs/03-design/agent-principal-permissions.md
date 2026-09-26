# Agent Principals and Least-Privilege Roles

**Status:** IMPLEMENTED FOR EVALUATION AGENT  
**Updated:** 2026-09-25

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

An Evaluation Agent should never gain application submission, outreach sending, or workspace-administration authority merely because it can evaluate opportunities.

## Evaluation Agent

Auth identity:
- `evaluationuser@marencoai.com`

Principal:
- type: `agent`
- name: `Evaluation Agent`

Workspace role:
- `Evaluation Agent`

Permissions:
- `evaluation.create`
- `evaluation.read`
- `evaluation.update`
- `evaluation.complete`
- `candidate_knowledge.read`
- `company_intelligence.read`
- `opportunity.read`
- `job_family.read`
- `settings.read`

Explicitly not granted:
- application submission
- outreach sending
- workspace role administration
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
6. write scores and analysis;
7. validate required inputs;
8. transition `draft -> complete`;
9. completed Evaluation becomes immutable;
10. later material change creates a new Evaluation version;
11. older completed versions may be marked `superseded` by an authorized Evaluation Agent.

Do not create an Evaluation as `complete` before its evidence and intelligence inputs are attached.

## MOR Golden-Path Proof

MOR Furniture AI Solutions Manager was used to verify the model.

Evaluation v3:
- created as draft;
- 10 Candidate Evidence records attached before completion;
- 3 Company Intelligence records attached with snapshots before completion;
- completed successfully while authenticated as Evaluation Agent;
- earlier v1 and v2 snapshots preserved and marked superseded;
- current scores remained Candidate Fit 86, Opportunity Fit 93, Pursuit Score 95.

Permission smoke test verified:
- allowed evaluation permissions = true;
- Candidate Knowledge read = true;
- Company Intelligence read = true;
- application.submit = false;
- workspace.roles.manage = false.

## Token / Runtime Consideration

Least privilege is a database authorization concern, not a model-context concern.

The agent should not need to enumerate or reason through permissions on every run. Once the identity, role, and permissions are configured, normal workflows simply authenticate and execute. Permission-matrix checks belong in setup, tests, and diagnostics rather than routine candidate-facing execution.

## Future Agent Pattern

Repeat the same structure for:
- Application Agent
- Tracking Agent
- Outreach Agent
- Interview Agent

Create each only when its workflow is ready to be tested. Do not pre-grant broad shared permissions.
