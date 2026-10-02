# Approved schema rollout · October 2, 2026

All five exact files in the four user-approved scopes were applied sequentially to JobsearchProblems. Approval source: [frozen packet at 7f936252d1da3bf94a59d027811d5172bbe74197](https://github.com/Marencoai/JobsearchProblems/blob/7f936252d1da3bf94a59d027811d5172bbe74197/web/V1_APPROVAL_PACKET.md). No schema adaptation, bulk push, unrelated migration, fixture, membership/access change, external action, merge or deployment occurred.

| Approved file | Managed version | Result |
| --- | --- | --- |
| Phase2 hardening | `20261002053225` | Verified |
| Outreach | `20261002053743` | Verified |
| Interview core | `20261002054123` | Verified |
| Interview Contacts | `20261002054310` | Verified |
| Offer | `20261002054451` | Verified |

Each file had fresh migration/catalog inventory and pinned SHA verification. Hardening preflight confirmed one active canonical human Owner per active workspace and zero pending preparation tasks requiring legacy classification. Existing unbound Packages and completed legacy work were retained. The completed legacy task with a preparing Package was not resumed or recreated; resumption requires reviewed handoff.

All 23 approved function bodies match exact source fingerprints. Existing grants/policies, roles/memberships, historical guards and workflow counts are unchanged except the expressly approved Outreach activity-link routing condition. That routing recreates the unchanged historical validator with four new entity kinds handled by a separate scoped validator; the initial comparison flag was resolved against the pinned SQL without altering it. All 22 new tables (21 public, one private) have RLS, deny anonymous access and contain zero rows. New business grants are only the approved nine Outreach, two Interview and three Offer Owner capabilities.

A read-only transaction under database role authenticated, without Auth claims, proved all seven public entrypoints reject before writes with SQLSTATE 42501. An initial probe used the wrong Outreach arity; it made no writes and the complete corrected probe passed. This is a backend guard check, **not** normal signed-in human/agent Auth/PostgREST acceptance.

## Prompt adoption and activation gates

Both complete hardened prompts exactly match [the user-supplied live readback](https://github.com/Marencoai/JobsearchProblems/blob/f4c5091391fcd5ade75f0c937676188793e6a82a/docs/rollout/live-phase2-hardening-prompts-verified-2026-10-01.md), blob d226149cfee5e719587e2328c657cf0160f762cb. IDs, enabled states and original schedules are recorded. No denied task-edit path was retried or bypassed. This resolves instruction-text adoption, not actual execution.

No flags were changed or enabled. Keep HQ_HUMAN_ACTIONS, HQ_OUTREACH, HQ_INTERVIEW and HQ_OFFER disabled until their respective complete hosted validation reports pass. Existing normal owning-app human/agent sessions, actual scheduled deferral/exact revision routing, domain consumer adoption and controlled final delivered-message behavior remain unverified. If synthetic acceptance cases are necessary, workspace purpose/access and the bounded run require separate approval; no fixtures or test-agent access were created here. Intake, Research and Storage/material delivery are untouched.

## Advisors and evidence

No new security WARN/ERROR occurred. The private Outreach ledger's RLS/no-policy INFO is an intentional normal-caller deny boundary; the earlier leaked-password warning remains unchanged. Performance INFO reports two uncovered Interview foreign keys (interviews→process and questions→preparation), and unused-index INFO grows for empty new tables. No unapproved index was added. [Advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

[Compact machine-readable audit](approved-schema-rollout-2026-10-02.json) records exact paths/hashes, versions, source/prompt matches and boundary/count checks. Full per-file before/after inventories and advisors are now preserved in [the evidence directory](evidence/2026-10-02/) after execution environment reconnection; the original local copies remain intact. See the subsequent [read-only Morning Planner diagnosis](morning-planner-readonly-diagnosis-2026-10-02.md) for the failed live run; it does not constitute activation acceptance. This documentation-only audit branch preserves the completed compact report without changing approved PR7. Parent coordinates remaining acceptance and activation.
