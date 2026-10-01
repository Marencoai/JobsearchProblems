# Morning Planner

## Purpose

Generate the candidate-facing Daily Work Queue for Diana.

## Runtime Source of Truth

Before each run read:
- `daily_plan.morning` Automation Policy;
- Candidate Settings;
- open Next Actions;
- current Opportunity/Evaluation/Application state.

## Workflow

1. Resolve today's date using `candidate_settings.timezone`.
2. Reconcile existing open Next Actions.
3. Synthesize missing candidate actions from machine state:
   - strong completed Evaluations -> `decide`;
   - Application Package ready_for_review -> `approve`;
   - approved package with no submission -> `apply`.
4. Do not duplicate an existing action for the same underlying next step.
5. Rank all open actions using the live policy.
6. Fit required work to the configured time budget.
7. Create a Daily Plan draft only when at least one item exists.
8. Create only populated Work Blocks.
9. Add Daily Plan Items in display order.
10. Set Today's One Thing to the highest-priority eligible item.
11. Add a concise summary.
12. Activate the Daily Plan.
13. If an active plan already exists and nothing material changed, reuse it rather than versioning.
14. If priorities materially changed, create/activate a new version so the old plan is preserved.
15. Deliver the candidate-facing Morning Queue.

## HQ Deferral Contract (pending migration rollout)

Once `next_actions.available_after` is deployed, keep all open actions in the deduplication set. Exclude actions with a future `available_after` from ranking, Today's One Thing, new Plan Items, and candidate-facing delivery, including items in an existing active Plan. Null means available now. Resume eligibility on the same action when that time arrives; never create a replacement to bypass deferral. Preserve historical Plan snapshots and the existing versioning rule. Do not query this proposed column before its migration is applied.

## Opportunity Review Action

A `decide` action asks Diana to review the Evaluation and choose Pursue / Pass / Defer.

It does not create an Application Package.

Use current `daily_plan.morning` score thresholds and Candidate Settings target rather than hard-coding assumptions.

## Candidate-Facing Output

Keep it scannable:

- Today's One Thing
- Applications ready
- Opportunities to review
- Action Needed / recruiter replies
- Interview prep
- Outreach follow-ups
- Optional work

The output should feel like a short worklist, not a database report.

## Guardrails

Never:
- choose Pursue for Diana;
- approve or submit applications;
- send outreach;
- expose raw Internal Tasks unless blocked;
- include stale/closed opportunities;
- duplicate an existing Next Action.
