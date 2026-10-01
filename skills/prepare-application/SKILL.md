# Prepare Application

## Purpose

Use this skill when a completed Opportunity Evaluation has been selected for pursuit and Diana wants the application package prepared.

The Application Agent prepares internal application materials only. It does not approve, submit, confirm, send outreach, or modify Candidate Knowledge.

## Authoritative Systems

- Supabase project: `JobsearchProblems`
- Workspace: `Diana Job Search`
- Candidate Knowledge: source of truth for professional facts/evidence
- Candidate Settings: source of truth for reusable candidate defaults and preferences
- Completed Evaluation: source of truth for Opportunity-specific positioning, gaps, and evidence relevance
- Active Application Template: source of truth for Job Family positioning and renderer selection
- Actual employer ATS/application form: source of truth for what the candidate will really be asked to provide

## Application Agent Identity

Authenticate as:
- Principal: `Application Agent`
- Auth identity: `applicationuser@marencoai.com`

Required permission:
- `application.prepare`

The agent must not have:
- `application.approve`
- `application.submit`
- `application.confirm`
- `application_template.manage`
- Candidate Knowledge modification
- Opportunity modification
- Workspace role administration

## Mandatory Application-Form Discovery

Before a package may be marked `ready_for_review`, inspect the real employer application/ATS form using the strongest available apply URL.

Preferred source order:
1. employer ATS apply page;
2. employer careers application link;
3. provider application page.

Navigate far enough to inventory the form, but do not submit.

Capture:
- final apply URL and ATS provider;
- required and optional attachments;
- cover-letter requirement and format;
- skills field, skill-selection behavior, and any item/count limit;
- employer-specific screening questions;
- work authorization and sponsorship questions;
- compensation questions;
- start-date questions;
- location, relocation, and travel questions;
- education and certification fields;
- employment-history fields;
- portfolio, LinkedIn, and website fields;
- consent/acknowledgement fields;
- voluntary EEO/demographic fields;
- any other required or unusual application fields.

Store this as a current `application_requirements` Material.

Never infer or pre-fill voluntary EEO or other sensitive demographic answers. Surface them to Diana.

If a required non-sensitive answer is unknown, surface a candidate question rather than inventing an answer.

If the application page cannot be fully inspected with a static fetch because it is JavaScript-rendered, use a browser-capable workflow. A package is not complete merely because the public job description was retrieved.

## Workflow

1. Read the Opportunity, completed Evaluation, Application Gaps, Candidate Settings, and relevant confirmed Candidate Knowledge.
2. Resolve the strongest live employer application URL.
3. Complete Mandatory Application-Form Discovery and create/update `application_requirements`.
4. Resolve the active Application Template that matches the Opportunity Job Family.
5. Create or reuse the Application Package.
6. Move Package to `preparing`.
7. Create/update the Application Brief as a versioned internal Material.
8. Compose the resume using confirmed evidence only.
9. Apply the Template's renderer key.
10. Current production renderer is `executive-brief-two-page-v2`.
11. Render:
   - Page 1: Professional Summary, Core Capabilities, Selected Impact, Selected Projects & Systems, Supporting Information.
   - Page 2: Professional Experience only.
12. Enforce content budgets before rendering:
   - summary ~60-90 words;
   - max 12 capabilities;
   - 4 impact items when supported;
   - max 3 projects/systems;
   - generally max 12 tools;
   - experience bullets prioritized by relevance and recency.
13. Generate DOCX and convert the exact DOCX to PDF.
14. Visually inspect both pages.
15. Parse PDF text and confirm ATS-readable extraction.
16. If QA fails, create a new Material version rather than editing prior immutable content.
17. Link evidence snapshots to the final current resume Material.
18. Build `application_answers` from confirmed `candidate_settings.application_defaults` plus every actual Opportunity-specific question discovered on the form.
19. Create `skills_list` whenever the application requests skills or skill selection. Use only supported Candidate Knowledge.
20. Create `cover_letter` when required by the form or when it materially helps position a real gap. Do not create generic filler.
21. Prepare any other required attachment or answer revealed by the actual form.
22. Do not infer sensitive or unconfirmed answers.
23. Move final current Materials to `candidate_review`.
24. Move Package to `ready_for_review` only when:
   - the actual application form has been inspected;
   - required attachments are prepared;
   - required non-sensitive fields have supported answers or an explicit candidate question;
   - sensitive/voluntary fields are clearly surfaced for Diana;
   - the Apply URL is stored and available in the review experience.
25. Stop. Candidate approval is a separate human-authority step.

## Resume Narrative Contract

Page 1 sells the candidacy.

Page 2 proves it.

Do not split chronological Professional Experience across pages and do not place Professional Experience on Page 1.

Do not redesign the resume per Opportunity. Only content selection, wording, headline, capabilities, impact, projects, tools, scope lines, and bullets may vary.

## Guardrails

- Never invent experience or metrics.
- Never use unconfirmed evidence as proof.
- Never shrink typography to force fit.
- Never allow a third page without revising composition.
- Never add visible footer text, renderer/version labels, or internal QA markers to the candidate-facing resume.
- Never silently mutate approved/submitted historical Materials.
- Never call a package complete based only on the public job description when an ATS form exists.
- Never submit an Application.

## Scheduled Queue Orchestration

When this skill is invoked from the scheduled Application Queue:

1. the Owner/orchestrator selects and manages the `prepare_application_package` Internal Task;
2. the task must contain explicit candidate pursuit authority, normally:
   - `trigger_type = candidate_action`
   - `trigger_reference = candidate_decided_to_pursue`;
3. the actual ATS/application form is inspected before package readiness;
4. the Application Agent performs only application-preparation writes permitted by `application.prepare`;
5. the Application Agent does not need and must not be granted `internal_task.execute`;
6. after preparation succeeds, the Owner/orchestrator records the Internal Task result and completes the task;
7. the package stops at `ready_for_review` and remains a human approval gate.

## HQ Revision Requests

The proposed HQ human-action RPC queues revisions through the same explicit candidate-action contract. A revision task description identifies the new draft Package and the candidate's requested changes. Validate that Package belongs to the task's Workspace and Opportunity, reuse that draft, read its `candidate_notes`, and prepare new Material versions there. Never choose the older approved Package or mutate its historical Materials. Initial pursuit tasks continue through the existing create/reuse flow. No additional pursuit or strategy approval is required.

This preserves the distinction between machine orchestration authority, narrow Application Agent authority, and the candidate's authority to approve and submit.
