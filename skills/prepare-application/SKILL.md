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

## Workflow

1. Read the Opportunity, completed Evaluation, Application Gaps, Candidate Settings, and relevant confirmed Candidate Knowledge.
2. Resolve the active Application Template that matches the Opportunity Job Family.
3. Create or reuse the Application Package.
4. Move Package to `preparing`.
5. Create/update the Application Brief as a versioned Material.
6. Compose the resume using confirmed evidence only.
7. Apply the Template's renderer key.
8. Current production renderer is `executive-brief-two-page-v1`.
9. Render:
   - Page 1: Professional Summary, Core Capabilities, Selected Impact, Selected Projects & Systems, Supporting Information.
   - Page 2: Professional Experience only.
10. Enforce content budgets before rendering:
   - summary ~60-90 words;
   - max 12 capabilities;
   - 4 impact items when supported;
   - max 3 projects/systems;
   - generally max 12 tools;
   - experience bullets prioritized by relevance and recency.
11. Generate DOCX and convert the exact DOCX to PDF.
12. Visually inspect both pages.
13. Parse PDF text and confirm ATS-readable extraction.
14. If QA fails, create a new Material version rather than editing prior immutable content.
15. Link evidence snapshots to the final current resume Material.
16. Build application-answer material from confirmed `candidate_settings.application_defaults`, plus Opportunity-specific questions when actually available.
17. Do not infer sensitive or unconfirmed answers.
18. Move final current Materials to `candidate_review`.
19. Move Package to `ready_for_review` only when current required Materials are ready.
20. Stop. Candidate approval is a separate human-authority step.

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
- Never silently mutate approved/submitted historical Materials.
- Never approve or submit an Application.
