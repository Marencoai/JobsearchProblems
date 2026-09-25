# Vet This Job

## Purpose

Use this skill when Diana says **"vet this job"** and pastes a job description.

The goal is to run the existing JobsearchProblems evaluation workflow against the pasted job description and return a concise, evidence-backed decision brief.

This skill is for **job vetting only**. It does not submit an application, contact anyone, send messages, or perform external actions unless Diana separately asks for that.

## Trigger

Run when the user says something equivalent to:

- vet this job
- evaluate this job
- is this job worth applying to
- run this through the job system

and provides a job description in the same message or immediately after.

If the job description is missing, ask the user to paste it.

## Authoritative Systems

- Supabase project: `JobsearchProblems`
- Production candidate workspace: `Diana Job Search`
- Workspace ID: `9341c194-c4f6-45c4-b3b1-37a832a7fc68`
- Candidate Knowledge in Supabase is the source of truth for professional history and evidence.
- Candidate Settings in Supabase are the source of truth for current preferences.
- The pasted job description is the source of truth for the Opportunity being vetted unless a later source explicitly replaces or verifies it.

Do not rely on resume memory when the database contains structured Candidate Knowledge.

## Current Candidate Settings Principles

Read Candidate Settings every time before scoring because they may change.

Important current behavior:

- Compensation is evaluated against the current minimum in Candidate Settings.
- Remote and San Diego opportunities are favored according to stored preferences.
- Do not reject a role merely because the title, industry, SQL requirement, coding terminology, or technical language is unfamiliar.
- Infer transferable ability only from confirmed Candidate Knowledge evidence.
- Distinguish a true capability gap from a domain-learning or terminology gap.
- Urgency is part of Opportunity Fit and pursuit prioritization.

## Workflow

### 1. Parse the pasted JD

Extract factual fields when available:

- company
- role title
- requisition/job ID
- location
- work arrangement
- employment type
- salary range
- source/provider
- source URL
- full job description
- posting/closing dates if stated

Do not invent missing fields.

### 2. Deduplicate the Company and Opportunity

Check the `Diana Job Search` workspace for an existing Company and Opportunity.

Use the strongest available identifiers in this order:

1. requisition/external job ID
2. canonical URL
3. company + normalized title + clearly same active hiring event

If it is the same Opportunity, enrich/update source information rather than creating a duplicate.

If it is a genuinely new hiring event, create a new Opportunity.

### 3. Store the Opportunity

Create or update:

- `companies`
- `opportunities`
- `opportunity_sources`

For a user-pasted JD:

- preserve the full pasted JD in `job_description_text`
- add an Opportunity Source identifying it as user-provided/pasted content
- set the Opportunity to an appropriate active stage such as `verified` or `evaluating`

Do not mark a job verified from an external company source unless it was actually verified.

### 4. Translate the job into plain English

Create a short **problem translation** answering:

> What is this company actually hiring someone to solve?

Focus on:

- business problem
- day-to-day work
- decision ownership
- systems/process responsibilities
- expected outcomes
- success metrics

Avoid simply restating the JD.

### 5. Retrieve Candidate Knowledge

Query only relevant confirmed Candidate Knowledge:

- Work Experiences
- Projects
- Evidence Stories
- Skills with confirmed support
- Tools with explicit supported relationships

Prefer specific Evidence Stories and Projects over generic keyword matches.

Do not use rejected evidence.

Do not treat `candidate_review_needed` evidence as direct confirmed support.

### 6. Build an evidence trace

For each major requirement or responsibility, classify it as one of:

- **Direct match**: confirmed evidence of substantially the same work
- **Transferable match**: confirmed evidence of the same underlying problem/capability in another domain
- **Partial match**: some relevant evidence, but meaningful pieces are missing
- **True gap**: no confirmed evidence that the candidate has done the work
- **Unknown**: the JD or Candidate Knowledge does not provide enough information

Use evidence titles and outcomes, not unsupported assumptions.

### 7. Read Candidate Settings

Before scoring, read the current `candidate_settings` row for the workspace.

Use:

- role preferences
- location preferences
- compensation preferences
- company preferences
- work-style preferences
- travel preferences
- career direction
- job-search urgency

Do not reuse stale preference values from prior evaluations.

### 8. Score the Opportunity

Create or update a versioned Evaluation.

Score 0–100:

#### Candidate Fit: You → Them

How strongly the confirmed Candidate Knowledge supports the employer's actual needs.

Consider:

- problem similarity
- responsibility similarity
- evidence depth
- measurable outcomes
- tool/system overlap
- leadership/scope
- true gaps

Do not punish domain differences as heavily as missing underlying capability.

#### Opportunity Fit: Them → You

How well the role fits the candidate's current goals and constraints.

Consider:

- compensation
- location/work arrangement
- role direction
- career optionality
- autonomy/clarity
- learning
- measurable impact
- culture/company factors when known
- current urgency

Unknown company/culture information should reduce confidence rather than be invented.

#### Pursuit Score

A practical prioritization score incorporating:

- Candidate Fit
- Opportunity Fit
- urgency
- strategic value
- known blockers
- application effort
- evidence confidence

A Pursuit Score is not a guarantee of interview or offer probability.

### 9. Complete the Evaluation

Store:

- problem translation
- Candidate Fit score
- Opportunity Fit score
- Pursuit Score
- opportunity type
- evidence confidence
- strengths summary
- tradeoffs/gaps
- company fit summary
- career optionality
- unresolved questions
- recommended next action
- Evaluation Evidence snapshots

Completed Evaluations must remain immutable. A later materially different assessment should create a new version.

### 10. Return the vetting brief

Default response should be concise and scannable:

**[Company] — [Role]**

- Candidate Fit: X/100
- Opportunity Fit: X/100
- Pursuit Score: X/100
- Evidence confidence: High / Medium / Low

**What they're really hiring for**
One short plain-English paragraph.

**Why you match**
3–6 strongest evidence-backed matches.

**Real gaps**
Only meaningful true/partial gaps. Separate domain-learning gaps from capability gaps.

**Watch-outs / unknowns**
Important information the JD does not answer.

**Next action**
State the system recommendation and the positioning angle.

If the recommendation is to pursue, do not automatically build the Application Package unless Diana asks.

## Guardrails

- Never invent candidate experience.
- Never convert a source-derived preference into a hard requirement unless Candidate Settings says it is one.
- Never treat a Tool taxonomy row alone as proof of proficiency.
- Never use unconfirmed evidence as direct proof.
- Never submit an application automatically.
- Never send outreach automatically.
- Never alter Candidate Knowledge merely because a JD uses new terminology.
- Do not create Career Development Gaps from a single posting.
- Do not web-research the company unless requested or the workflow explicitly needs current company intelligence.
- When web/company research is unavailable, label company/culture factors as unknown.
- Preserve the distinction between:
  - can Diana do this job?
  - is this job good for Diana?
  - is this job worth spending time on right now?

## Success Condition

The skill is successful when Diana can paste a JD and receive an evidence-backed vetting result without manually re-explaining her career, preferences, or evaluation criteria.
