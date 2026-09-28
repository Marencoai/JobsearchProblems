# Morning Planner

**Status:** V1 approved
**Schedule:** Daily after the morning Evaluation Queue
**Timezone:** Candidate Settings
**Goal:** Convert machine state into a simple candidate-facing day.

## Candidate Experience

The Morning Planner should answer:

> What should I do today, and why?

The candidate should not need to inspect:
- Internal Tasks;
- retry state;
- Gmail labels;
- raw alert volume;
- Evaluation versions;
- task dependencies.

The plan should normally fit within roughly one hour and support the Candidate Settings target of 3-4 applications/opportunity decisions per day.

## Inputs

Read live:
- Candidate Settings;
- open Next Actions;
- completed Evaluations;
- active Opportunities;
- Application Packages;
- Applications;
- interview/outreach/email-derived Next Actions;
- deadlines and due times.

## Bridge: Evaluation -> Next Action

Completed Evaluations are machine analysis. They are not automatically candidate work until converted into a Next Action.

For active Opportunities with a completed Evaluation and no Application:
- pursuit score >= 80: eligible for required `decide` action;
- pursuit score 70-79: eligible for optional `decide` action when capacity remains;
- below 70: normally omit from the daily plan unless another urgent factor exists.

Create at most the live `daily_opportunity_target` opportunity-review actions per morning.

Do not create a new review action when:
- an open Next Action already represents that Opportunity/evaluation;
- an Application/Application Package already represents the next human step;
- the Opportunity is interviewing, offer, or closed;
- a materially newer Evaluation supersedes the one being considered.

A `decide` action means the candidate reviews the Evaluation and chooses Pursue / Pass / Defer. It does not create an Application Package automatically.

## Application Next Actions

When an Application Package exists:
- `ready_for_review` -> candidate `approve` action;
- `approved` with no submitted/confirmed Application -> candidate `apply` action;
- submitted/confirmed -> no application action unless another follow-up is due.

## Priority Order

1. Offer-related action
2. Interview invitation / scheduling
3. Recruiter or candidate action required
4. Interview preparation due
5. Approved application ready to submit
6. Application Package ready for candidate review
7. High-pursuit Opportunity decision
8. Outreach follow-up
9. Optional Opportunity decision

Due dates and deadlines may raise priority within a category.

## Time Budget

Default candidate-facing work budget: approximately 60 minutes.

Required items fill the budget first.

Optional work may appear after the required plan but should be clearly marked optional.

The planner should not fill time with low-value work merely to reach 60 minutes.

## Work Blocks

Create only blocks that contain items, using this vocabulary:
- Urgent / Responses
- Applications
- Opportunity Review
- Interview Prep
- Outreach
- Optional

## Today's One Thing

Choose the highest-priority open action that is eligible for Today's One Thing.

A time-sensitive recruiter/interview/offer action normally outranks a new job review.

If no item is eligible, Today's One Thing may remain null.

## Plan Lifecycle

1. Synthesize missing Next Actions.
2. Create Daily Plan draft.
3. Create required Work Blocks.
4. Add Daily Plan Items in ranked order.
5. Set `todays_one_thing_action_id`.
6. Add a concise plan summary.
7. Activate the plan only after at least one Plan Item exists.

If an active plan already exists for today:
- do not create a duplicate merely because the automation reruns;
- create a new version only when material priorities changed;
- activation of the new version supersedes the old version automatically.

Historical plan snapshots remain immutable.

## Morning Delivery

Deliver a concise candidate-facing summary containing:
- Today's One Thing;
- number of applications/packages ready;
- number of opportunity decisions;
- recruiter/action-needed items;
- interviews/prep;
- outreach/follow-ups;
- optional items.

Do not expose internal retry/task mechanics unless something is blocked.

## Guardrails

- Never auto-choose Pursue for the candidate.
- Never auto-approve an Application Package.
- Never auto-submit an Application.
- Never fabricate urgency or deadlines.
- Never include closed/rejected Opportunities as new review work.
- Never duplicate an existing human-facing action.
