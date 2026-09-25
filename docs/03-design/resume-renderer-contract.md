# Resume Renderer Contract

## Canonical renderer

**Renderer key:** `modern-sidebar-v1`

**Implementation:** `renderers/resume/modern_sidebar_v1.py`

This is the canonical visual renderer for generated resumes unless an active Application Template explicitly selects a later renderer version.

## Separation of responsibilities

1. Candidate Knowledge and Evaluation determine what facts may be used.
2. Application Template determines positioning and retrieval strategy.
3. Application Material contains the approved opportunity-specific resume content.
4. The renderer controls presentation only.
5. PDF and DOCX are two representations of the same approved resume content.

The renderer must never invent, infer, or rewrite unsupported candidate facts.

## Visual contract

- clean one-page target when content permits;
- two-column layout;
- fixed pale blue sidebar extending from below the header to the bottom of every page;
- white main content area;
- navy accents and thin dividers;
- no photo;
- ATS-readable text, not rasterized content;
- skills/tools/certifications/wins in sidebar;
- summary, experience, and education in main column;
- consistent right-aligned dates;
- content may flow vertically without changing the page-level sidebar background.

## Output contract

Generate DOCX first. Convert the exact DOCX to PDF. Both files must be linked to the same Application Material version.

Before candidate delivery:
- render the DOCX/PDF to page images;
- visually inspect every page;
- reject output with clipping, overlap, broken columns, or partial sidebar backgrounds.

## Versioning

Do not silently change this renderer. Any material visual change becomes a new renderer key, for example `modern-sidebar-v2`.
