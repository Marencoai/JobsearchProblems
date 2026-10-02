# Proposed HQ research-refresh handoff

Repository proposal only. No actual hosted research task or caller is certified
by this file. This is a small handoff to the existing Owner/research workflow,
not a new research engine, schedule, role, permission, or evaluator.

## Authority and input

After separate SQL/worker adoption approval, the Owner may claim an existing
`refresh_company_intelligence` Internal Task under its current execution policy.
Validate `domain=company_intelligence`, `trigger_type=candidate_action`, and
`trigger_reference=candidate_requested_research_refresh`. Resolve its exact
`source_activity_event_id` and active Workspace/Opportunity. The attributed
source is `research_refresh_requested`; the description contains version1,
exact Workspace/Opportunity/Company/event IDs,
`preserve_completed_evaluations=true`, `authorizes_preparation=false`.
Reject foreign/closed/inactive/stale-company targets and malformed inputs.

Where the repository and Node22+ runtime are actually available, this optional
read-only helper checks the binding. Never put credentials in its input:

```sh
node --experimental-strip-types worker-support/cli.mts research-refresh < research-request.json
```

Input contains `task`, `event`, and current `opportunity`. Without that runtime,
apply the same checks self-contained. Do not assume a hosted worker can run CLI.

## Existing workflow

1. Read the existing applicable research policy and verify the actual caller's
   permitted Company Intelligence/Opportunity writes before dispatch. If that
   authority or existing consumer cannot be identified, mark the task blocked
   through the authorized Owner and surface a plain reason. Do not impersonate,
   broaden a role, grant permissions, or use service credentials to bypass RLS.
2. Reuse the existing Company Intelligence research routine: verify the current
   public employer/listing, research time-sensitive context and retain source,
   confidence, publication/research/expiry timestamps and unknowns. User-provided
   descriptions remain labeled user-provided unless independently verified.
3. Append new time-stamped intelligence under existing permissions; preserve old
   records and all completed Evaluation input/evidence/intelligence snapshots.
   Any material reevaluation follows the existing authorized Evaluation queue
   and versioning rules. Refresh does not change candidate pursuit, approval or
   submission and never creates an Application Package or external action.
4. Retry on the same task, read existing result provenance before writing, and
   avoid duplicate intelligence after uncertain outcomes. A blocked/pending task
   is reused by the human RPC. The Owner records outcome/completion only after
   verified work; UI continues to display recorded facts while refresh runs.

Actual worker identity/policy/runtime review, minimal additive prompt adoption
and independent readback are rollout gates. Preserve existing task instructions;
this repository contract alone does not demonstrate live adoption.
