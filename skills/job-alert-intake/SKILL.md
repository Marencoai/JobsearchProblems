# Job Alert Intake Batch

## Purpose

Process ready `job_alert_intake` Internal Tasks in the Diana Job Search workspace.

## Runtime Rules

Read the live `job_intake.batch` Automation Policy before every run.

Do not process more than its configured limits.

## Workflow

1. Read ready Internal Tasks where:
   - task_type = `job_alert_intake`
   - domain = `discovery`
2. Follow each task to its source Gmail Activity Event and Gmail message.
3. Read the full Gmail message.
4. Extract every real job posting present, up to the policy limit.
5. For each posting, preserve provider IDs/URLs and source facts.
6. Resolve the strongest current canonical source, preferring employer careers.
7. Verify whether the hiring event is still active when possible.
8. Deduplicate against existing Opportunity Sources and Opportunities in the required order.
9. If duplicate:
   - add/enrich Opportunity Source as needed;
   - do not create a duplicate Opportunity;
   - do not create a duplicate Evaluation task.
10. If new:
   - create/dedupe Company;
   - create Opportunity with factual source-supported fields;
   - create Opportunity Source for the email/provider and canonical source when appropriate.
11. Read Candidate Settings and apply only explicit hard-conflict screening.
12. For each viable Opportunity without a current equivalent completed Evaluation, create one `evaluate_opportunity` Internal Task owned by Evaluation Agent.
13. Complete the intake task with a concise result summary containing counts of extracted, duplicate, new, expired/closed, ambiguous, and evaluation-queued postings.

## Guardrails

- Do not evaluate the candidate during intake.
- Do not apply to jobs.
- Do not create Application Packages.
- Do not infer missing salary/location/employment facts.
- Do not reject for SQL/coding language.
- Do not reject for industry differences alone.
- Do not create duplicate Opportunities for repeated alerts.
- Do not collapse two distinct roles at the same Company.
- Employer verification must be real, not assumed.
