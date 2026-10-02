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

Before preparation, the existing Owner/orchestrator executes this boundary helper from the repository root:

```sh
node --experimental-strip-types worker-support/cli.mts preparation < synthetic-or-authorized-preparation-input.json
```

Pass JSON with `task` (workspace, opportunity, task type/domain, explicit candidate trigger, title/description) and accessible `packages` (IDs, workspace/opportunity, package number, status, candidate notes). Pass the validated resulting Package ID and notes to the Application Agent; the agent does not need Internal Task read/execute permission. `reuse` means prepare that exact draft/working Package, `create` preserves the initial-pursuit creation flow, and `already_ready` means reuse existing reviewed results without regenerating. Missing/foreign/archived/superseded revision targets or missing candidate authority fail closed. This helper does not compose materials, write data, or change authority. Retain the existing worker workflow and permissions. Use Node 22 or newer, with no credentials in the input.

This preserves the distinction between machine orchestration authority, narrow Application Agent authority, and the candidate's authority to approve and submit.

## Proposed exact-file publication (not deployed)

After the separately proposed intake/material-delivery migration and actual worker adoption are approved, publish exact files while the selected Material is a current `draft`, before moving it to `candidate_review`. Existing `application.prepare` authority is sufficient; no approval, submission, task-execution or service credential is added.

Keep the canonical renderer unchanged. Serialize exact renderer input, render DOCX, convert that exact DOCX to PDF, visually inspect every page and parse PDF text. Resume QA requires exactly two pages with `executive-brief-two-page-v2`. Bind QA to SHA-256 of exact input, DOCX and PDF plus renderer key/page count. Never attest to uninspected bytes.

Where the actual runtime has the repository and Node 22+, this optional helper produces the two registration rows:

```sh
node --experimental-strip-types worker-support/material-artifacts.mts context.json renderer-input.json final.docx final.pdf qa.json
```

It does not render, QA, upload, approve or write. Without that runtime, follow its self-contained provenance contract. Context contains exact Material ID, Workspace, type/status/current-version state and renderer key. QA contains `visual_pass`, `parse_back_pass`, integral `page_count`, `renderer_key`, `input_sha256`, `docx_sha256`, `pdf_sha256` for the exact bytes.

Upload privately to `hq-materials` at `{workspace}/{material}/{sha256}.docx` and `.pdf`, correct MIME and no upsert. Read back and verify bytes using the same narrow prepare identity. Insert immutable `application_material_artifacts` rows, preferably together in one transaction; reread and verify both share provenance. Publication failure keeps the package preparing with a clear blocker. Uncertain retries reuse exact paths/bytes and reread existing registrations, never overwrite. Corrected content/conversion creates a new Material version. Historical registrations and bytes remain unchanged when later approved/submitted.

## Proposed approved ATS packet contract (not deployed)

Preserve existing `application_requirements`, `application_answers`,
`skills_list`, resume, cover-letter and other Material types. Store the following
bounded version1 JSON in `content_text` before candidate review; no new answer
table or authority is needed. Do not create a second strategy approval gate.

Requirements include `contract_version:1`, `form_inspected:true`, inspected
public HTTPS `apply_url`, optional `ats_provider`, `attachments` (each exact
`material_type` and boolean `required`) and `fields` (unique nonempty `key`,
actual employer `label`, boolean `required`, boolean `sensitive`). Maximum200
fields/30 attachment types; unique keys/types; text bounded to250KB, field key
100 chars/label300 and answer10000. Canonical ATS must come from actual form
inspection, not a URL guessed from prose. If inspection is unavailable, follow
the existing readiness blocker rather than assert `form_inspected=true`.

Answers include `contract_version:1`, `requirements_material_id` bound to that
exact current requirements Material, and up to200 unique `answers`: `field_key`,
`state` (`confirmed`, `candidate_question`, or `voluntary`), plus recorded
`value` or plain candidate `question`. Include actual salary/work authorization,
skills selection, portfolio/LinkedIn/website and every employer-specific field
that the inspected form requests. Confirmed values require supported Candidate
Knowledge, confirmed application defaults or Diana's recorded response. Do not
infer sensitive/voluntary values; record their choice state without a suggested
value. Unknown non-sensitive answers remain explicit questions.

Requirements/answers are current draft Material versions in the same exact
Package/Workspace. Copy/Download only uses approved current versions. Changes
to either form requirements or answers require new immutable versions and
updated exact references before review; never overwrite approved/submitted
answers. Existing submission snapshots retain exact `content_text` and Material
IDs alongside file provenance. Candidate questions must be resolved in a new
reviewed package before the frontend accepts submission confirmation. The UI
does not autofill or submit, and ATS navigation never records submission.

This additive repository contract requires actual hosted Application Queue
adoption/readback under the existing workflow gate. Legacy text remains
inspectable but does not certify structured field completeness; it must never
be silently rewritten or treated as invented confirmed answers.
