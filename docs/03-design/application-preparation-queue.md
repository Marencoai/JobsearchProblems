# Application Preparation Queue

**Status:** V1 approved  
**Cadence:** Twice daily  
**Specialized principal:** Application Agent  
**Task-state orchestrator:** Owner

## Purpose

Turn explicit candidate pursuit decisions into prepared Application Packages without granting the Application Agent authority to approve, submit, or manage machine-task permissions.

## Entry Condition

Only process ready Internal Tasks where:

- `task_type = prepare_application_package`
- `domain = application`
- explicit candidate pursuit authority exists, normally:
  - `trigger_type = candidate_action`
  - `trigger_reference = candidate_decided_to_pursue`

A high Evaluation score alone is not authorization to prepare an application.

## Orchestration

1. Owner/orchestrator reads the ready task.
2. Confirm explicit candidate pursuit authority.
3. Owner/orchestrator may mark execution state as needed.
4. Application Agent prepares the package using its existing narrow permissions.
5. Application Agent stops at candidate review / ready for review.
6. Owner/orchestrator records task completion.
7. Candidate receives a Next Action to review/approve the package.

The Application Agent does not receive `internal_task.execute`.

## Proposed HQ Revision Handoff (pending rollout)

For HQ revision tasks, the Owner/orchestrator calls `worker-support/cli.mts preparation` with the task and scoped Package records. The helper validates explicit candidate authority and chooses the exact new draft identified by the task description. Pass that Package ID and its candidate notes to the narrow Application Agent. The agent reads/prepares that Package through existing RLS; it does not need Internal Task read/execute permission. A missing, foreign, archived, or superseded revision target fails closed. Existing reviewed results are reused on retry rather than regenerated. The local SQL integration test verifies new Materials can reach `ready_for_review` under the original prepare-only permissions while approved history stays intact. Live worker adoption still requires deploying the matching repository/skill contract.

## Preparation Contract

The Application Agent reads:

- Opportunity
- completed Evaluation
- Application Gaps
- Candidate Settings
- confirmed Candidate Knowledge
- active Application Template

It prepares:

- Application Brief
- opportunity-specific resume
- application-answer packet when appropriate
- evidence links
- rendered resume artifact using the active template's renderer

Current canonical renderer:

`executive-brief-two-page-v2`

## Stop State

The package may move to:

`ready_for_review`

The agent may not move it to:

`approved`

and may not create a real-world submission.

## Candidate Handoff

When the package reaches `ready_for_review`, create one human-facing Next Action:

- action type: `approve`
- title: review the application package
- approval required: true
- eligible for Today's One Thing

After candidate approval, a separate submission flow applies.

## Guardrails

- Never infer pursuit from score alone.
- Never approve the package.
- Never submit the application.
- Never send outreach.
- Never modify Candidate Knowledge or Opportunity facts.
- Never grant broader permissions merely to allow task bookkeeping.
