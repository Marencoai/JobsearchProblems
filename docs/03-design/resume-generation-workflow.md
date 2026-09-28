# Resume Generation Workflow

**Status:** PRODUCTION BASELINE APPROVED  
**Updated:** 2026-09-28

## Goal

Generate truthful, opportunity-specific, ATS-readable two-page resume PDFs from the completed Opportunity Evaluation and confirmed Candidate Knowledge.

## Flow

```
Opportunity + JD snapshot
        ↓
Completed Evaluation
        ↓
Candidate Knowledge retrieval
        ↓
Evidence selection
        ↓
Page-budgeted resume composition
        ↓
Structured resume content
        ↓
Content/evidence validation
        ↓
executive-brief-two-page-v1 renderer
        ↓
DOCX intermediate
        ↓
PDF conversion
        ↓
Visual QA + ATS parse-back QA
        ↓
Candidate review
        ↓
Approved/submitted Application Material
```

## Evidence Selection

Select confirmed evidence based on relevance to the employer's actual problem.

Prefer:
- direct evidence;
- strong transferable evidence;
- measurable outcomes;
- evidence that explains role scope or progression.

Do not include weak evidence merely to fill space.

## Resume Composition

Resume composition owns content selection and page budgets.

It may change emphasis and wording for the target Opportunity but may not invent experience, tools, metrics, scope, or outcomes.

### Page 1 content budget

Page 1 is the executive brief:
- Professional Summary: roughly 60-90 words;
- Core Capabilities: max 12;
- Selected Impact: exactly 4 when supported;
- Selected Projects & Systems: max 3;
- Tools & Platforms: generally max 12;
- Certification & Education: concise.

### Page 2 content budget

Page 2 contains Professional Experience only.

Recommended bullet budget:
- recent/high-relevance roles: 3-4;
- mid-priority roles: 2-3;
- older/supporting roles: 1-2.

If content is too long, remove or shorten lower-priority material before changing typography.

## Renderer

The canonical renderer is:

`executive-brief-two-page-v1`

See:
- `docs/03-design/resume-pdf-rendering-spec.md`
- `docs/03-design/resume-renderer-contract.md`

The renderer owns presentation only. It does not decide whether a claim is true.

## QA

Every output must pass:

### Visual QA
- exactly two pages;
- no clipping or overlap;
- no accidental third page;
- approved Page 1 / Page 2 structure;
- readable typography;
- intentional spacing.

### ATS / Parse-Back QA
Confirm recovery of:
- candidate/contact;
- headings;
- capabilities;
- impact;
- projects;
- experience;
- dates;
- quantified outcomes;
- tools;
- certification;
- education.

## Application Package Behavior

Generating a resume does not mean an application was submitted.

The resume belongs to an Application Package and remains a preparation artifact until the candidate approves and later confirms submission.

Submitted materials must preserve the exact version and artifact actually sent.
