# Job Hunt HQ · Phase 1

**Outreach local review:** [the consolidated domain package](../docs/03-design/outreach-v1-review.md) includes proposed SQL/RLS/permissions/tests/rollback and the gated interface. `HQ_OUTREACH` remains off until its production migration and rollout are explicitly approved. Ordinary reads and Phase 2 remain independent. Do not enable this flag against a pre-migration database.

For isolated development review, run `HQ_QA_FIXTURES=1 HQ_OUTREACH=0 npm run dev -- --port 3104` and open `http://127.0.0.1:3104/qa?outreach=1`. This needs no public config, credentials, database or worker. Contact/draft/attestation state exists only in the synthetic browser session. The full production build still rejects `/qa`. The browser script restricts all requests to this loopback origin and launches its own fresh headless profile:

```sh
# After installing the pinned dev dependencies; supported test browser:
npx --no-install playwright install chromium --only-shell
node scripts/outreach-browser-check.mjs
# Or use an existing Chrome executable as the sole argument.
```

Screenshots and exact test/browser evidence are in [`qa-evidence/outreach/`](qa-evidence/outreach/) and [the dated validation report](../docs/03-design/outreach-validation-2026-10-01.md). The browser is test-only; no global browser preference, user profile, credential or live communication is touched.
Manual intake and exact private PDF/DOCX delivery are locally proposed on a separate stacked branch. See [INTAKE_DELIVERY_REVIEW.md](INTAKE_DELIVERY_REVIEW.md) for SQL, worker adoption, Storage validation, rollback and remaining v1 gates. `HQ_MANUAL_INTAKE` and `HQ_MATERIAL_DELIVERY` default off and require separate approved rollout/activation. For development-only synthetic transport QA use `/qa?job=resume&intake=1&delivery=1` and Load synthetic file fixtures. No database/Storage request or canonical candidate rendering occurs there.

Phase 2 human actions are now proposed on the stacked branch; see [PHASE2_REVIEW.md](PHASE2_REVIEW.md). The default runtime remains read-only. Only after authenticated Phase 1 acceptance and explicit migration approval should the server environment set `HQ_HUMAN_ACTIONS=1`. That enables just the `hq_human_action` RPC and reads the new deferral column; it never permits direct table writes or other RPCs. Do not enable the flag against the pre-migration database.

**Acceptance update · October 1, 2026:** Diana explicitly accepted Phase 1 after signing in and reviewing multiple real opportunities. [PHASE1_QA.md](PHASE1_QA.md) records that approval; the [requirements document](../docs/02-requirements/requirements.md#job-hunt-hq-deferred-product-improvements) tracks her two deferred, non-blocking improvements. The next gate is explicit Phase 2 production migration approval, which Diana has withheld. The migration and human-action flag remain inactive.

**Subsequent rollout update · October 1, 2026:** Diana approved the exact Phase 2 migration reviewed at `3b047da`. Live preflight matches the reviewed database assumptions, but actual hosted worker installation/version-verification targets are not yet discoverable. Per her safeguards, no apply was attempted. The migration remains unapplied and human-action activation remains unauthorized. See the updated [review](PHASE2_REVIEW.md#approved-rollout-preflight--october-1-2026) and its exact preflight inventory.

Read-only Next.js candidate workspace over the existing Supabase Auth/principal/workspace/RLS model. The existing worker workflows, schema, migrations, permissions, renderer, and job data are unchanged.

## Run locally

Use the pinned Node version in `.nvmrc` (22.23.3), then:

```sh
cd web
npm ci --ignore-scripts
npm run dev
```

Supply `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` through the local process environment or an ignored `.env.local` based on `.env.example`. Use only the existing project's modern `sb_publishable_…` public key. Never supply an admin/service-role key. The current Mac preview supplies public configuration only in process memory; no configuration or credential file is created.

Open `http://127.0.0.1:3000/jobs`, then sign in through the browser form. Sessions and passwords are not persisted, logged, sent to Next.js, or placed in URLs. Supabase Auth receives the normal password sign-in directly. Browser memory retains the authenticated session across in-app navigation; full page reload, sign-out, or expiry requires sign-in again. No background refresh or account-management flow is enabled in this preview.

## Data boundaries

- Auth `getUser` resolves exactly one active human principal, active memberships, accessible workspaces, and roles. Access is rechecked before reading a workspace. Switching clears old workspace data immediately; request generations prevent a late response overwriting the selected workspace.
- Every workspace read has an explicit `workspace_id` filter and still passes through the authenticated user's existing RLS. Next Actions are limited to the current principal or unassigned actions. Task reads expose routing/status fields, and activity reads expose summaries rather than machine logs.
- The fetch boundary allows password sign-in, verified Auth reads, local sign-out, and GET requests to a curated table allowlist. It rejects database writes, RPCs, admin routes, token refresh, foreign origins, cookie credentials, and redirects before network access. No privileged connector is used by the app or its tests.
- Lists paginate in stable ID order. A read error fails the whole workspace; no partial, fixture, or cached data substitutes for it. Workspaces over 10,000 rows in a queried table fail explicitly pending a focused query design.
- All seven stages are derived UI views. Backend opportunity stages remain unchanged. Each active opportunity appears once; closed/inactive records have a separate inspectable history. A score never authorizes pursuit, and submission never invents outreach work.
- Evaluate uses the latest completed evaluation, its evidence/gaps/research snapshots, and separate candidate/opportunity fit scores. Missing scores show an em dash. Company/listing facts and freshness show only recorded values.
- Recorded packages, material versions, application attempts, and exact submission snapshots are inspectable. Text content remains escaped; artifact links appear only when a safe URL is recorded. No missing PDF is invented.

Mutation controls are intentionally disabled in Phase 1. `Reload data` only rereads existing data. Research refresh and preparation must queue the existing workers in the next phase; browser code must not reproduce their logic. Outreach, Interview, and Offer currently show existing lifecycle/activity only, with explicit empty states for their pending structured domains.

## Checks and QA

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Tests cover stage precedence, history, score/authorization separation, version selection, linked activity, pagination, fail-closed identity resolution, workspace filters, SDK integration with a mocked network, transport write rejection, and UI search/tabs/material previews/disabled actions. Tests never create production fixtures. These tests validate client boundaries; authenticated live browser QA is required to establish production RLS behavior.

For synthetic visual QA only, launch development with `HQ_QA_FIXTURES=1` and open `/qa`. The page is clearly labelled a synthetic workspace and uses the same UI components. `/jobs` continues to require real authentication. `/qa` always returns 404 in a production build, regardless of that flag. Fixtures are never a data-loading fallback.

Add `&actions=1` to a synthetic QA job URL to preview action dialogs, such as `/qa?job=resume&actions=1`. The synthetic callback only displays a confirmation; it never connects to a database, executes a worker, or changes production. SQL transaction tests use an in-memory PostgreSQL 17 PGlite harness, replay actual foundational migrations with a synthetic Auth shim, and execute as `authenticated`. The two migrations provisioning production agent identities are excluded. No test connection string or persistent test database is used.

Worker deferral/revision helpers and their CLI live in `worker-support/`; the existing planner/preparation skills call them before ranking/delivery or selecting a preparation Package. Ordinary tests execute the CLI and exercise real revision transitions as a synthetic prepare-only agent. Native concurrency is separately reproducible with `node scripts/concurrency-check.mjs /absolute/postgres/bin /absolute/psql`: the script owns a disposable synthetic cluster on a private Unix socket, disables TCP, replays migrations, observes overlapping lock waits, and removes the cluster after stopping it. See the review for results and remaining hosted acceptance limits.

## Approval gates

Complete live authenticated Phase 1 acceptance before introducing production changes. Future human actions must preserve immutable versions, submission snapshots, worker ownership, and human authorization. Each new structured domain must have one review package containing its proposed migration, RLS/permission impact, tests, data/backfill impact, and rollback strategy; obtain one domain approval before applying its production migration. No deployment, external application, outreach message, or offer action is performed by this phase.
