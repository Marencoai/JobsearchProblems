# Hiring Inbox Sync

## Purpose

Run the scheduled Gmail hiring-inbox sync for Diana's JobsearchProblems workspace.

## Cadence

Every 6 hours.

Use the live `gmail.hiring.sync` and `gmail.hiring.*` Automation Policies in Supabase as the runtime source of truth.

## Account

Process only the connected Gmail account:

`diana@marencoai.com`

## Workflow

1. Read the current Gmail hiring Automation Policies from Supabase.
2. Search the Gmail account for messages received since the prior run, plus the configured reconciliation lookback.
3. Ignore messages before the configured baseline unless they are explicitly selected for reconciliation.
4. For each candidate message, check whether Activity Events already contains:
   `gmail:{message_id}:classification:v1`
5. If it exists, skip the message.
6. Read the full message when classification or matching requires it.
7. Classify into exactly one primary hiring category:
   - Job Alerts
   - Applied
   - Action Needed
   - Interviews
   - Rejections
   - Offers
   - Outreach
8. If the message is not actually job-search mail, do not apply an HR/Hiring label.
9. Match to existing Company / Opportunity / Application before any lifecycle mutation.
10. Apply the Gmail label.
11. Archive or retain Inbox according to the Automation Policy.
12. Write one idempotent Activity Event for the classification.
13. Execute the Supabase behavior allowed by that category.
14. For an ambiguous Opportunity/Application match, create a review Next Action instead of guessing.
15. Never send an email or submit an application.

## Job Alerts

V1 only labels, archives, records the event, and queues later job intake.

Do not run Evaluation Agent from this sync.

## Applied

Only confirmation that an application was actually submitted/received qualifies.

If an exact Application exists, reconcile it to confirmed using the email as the confirmation reference when lifecycle rules allow.

If no exact Application exists, create a reconciliation Next Action.

## Action Needed

Keep the message in Inbox and create a high-priority Next Action.

## Interviews

Keep active interview/scheduling messages in Inbox and create an interview/scheduling Activity Event + Next Action.

## Rejections

Only explicit formal candidacy decisions qualify.

On exact match, record the rejection/update the exact job state. On ambiguity, do not close anything.

## Offers

Keep in Inbox and create an urgent candidate-attention event/action.

## Outreach

Record networking/recruiter/hiring-manager activity. Create a Next Action when a response/follow-up is needed.

## Idempotency

Every processed message uses:

`gmail:{message_id}:classification:v1`

Never process the same Gmail message twice under the same classifier version.

## Completion Summary

At the end of a run, report only meaningful results:
- number of new hiring emails processed;
- labels applied;
- messages archived;
- Supabase lifecycle updates;
- Next Actions created;
- ambiguous items requiring review.

If nothing meaningful changed, do not create noise.
