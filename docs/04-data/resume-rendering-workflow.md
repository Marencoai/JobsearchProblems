# Resume Rendering Workflow

When an Application Package reaches resume generation:

1. Read the completed Evaluation and active Candidate Settings.
2. Retrieve only validated Candidate Knowledge appropriate to the opportunity.
3. Generate opportunity-specific resume content and save it as a versioned Application Material.
4. Link supporting Evidence Stories/Projects to that Application Material.
5. Resolve the active Application Template.
6. Read its renderer key. Current AI Transformation template uses `modern-sidebar-v1`.
7. Serialize the approved content into the renderer input schema.
8. Run `renderers/resume/modern_sidebar_v1.py` to create DOCX.
9. Convert that DOCX to PDF.
10. Render both for visual QA.
11. Store the file references on the same Application Material version.
12. Move material to `candidate_review`.
13. Never create an Application row merely because materials were prepared.

If content overflows one page, preserve readability. Do not shrink below the renderer's minimum readable typography merely to force one page.
