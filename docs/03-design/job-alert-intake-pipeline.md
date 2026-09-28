# Job Alert Intake Pipeline

**Status:** V1 approved
**Source:** Gmail label `HR/Hiring/Job Alerts`
**Batch cadence:** Twice daily, 30 minutes after the 06:00 and 18:00 hiring-inbox syncs
**Evaluation cadence:** Twice daily, 30 minutes after each intake batch

## Purpose

Convert noisy job-alert email into deduplicated, current Opportunities and a bounded Evaluation queue without firing an Evaluation Agent for every email or every posting.

Gmail is the alert transport. Supabase is the source of truth.

## Pipeline

```
Gmail Job Alert
      ↓
Hiring Inbox Sync
      ↓
Activity Event
      ↓
job_alert_intake Internal Task
      ↓
Batch Intake Worker
      ↓
Extract postings
      ↓
Resolve canonical/current source
      ↓
Deduplicate
      ↓
Create or enrich Opportunity + Opportunity Source
      ↓
Cheap viability pre-screen
      ↓
evaluate_opportunity Internal Task
      ↓
Evaluation Queue Worker
      ↓
Completed Evaluation
```

## Queue Boundary

The 6-hour Gmail sync does not parse every posting and does not run evaluations.

For each Job Alerts email it creates exactly one Internal Task:

- `task_type = job_alert_intake`
- `domain = discovery`
- `trigger_type = event`
- `source_activity_event_id = Gmail Activity Event`
- `status = ready`
- `idempotency_key = gmail:{message_id}:job-intake:v1`

A digest containing many jobs still creates one intake task.

## Batch Intake Worker

Read the live `job_intake.batch` policy each run.

Default V1 limits:
- maximum 20 alert emails per run;
- maximum 25 extracted postings per alert.

### Extraction

Extract only postings actually present in the email.

Preserve:
- provider;
- provider job/external ID when present;
- provider URL;
- company;
- role title;
- source location;
- salary text;
- source description/excerpt;
- discovery timestamp.

Do not invent missing fields.

### Canonical Source Resolution

Preference order:
1. employer careers page;
2. provider job page;
3. reputable current mirror.

The canonical source is used to verify that the hiring event is still current and to enrich factual fields.

If the employer page cannot be found, retain the strongest current source and lower verification confidence. Do not falsely mark employer-verified.

### Deduplication

Check in this order:
1. external/requisition job ID;
2. canonical URL;
3. same Company + normalized title + clearly same active hiring event.

A duplicate alert should add/enrich an Opportunity Source rather than create another Opportunity.

The same Company may legitimately have multiple distinct Opportunities. Do not collapse different active roles merely because the Company matches.

### Candidate Settings Pre-Screen

Read Candidate Settings live.

The intake worker performs only cheap hard-conflict screening. It does not replace Evaluation.

Rules:
- unknown salary is not a rejection;
- SQL/coding terminology is not a rejection;
- industry difference alone is not a rejection;
- title difference alone is not a rejection;
- reject/suppress only an explicit hard conflict encoded in Candidate Settings;
- otherwise queue the Opportunity for Evaluation.

### Evaluation Task

For a new viable Opportunity create one Internal Task:

- `task_type = evaluate_opportunity`
- `domain = evaluation`
- `owner_principal_id = Evaluation Agent`
- `status = ready`
- `trigger_type = agent_action`
- `opportunity_id = new/existing Opportunity`
- `idempotency_key = opportunity:{opportunity_id}:evaluation-queue:v1`

If a current completed Evaluation already exists and no material Opportunity information changed, do not create another Evaluation task.

## Evaluation Queue Worker

Read the live `evaluation.queue` policy.

V1 maximum: 4 new Evaluations per run, 8 per day.

Priority:
1. closing deadline / urgency;
2. strong role-direction alignment;
3. location fit;
4. compensation signal;
5. posting recency;
6. strategic career optionality.

The Evaluation Agent follows the existing versioned Evaluation lifecycle.

Completed Evaluations remain immutable.

The Evaluation worker never creates an Application Package automatically. Candidate choice remains the pursuit gate.

## Failure and Ambiguity

If a source cannot be resolved or two Opportunities are plausible:
- do not invent a match;
- leave the intake/evaluation task waiting or blocked as appropriate;
- create a candidate review Next Action only when human judgment is actually needed.

Retries use Internal Task attempt counters and idempotency keys.

## Historical Backfill

V1 does not automatically evaluate the historical Job Alerts archive.

The system starts from the configured Gmail sync baseline, with controlled historical samples allowed only for acceptance testing.

This prevents hundreds of stale alerts from flooding the evaluation queue.

## Success Criteria

The pipeline is working when:
- repeated alerts for the same job create one Opportunity;
- a known applied job such as SoundHound is recognized as an existing Opportunity and is not reevaluated unnecessarily;
- a new current posting creates one Opportunity and one Evaluation task;
- expired postings do not reach Evaluation;
- no more than the configured number of Evaluations run per batch;
- the candidate sees the best completed Evaluations in the later Daily Work Queue rather than raw alert volume.
