# Resume Renderer Contract

## Canonical renderer

**Renderer key:** `executive-brief-two-page-v2`

**Implementation:** `renderers/resume/executive_brief_two_page_v2.py`

This is the canonical visual renderer for newly generated resumes unless an active Application Template explicitly selects a later renderer version.

## Narrative contract

Page 1 answers:

> What can Diana do for this employer?

Page 2 answers:

> What career evidence proves it?

The renderer therefore keeps all positioning and supporting evidence on Page 1 and all selected chronological Professional Experience on Page 2.

## Separation of responsibilities

1. Candidate Knowledge and Evaluation determine which facts may be used.
2. Application Template determines positioning and retrieval strategy.
3. Resume composition applies the page-level content budgets.
4. Application Material preserves the opportunity-specific resume content.
5. The renderer controls visual presentation only.
6. Visual QA and ATS parse-back QA gate candidate review.

The renderer must never invent, infer, or strengthen unsupported candidate facts.

## Required structured input

The renderer expects:
- `name`
- `headline`
- `contact`
- `summary`
- `capabilities`
- `impact`
- `projects`
- `tools`
- `certifications`
- `education`
- `experience`

Experience entries contain:
- `title`
- `company`
- `dates`
- optional `scope`
- `bullets`

## Fixed page architecture

Page 1:
- Header
- Professional Summary
- Core Capabilities
- Selected Impact
- Selected Projects & Systems
- Supporting Information

Page 2:
- Compact continuation header
- Professional Experience

The renderer inserts the page break explicitly. Resume composition must fit the content budget before rendering.

## Output contract

Generate DOCX first, then convert that exact DOCX to PDF.

PDF is the candidate-facing production artifact. DOCX is the deterministic rendering intermediate and may also be retained for reproducibility.

Both representations must correspond to the same Application Material version.

Before candidate delivery:
- render every PDF page to images;
- visually inspect both pages;
- parse PDF text;
- reject output with clipping, overlap, accidental third pages, broken reading order, or missing critical text.

## Versioning

Do not silently change this renderer.

Any material visual change becomes a new renderer key, for example `executive-brief-two-page-v3`.

Production resumes contain no visible footer text or internal QA/version labels. Historical materials created with `modern-sidebar-v1`, `executive-brief-two-page-v1`, or other prior renderer versions remain reproducible and are not retroactively rewritten.
