# Evaluation Queue Worker

## Purpose

Process the bounded queue of ready `evaluate_opportunity` Internal Tasks.

## Runtime Rules

Read the live `evaluation.queue` Automation Policy before every run.

V1 processes at most 4 new Evaluations per run.

## Workflow

1. Read ready Internal Tasks:
   - task_type = `evaluate_opportunity`
   - domain = `evaluation`
   - owned by Evaluation Agent.
2. Order tasks using the live priority policy.
3. Before evaluating, check for a completed Evaluation representing the same material Opportunity information.
4. If no new material information exists, complete the task as already evaluated.
5. Otherwise authenticate/act as Evaluation Agent and execute the approved Evaluation lifecycle:
   - create Evaluation draft;
   - attach confirmed Candidate Evidence;
   - attach Company Intelligence snapshots when available;
   - create supported Application Gaps;
   - verify draft inputs persisted;
   - finalize in a separate statement;
   - transition draft to complete.
6. Return to Owner/orchestrator context and mark the Internal Task completed with the Evaluation ID/result summary.
7. Do not create an Application Package.
8. Do not notify Diana for every completed Evaluation. The later Morning Planner ranks completed evaluations into the Daily Work Queue.

## Guardrails

- Candidate Settings must be read live.
- Completed Evaluations are immutable.
- Materially changed jobs require a new Evaluation version.
- Do not modify Candidate Knowledge.
- Do not modify Opportunity facts as Evaluation Agent.
- Do not submit applications.
- Do not send outreach.


## Scheduled Queue Orchestration

The Evaluation Agent does not require `internal_task.execute`.

For scheduled processing:

1. Owner/orchestrator context selects and transitions the machine task;
2. Evaluation Agent performs only Evaluation-domain reads/writes;
3. Owner/orchestrator records the completed/blocked task state after the agent finishes.

Do not broaden Evaluation Agent permissions merely to simplify queue execution.
