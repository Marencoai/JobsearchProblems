# Exact approved Phase 2 migration · October 2, 2026

The migration approved at `3b047da5cb6017c8275761491e636456b0ed8b6f`
was applied only to JobsearchProblems `xhhfnxswwspejdxjyvzz` at
**2026-10-02 01:56:36 UTC**, with managed migration version
`20261002015636_hq_existing_human_actions`. Local filename remains
`20261001205019_hq_existing_human_actions.sql`; its approved Git blob
`0ef9a55b7158d19a99cdf426a628b234191ee318` is unchanged. No resets, automatic
pushes, other migrations, buckets or job-search record changes were performed.

The user verified both live ChatGPT scheduled tasks, then committed their exact
current prompts in `4f2341e9d09bef4ccc8d4abb1e31b67c91ebe35c`, blob
`f69d32c9316976a550266c94b29623d6394b4e7a`. Mechanical comparison confirms each
approved insertion occurs once and removing it plus its separator recovers the
original prompt byte for byte. Both exact task IDs and original schedules
match; the snapshot reports enabled=true. This is user-supplied live adoption
evidence, not an independent automation API readback or proof of execution.
No denied task edit was retried and no replacement task was created.

## Passed hosted checks

- Fresh preflight: ACTIVE_HEALTHY, PostgreSQL 17.6, expected 26-migration
  baseline, RPC/column absent. All 51 previously captured lifecycle trigger
  fingerprints, 27 policies and 30 selected column definitions match. The new
  query additionally includes five existing application-gap triggers.
- Apply reports success. After inventory has exactly one additional migration,
  the nullable timestamptz `next_actions.available_after` column with no default,
  and the expected RPC signature. Its source-body MD5 matches the reviewed SQL
  (`2e65e1fe723165e6c56571c867e5c8ef`).
- RPC is SECURITY INVOKER with empty search path. PUBLIC/anon execute are denied
  and authenticated execute granted. Existing table RLS/anonymous grants,
  lifecycle guards, helper attributes, policy fingerprints and the required
  permission-key set are unchanged. All 56 scoped triggers are enabled.
- A read-only call under role `authenticated`, without a signed-in human's Auth
  claims, raises `42501: An active workspace human is required` before writes.
  This proves the no-human guard on hosted PostgreSQL, not authenticated
  Supabase Auth/PostgREST human or agent acceptance.
- Security advisors show only the previously recorded disabled leaked-password
  protection warning; no migration-related new warning. That unrelated setting
  was not changed. [Advisor remediation reference](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Read-only aggregate case availability: zero existing future/due deferrals and
  zero requested-revision tasks in the authorized workspace. No fixtures or
  candidate decisions were created to manufacture a test case.

## Activation remains on hold

`HQ_HUMAN_ACTIONS` was not enabled or reconfigured. Parent controls rollout;
this worker did not independently read back a hosted HQ runtime configuration.
It is **not yet safe to enable** based on these checks alone.

Actual human/agent acceptance through existing authenticated Supabase
Auth/PostgREST sessions remains pending. Do not impersonate a principal using
forged JWT claims or read/expose credentials to substitute for that evidence.
Actual scheduled Morning Planner deferral/delivery and Application Queue exact
revision routing remain pending against normally occurring authorized data or
separately identified non-production fixtures. Do not run scheduled tasks or
perform real Pursue, Defer, revision, approval or submission actions solely for
QA without that fixture authorization. Local Node reference tests are separate
evidence and are not a hosted worker installation prerequisite.

The [database boundary audit](AUTOMATION_DB_BOUNDARY_AUDIT.md) still applies:
RLS/lifecycle/RPC guards enforce human authority, scope, idempotency, versions
and immutable history. Planner ranking/delivery deferral filtering and selection
of an exact working revision package remain consumer contracts; the approved
SQL does not independently enforce those selection rules. Strict database
rejection would need the separately reviewed consolidated forward proposal.
Do not expand the approved SQL to claim those gaps are closed.

Evidence: [worker comparison](qa-evidence/phase2-worker-adoption-audit.json),
[immediate before catalog](qa-evidence/phase2-live-before-approved-apply.json),
[after-apply checks](qa-evidence/phase2-live-after-approved-apply.json),
[verified user snapshot](../docs/live-worker-instructions-verified-2026-10-01.md).
Earlier preflight documents remain historical and are superseded by this report.
