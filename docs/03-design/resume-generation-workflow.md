# Resume Generation Workflow

**Status:** DESIGN BASELINE APPROVED  
**Updated:** 2026-09-25

## Goal

Generate truthful, opportunity-specific, ATS-readable resume PDFs from the completed Opportunity Evaluation and confirmed Candidate Knowledge.

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
Opportunity-specific resume composition
        ↓
Structured resume content
        ↓
Content/evidence validation
        ↓
Approved PDF renderer
        ↓
Visual QA + ATS parse-back QA
        ↓
Candidate review
        ↓
Approved/submitted Application Material
```

## Responsibilities by Layer

### Evidence Selection

Determines which validated facts are most relevant to the employer's actual problem.

Evidence should be classified by importance to the target Opportunity. Strong employer relevance and direct/transferable evidence receive priority.

### Resume Composition

Turns selected evidence into concise resume content.

It may change emphasis and wording for the target role, but may not invent experience, tools, metrics, scope, or outcomes.

### PDF Renderer

Applies the approved visual specification.

The renderer does not decide whether a claim is true and does not rewrite candidate content.

See: `docs/03-design/resume-pdf-rendering-spec.md`.

### QA

The output must pass both visual QA and PDF text parse-back QA before candidate review.

## Current Scope

PDF is the production output target.

DOCX generation is intentionally deferred. A future Word renderer may use the same structured resume content, but it should be treated as a separate rendering implementation rather than forcing the PDF design to behave like Word.

## Application Package Behavior

Generating a resume does not mean an application was submitted.

The resume belongs to an Application Package and remains a preparation artifact until the candidate approves and later confirms submission.

Submitted materials must preserve the exact version actually sent.
