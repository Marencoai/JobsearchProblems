# Proposed HQ intake and exact material delivery

Status: local only; migration and Storage changes are unapproved/unapplied. Existing Company → Opportunity → Evaluation → Package → Material architecture and worker permissions remain authoritative.

## Manual evidence

Security-invoker `hq_request_job_intake(workspace, request, input)` checks active Workspace/human membership and existing Activity/Internal Task read/create permissions. Actor-scoped request keys serialize retries through advisory transaction locks. Identical evidence returns the same event/task; changed evidence under that key fails. One append-only `manual_job_intake_requested` Activity Event carries contract version 1, explicitly unverified user-provided evidence. One existing discovery `job_alert_intake` task references it. The RPC does not create or evaluate Opportunities.

Inputs: public HTTPS URL, pasted description, or maximum 8 MB PDF/DOCX/PNG/JPEG/UTF-8 text upload. Paths bind Workspace, human, request and SHA-256. UI validates size/signature/hash, uploads only on explicit Add for review with no upsert, and preserves the exact key/payload/upload on uncertain retries. The existing worker independently verifies bytes, safely extracts, researches, deduplicates and queues evaluation. Evidence without a public posting remains user-provided; missing facts remain unknown. Pure helpers are optional checks, not an installed hosted runtime.

## Artifact child table

`application_material_artifacts` references an exact existing Material through a composite Workspace/Material foreign key with delete restriction. At most one DOCX and PDF registration per Material; each has immutable private path, byte size/hash, renderer, serialized-input hash, source DOCX hash, bound QA attestation, actor and time. SELECT uses existing `application.read`; INSERT uses `application.prepare`; no authenticated UPDATE/DELETE. Existing content/version/lifecycle rules are unchanged.

An insert trigger locks the current draft Material, checks uploaded object size/MIME, canonical two-page resume renderer and consistent sibling provenance/QA. Registration does not prove semantic QA: the existing preparation worker must truthfully convert, visually inspect and parse before attesting. Files cannot be replaced after candidate review. Submission still snapshots exact Material IDs; their artifact registrations/hashed bytes persist.

## Private Storage and rollout

`hq-intake` is private with an 8 MB limit and supported source types. `hq-materials` is private with a 16 MB PDF/DOCX limit. Caller-invoker SELECT/INSERT helpers use existing table RLS. Intake upload is active-human-only; discovery workers read referenced event evidence with existing Workspace Activity read authority. Preparation writes/reads current draft Material paths; candidate application readers read registered artifacts. No business permission/role is added. UI/workers must not bypass these controls with service credentials.

Restrictive object guards constrain preexisting broad permissive policies for these buckets, including authenticated/anonymous overwrite/delete denial. Other buckets are unchanged. Before deployment, inventory actual bucket/policy state and test the real non-production Storage API. SQL catalog mocks do not certify the object API.

`HQ_MANUAL_INTAKE` and `HQ_MATERIAL_DELIVERY` default off independently of `HQ_HUMAN_ACTIONS`. Client admits only exact new RPC/upload or registration-read/download requests with that capability. Auth remains in memory; Workspace/human context is refreshed before operations. UI shows plain next steps without raw task output. Pinned PDF.js renders verified in-memory bytes with its locally copied worker; no public URLs or persistent signed links. See `web/INTAKE_DELIVERY_REVIEW.md` for gates, rollback, validation and full v1 checkpoint.
