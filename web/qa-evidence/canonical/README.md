# Canonical synthetic document evidence

This pair uses fictional **Casey Example**, not Diana's candidate facts or an
employer application. The unchanged `executive-brief-two-page-v2` renderer
generated `resume-v1.docx`; that exact DOCX was converted to `resume-v1.pdf`.
Both page images were visually inspected: readable typography, no clipping or
overlap, positioning on page1 and Professional Experience only on page2.
Parse-back retains every supplied capability, metric, project, supporting fact,
role/scope/bullet, company and date; every text span fits its US-letter page.
Page2 whitespace is retained rather than forcing extra content or a third page.

`qa.json` binds exact input/DOCX/PDF hashes and the two-page QA.
`artifact-manifest.json` comes from the existing pure publication helper.
`canonical-delivery.test.ts` sends these actual bytes through the real SDK with
mocked HTTP and checks unchanged byte/hash/version delivery in both formats,
foreign-version denial and altered pair-provenance refusal. It is not proof of
real Storage upload/read/RLS or OS-saved browser files.

Recheck committed bytes/text/geometry without conversion, writes or network:

```sh
/path/to/isolated/python web/scripts/verify-canonical-qa.py
```

Verified isolated runtime: Python3.12.13, python-docx1.2.0, PyMuPDF1.28.2.
Exact source input is excluded from automatic formatting to preserve its hash.
For a future fresh render, run the existing renderer against a copied synthetic
input and write into a new QA directory; then use a separately validated local
DOCX converter. Never overwrite this attestation with uninspected bytes.

Runtime limitation: the official LibreOffice26.8.0 AppleSilicon DMG matched its
vendor SHA256 (`8858d8058da4f862f47559486814e65efc27294da67c5e4bb56b006b1ee59f89`),
but the copied app failed strict bundle signature validation. One isolated
headless conversion ran before that outcome was noticed. No Gatekeeper bypass,
signature stripping/re-signing, quarantine removal, global install or user
LibreOffice profile was used. The image was detached. No further execution of
that copy is authorized by this QA evidence; validated converter-runtime
acceptance remains pending. [Vendor checksum source](https://download.documentfoundation.org/libreoffice/stable/26.8.0/mac/aarch64/LibreOffice_26.8.0_MacOS_aarch64.dmg.mirrorlist).

The current toolset has no callable browser controller. Earlier browser download
capture timed out and its file-picker check was interrupted. No Playwright/shell
UI workaround was used. Actual browser PDF/DOCX save and intake file selection
remain explicit acceptance gaps; synthetic DOM/SDK tests do not replace them.
