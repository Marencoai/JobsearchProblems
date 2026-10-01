# Outreach proposal · local validation · October 1, 2026

This report validates the proposed Outreach package, not a production rollout or completed Outreach UI. Branch `codex/job-hunt-hq-outreach` is isolated from the Phase 1 preview and Phase 2 rollout. Base snapshot: `a18ff51`. The shared Contacts contract was published early at `f76a275` and remains unchanged (`full_name`, nullable `title`, UUID keys and `UNIQUE(workspace_id,id)`).

## Exact reviewed files

- Forward proposal: `supabase/proposals/outreach/20261001230000_outreach_domain.sql`
- SHA-256: `b6162b864581cdfac8b043b79ff8038cd8ae7e8d169712195dc679f10c65c906`
- Forward write-disable: `supabase/proposals/outreach/disable_outreach_writes.sql`
- SHA-256: `534c5e3e233f2dfa208fe5c71114f9cf56eb8ecbc147bb08032e9e3ffffaf910`

Both files are outside the automatic migration inventory. Production approval/application is not implied by their presence or by local test success.

## Automated acceptance evidence

| Check                            | Verified result                                                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entire repository frontend suite | **188 tests pass in 9 files**, including 57 Outreach SQL cases and 17 Outreach worker/CLI cases; all 114 existing Phase 1/2 tests pass                         |
| SQL execution                    | Existing real migrations/policies/triggers plus the proposal run in isolated PGlite PostgreSQL 17.5                                                            |
| Worker integration               | Actual queued SQL task/link/engagement/message rows pass through pure routing helpers; exact documented CLI preparation/wait modes run as real child processes |
| Native SQL/concurrency           | PostgreSQL **17.6**, 25 unchanged non-identity migrations plus exact proposal, including pgcrypto                                                              |
| Concurrent identical draft       | Session B observed waiting on Lock; identical result with one exact message/review task/action                                                                 |
| Concurrent competing revisions   | Session B observed waiting on Lock; stale loser rejected, one current version and preserved previous version                                                   |
| Concurrent identical mark-sent   | Session B observed waiting on Lock; one sent record, one wait task and one attributed Activity                                                                 |
| Mark-sent versus edit            | Session B observed waiting on Lock; exact sent version commits, competing edit rejected without history drift                                                  |
| Concurrent incoming records      | Session B observed waiting on Lock; one exact inbound record and contextual review                                                                             |
| Native tenant checks             | Foreign Workspace sees zero Contact rows and cannot call the writer against another tenant                                                                     |
| Local security catalog           | All 9 new tables have RLS; no anonymous SELECT or authenticated raw DML; exposed RPC is SECURITY INVOKER; private definer functions have fixed search paths    |
| Local performance catalog        | Every new FK has a usable nonpartial index                                                                                                                     |
| Native disable/rollback          | Both public and private write entry points lose authenticated execute; all exact message history remains                                                       |
| Source quality                   | TypeScript, ESLint, Prettier (including worker support), `git diff --check` pass                                                                               |
| Existing frontend regression     | Optimized Next.js production build passes; no Outreach UI/transport is enabled or changed                                                                      |

SQL coverage includes reusable/multi-role and general relationships, manual/recommended alternatives and primary selection, immutable exact body/subject/version/recipient/role snapshots, optional approval without sending, direct human attestation without a second approval gate, historical sent times, explicit no-follow-up, record-specific wait resolution, exact incoming replies and deterministic external-reference deduplication, warming interactions, confirmed professional notes, evidence provenance/FK rollback, stale revisions, idempotency conflicts, raw DML denial, Owner/read-only/agent/anonymous/inactive/foreign-tenant boundaries, safe contact URLs, unknown Activity types, authoritative wait timestamps, task ownership and preservation after role closure.

The native script creates an owned synthetic cluster under `/tmp`, restricts its directory to the current user, starts only a private Unix socket with `listen_addresses=''`, ignores inherited DB credentials, and stops/removes that cluster in `finally`. It cannot target a production connection string. All fixture names/addresses are synthetic (`.invalid`). The existing Phase 1 checkout and its temporary browser smoke files remain untouched.

Test binaries: pinned Node 22.23.3 and test-only registry package `@embedded-postgres/darwin-arm64@17.6.0-beta.15`; no global server/service/security setting was installed or changed. The PGlite harness omits only its unavailable pgcrypto extension declaration (UUID generation exists in core) and skips the two historical migrations tied to real production agent identities. Native PostgreSQL replays the other SQL unchanged with pgcrypto. Auth is represented by a synthetic UUID-claim interface; no real password/token is used.

## Practical limits and remaining gates

The privacy regression verifies that a generic Activity-only reader sees summaries/structured IDs while exact communications remain protected by Outreach read permissions. Retry bodies are in an append-only, RLS-enabled private ledger with no normal caller grants; they are absent from generic Activity details. Native catalog checks include this ledger's RLS/access boundary and FK indexes.

No production migration, permission change, data backfill, contact import, real message, Auth update, workflow deployment or main-branch merge occurred. Hosted advisors cannot inspect unapplied objects; they remain a post-approval deployment check. Docker is unavailable, so the full local Supabase container stack was not run.

This package has no new Outreach form wired into the live UI. Browser-control tools are unavailable in this attached environment, and no new browser/visual acceptance is claimed. The reviewed UI contract and existing seven-stage derivation are documented in the [single review package](outreach-v1-review.md). Normal hosted Auth/PostgREST acceptance, narrow worker role provisioning and live adoption, gated UI integration, browser/responsive/visual QA, and full v1 end-to-end acceptance remain follow-on work after the production/schema gate is coordinated.

Production requires one explicit domain approval covering the exact forward SQL/hash, nine proposed new Owner capabilities, table policies and controlled-writer/Activity-link extension. Interview depends on this canonical Contacts table and must be ordered after it. The parent coordinates the combined approval request; this local validation does not itself grant permission to apply anything.
