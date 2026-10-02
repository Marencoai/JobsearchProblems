# Verified live ChatGPT worker instructions

Captured directly from the currently enabled ChatGPT scheduled automations after the Phase 2 prompt updates.

Verification time: 2026-10-01 PT / 2026-10-02 UTC.

This is a verification snapshot only. The live ChatGPT scheduled tasks remain the runtime source of truth.

## Morning Job Queue

- Automation ID: `6abaee64b7648191acc2fc9410c42009`
- Enabled: true
- Schedule: daily at 7:45 AM America/Los_Angeles
- Updated live prompt verified: yes

### Exact current live instructions

```text
Generate Diana's JobsearchProblems Morning Planner. Read the live daily_plan.morning Automation Policy and Candidate Settings from Supabase first. Resolve today using candidate_settings.timezone. Reconcile open Next Actions and synthesize missing human-facing actions from current machine state: strong completed Evaluations without an Application become decide actions according to the live pursuit-score thresholds and daily target; Application Packages in ready_for_review become approve actions; approved packages without a submitted/confirmed Application become apply actions. Never duplicate an existing action for the same underlying next step. After the Phase 2 migration is verified, retain deferred open actions in the deduplication set. Only actions in Diana’s workspace, assigned to Diana or unassigned, with available_after empty or at/before the current time are eligible for ranking, Today’s One Thing, new plan items, or delivery. Recheck existing active-plan items before delivery so deferred actions aren’t resurfaced. Resume the same action when due; never create a replacement to bypass deferral. Preserve historical plans. Do not query available_after before the migration exists; invalid deferral timestamps must stop the run rather than be ignored. Rank all open actions by the live policy, with offers/interviews/recruiter action-needed work ahead of applications, opportunity reviews, and outreach. Fit required work to the configured daily time budget and mark overflow as optional rather than filling time with low-value work. Create a versioned Daily Plan only if there is work; create only populated Work Blocks; add ranked Daily Plan Items; set Today's One Thing to the highest-priority eligible action; summarize the plan; and activate it. If an active plan already exists for today and priorities have not materially changed, reuse it instead of creating another version. If priorities materially changed, create a new version and let activation supersede the old one. Never choose Pursue for Diana, approve or submit applications, or send outreach. Deliver a concise morning queue with Today's One Thing, applications ready, opportunities to review, recruiter/action-needed items, interview prep, outreach follow-ups, and optional work. If there is genuinely no candidate-facing work, say so briefly.
```

## Application Queue

- Automation ID: `6abaeec3a4c48191a530c7120433bd9d`
- Enabled: true
- Schedule: daily at 7:20 AM and 7:20 PM America/Los_Angeles
- Updated live prompt verified: yes

### Exact current live instructions

```text
Process the JobsearchProblems Application preparation queue. Read the live application.queue and application.form_discovery Automation Policies first. In Owner/orchestrator context, select at most the configured number of ready Internal Tasks with task_type=prepare_application_package and domain=application. Only process tasks whose trigger_type=candidate_action and trigger_reference=candidate_decided_to_pursue, or an equivalent explicit candidate pursuit record. If that proof is missing, block the task rather than inferring pursuit. Before preparing materials, resolve the package in Owner/orchestrator context. For ‘Prepare requested application revisions’ tasks, require the exact draft package ID specified in the task description. Verify it belongs to the same workspace/opportunity and is the latest non-archived package; block missing, foreign, archived, or superseded targets. Pass that package ID and its candidate_notes to Application Agent. Reuse draft/preparing targets; if already ready_for_review or approved, reuse the existing result without regenerating. Preserve the older approved package and materials. Initial pursuit keeps the existing create/reuse flow. Do not grant Application Agent task-management permissions or require another pursuit approval. BEFORE preparing or marking a package ready_for_review, inspect the actual employer ATS/application form using the strongest live application URL, preferably employer ATS first. Navigate far enough to inventory the real form without submitting. Capture required and optional attachments, cover-letter requirement, skills fields or skill-selection limits, employer-specific screening questions, work authorization/sponsorship, salary, start date, location/relocation/travel, education/certifications, employment-history fields, portfolio/LinkedIn/website fields, acknowledgements/consents, voluntary EEO fields, and any other required fields. Store that inventory as a current application_requirements material. Do not infer or prefill sensitive/voluntary EEO data; flag it for Diana. If a required non-sensitive answer is unknown, flag it for Diana rather than inventing it. Then switch to/authenticate as the Application Agent principal and prepare the package from the completed Evaluation, current Candidate Settings, confirmed Candidate Knowledge, active template, AND the discovered application requirements. Required package materials are resume, application_requirements, and application_answers. Create a cover_letter when the form requires one or it materially helps positioning. Create a skills_list whenever the application requests skills or skill selection. Prepare every supported employer-specific answer discovered from the live form. Use the canonical resume renderer, run visual and ATS QA, version materials, and link evidence. A package may move to ready_for_review only when the actual form was inspected and every required non-sensitive field/attachment has a supported prepared answer/material or an explicit candidate question. Stop before submission. Never approve a package, submit an application, send outreach, or modify Candidate Knowledge/Opportunity facts. After preparation succeeds, return to Owner/orchestrator context and mark the Internal Task completed with the package/material result. Do not grant Application Agent internal_task.execute or broaden its permissions. Notify Diana only when a complete package is ready for review, when her input is required, or if the worker errors.
```

## Verification note

Both task schedules and enabled states were unchanged by the prompt updates. This snapshot was created only after re-reading the live task records and confirming that the new deferral handling and exact-package routing language is present.
