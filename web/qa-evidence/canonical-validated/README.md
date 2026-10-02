# Validated converter · synthetic version 2

The untouched official LibreOffice 26.2.6 aarch64 image matched its vendor
SHA-256, passed `codesign --verify --deep --strict`, and was accepted by Gatekeeper
as `Notarized Developer ID` before execution. Conversion used the read-only
mounted bundle, headless mode and a task-owned isolated profile. No signature,
quarantine or system protection was changed. The rejected 26.8 bundle was not run.

The renderer input and original DOCX bytes are exact copies of the original
`canonical` evidence. The newly converted PDF has SHA-256
`264825a0f82d316582140694349754f240305cf22c99c97cbe69fa7acd1fe87b`.
All original evidence remains unchanged. A separate synthetic Material ID and
version 2 bind this newly inspected pair; neither manifest was registered in
production. The provenance filenames retain `resume-v1`; the SDK computes the
version 2 download filename from the selected Material.

Both US Letter pages were visually inspected: clear positioning on page one,
experience on page two, with no clipped or overlapping content. The read-only
verifier confirms every supplied fact and text bounds. Actual file bytes pass
the SDK pair/hash/version checks through mocked HTTP. Hosted conversion,
Storage delivery and actual browser-saved downloads remain separate checks.

Primary references: [official release notes](https://www.libreoffice.org/release-notes/),
[documented headless parameters](https://help.libreoffice.org/latest/en-US/text/shared/guide/start_parameters.html).
