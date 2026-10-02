# Live ChatGPT worker instructions snapshot

Captured from the currently enabled ChatGPT scheduled automations on 2026-10-01.

This file is a read-only snapshot for Job Hunt HQ rollout comparison. It does not update the automations by itself.

## Morning Job Queue

- Automation ID: `6abaee64b7648191acc2fc9410c42009`
- Schedule: daily at 7:45 AM America/Los_Angeles
- Purpose: Morning Planner

### Current instructions

```text
Generate Diana's JobsearchProblems Morning Planner. Read the live daily_plan.morning Automation Policy and Candidate Settings from Supabase first. Resolve today using candidate_settings.timezone. Reconcile open Next Actions and synthesize missing human-facing actions from current machine state: strong completed Evaluations without an Application become decide actions according to the live pursuit-score thresholds and daily target; Application Packages in ready_for_review become approve actions; approved packages without a submitted/confirmed Application become apply actions. Never duplicate an existing action for the same underlying next step. Rank all open actions by the live policy, with offers/interviews/recruiter action-needed work ahead of applications, opportunity reviews, and outreach. Fit required work to the configured daily time budget and mark overflow as optional rather than filling time with low-value work. Create a versioned Daily Plan only if there is work; create only populated Work Blocks; add ranked Daily Plan Items; set Today's One Thing to the highest-priority eligible action; summarize the plan; and activate it. If an active plan already exists for today and priorities have not materially changed, reuse it instead of creating another version. If priorities materially changed, create a new version and let activation supersede the old one. Never choose Pursue for Diana, approve or submit applications, or send outreach. Deliver a concise morning queue with Today's One Thing, applications ready, opportunities to review, recruiter/action-needed items, interview prep, outreach follow-ups, and optional work. If there is genuinely no candidate-facing work, say so briefly.
```

## Application Queue

- Automation ID: `6abaeec3a4c48191a530c7120433bd9d`
- Schedule: daily at 7:20 AM and 7:20 PM America/Los_Angeles
- Purpose: Application preparation worker

### Current instructions

```text
Process the JobsearchProblems Application preparation queue. Read the live application.queue and application.form_discovery Automation Policies first. In Owner/orchestrator context, select at most the configured number of ready Internal Tasks with task_type=prepare_application_package and domain=application. Only process tasks whose trigger_type=candidate_action and trigger_reference=candidate_decided_to_pursue, or an equivalent explicit candidate pursuit record. If that proof is missing, block the task rather than inferring pursuit. BEFORE preparing or marking a package ready_for_review, inspect the actual employer ATS/application form using the strongest live application URL, preferably employer ATS first. Navigate far enough to inventory the real form without submitting. Capture required and optional attachments, cover-letter requirement, skills fields or skill-selection limits, employer-specific screening questions, work authorization/sponsorship, salary, start date, location/relocation/travel, education/certifications, employment-history fields, portfolio/LinkedIn/website fields, acknowledgements/consents, voluntary EEO fields, and any other required fields. Store that inventory as a current application_requirements material. Do not infer or prefill sensitive/voluntary EEO data; flag it for Diana. If a required non-sensitive answer is unknown, flag it for Diana rather than inventing it. Then switch to/authenticate as the Application Agent principal and prepare the package from the completed Evaluation, current Candidate Settings, confirmed Candidate Knowledge, active template, AND the discovered application requirements. Required package materials are resume, application_requirements, and application_answers. Create a cover_letter when the form requires one or it materially helps positioning. Create a skills_list whenever the application requests skills or skill selection. Prepare every supported employer-specific answer discovered from the live form. Use the canonical resume renderer, run visual and ATS QA, version materials, and link evidence. A package may move to ready_for_review only when the actual form was inspected and every required non-sensitive field/attachment has a supported prepared answer/material or an explicit candidate question. Stop before submission. Never approve a package, submit an application, send outreach, or modify Candidate Knowledge/Opportunity facts. After preparation succeeds, return to Owner/orchestrator context and mark the Internal Task completed with the package/material result. Do not grant Application Agent internal_task.execute or broaden its permissions. Notify Diana only when a complete package is ready for review, when her input is required, or if the worker errors.
```

## Rollout note

Use these exact live instructions to compare against the reviewed worker contracts for Phase 2. Do not replace either automation blindly. Prepare the minimum safe edits needed for deferral handling and exact revision-package routing, then present those edits for review before changing the live scheduled tasks.
