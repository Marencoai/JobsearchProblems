# Resume Rendering Workflow

When an Application Package reaches resume generation:

1. Read the completed Evaluation and active Candidate Settings.
2. Retrieve only validated Candidate Knowledge appropriate to the Opportunity.
3. Resolve the active Application Template for the Opportunity / Job Family.
4. Read the renderer key from the active Template.
5. Compose page-budgeted opportunity-specific resume content.
6. Save the content as a new versioned Application Material.
7. Link supporting Evidence Stories / Projects to that exact Application Material version.
8. Serialize the content into the selected renderer input schema.
9. Run the renderer to create DOCX.
10. Convert that exact DOCX to PDF.
11. Render every PDF page to images for visual QA.
12. Extract PDF text for ATS / parse-back QA.
13. Only after both QA gates pass, move the Material to `candidate_review`.
14. Never create or submit an Application merely because materials were prepared.

## Current Canonical Renderer

Current production renderer key:

`executive-brief-two-page-v2`

Implementation:

`renderers/resume/executive_brief_two_page_v1.py`

Active production Application Templates should select this renderer unless a later approved renderer version replaces it.

## Fixed Two-Page Architecture

### Page 1: Executive Brief

Page 1 answers:

> What can Diana do for this employer?

Fixed order:
1. Candidate header
2. Professional Summary
3. Core Capabilities
4. Selected Impact
5. Selected Projects & Systems
6. Supporting Information

Content budgets:
- Summary: roughly 60-90 words
- Capabilities: max 12
- Selected Impact: exactly 4 when supported
- Projects & Systems: max 3
- Tools & Platforms: generally max 12
- Credentials: concise

### Page 2: Professional Experience

Page 2 answers:

> What career evidence proves the Page 1 claims?

All selected chronological Professional Experience belongs on Page 2.

Recommended bullet budget:
- recent / high-relevance roles: 3-4
- mid-priority roles: 2-3
- older / supporting roles: 1-2

## Overflow Rule

The renderer does not solve overflow by shrinking typography.

If content does not fit:
1. remove redundant wording;
2. remove lower-priority supporting bullets;
3. reduce lower-priority project/supporting detail;
4. preserve the strongest evidence;
5. keep the approved typography and two-page architecture.

A third page means resume composition must be revised before candidate delivery.

## Versioning Rule

Any content change creates a new Application Material version.

Never edit the content of an existing Application Material in place.

The active Template version, renderer key, Evaluation version, evidence snapshots, and final rendered artifact should remain attributable to the Material version used for candidate review or submission.

Historical resumes created with older renderers remain unchanged for reproducibility.
