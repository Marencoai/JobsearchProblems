# Phase 1 verification · 2026-10-01

Baseline: `Marencoai/JobsearchProblems` main `6d50193b070f4e1fa879b7781b39c939b0a5f1a7`. Implementation branch: `codex/job-hunt-hq-phase1`.

**Current acceptance status:** Accepted by Diana on October 1, 2026. See the dated acceptance record below; the initial pending checkpoint is retained as implementation history.

## Verified locally

| Check                                       | Result                                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Pinned install, dependency scripts disabled | Pass                                                                                     |
| Node runtime                                | Task-local official Node 22.23.3; archive SHA-256 checked against official SHASUMS       |
| Formatting, ESLint, TypeScript              | Pass                                                                                     |
| Unit/UI/SDK integration tests               | 72 pass; mocked network only                                                             |
| Production Next.js build                    | Pass                                                                                     |
| Browser desktop layout                      | Inspected at 1280×720 and 1536×1024 against supplied mockup                              |
| Browser phone layout                        | Inspected at 390×844; document width equals viewport width                               |
| Browser stage navigation                    | All seven views inspectable without changing the focused job                             |
| Browser evaluation tabs                     | Supporting evidence and gaps verified with synthetic records                             |
| Browser material dialog                     | Version/status/content/close verified with synthetic records                             |
| Mobile navigation                           | Drawer exposes navigation; closed drawer and background content are inert as appropriate |
| Production fixture isolation                | `/qa` returns 404 on the production build even with `HQ_QA_FIXTURES=1`                   |
| Database/workflow regression scope          | Existing migrations, worker skills, renderer, permissions, and job data unchanged        |

Browser fixtures are explicitly labelled synthetic and are available only through a development-only route. They never replace missing real workspace data. The mocked SDK tests exercise the real Supabase client through the application's transport guard, including pagination, explicit workspace filters, human principal resolution, and rejected writes/RPCs/admin routes.

## Historical checkpoint · authenticated acceptance initially pending

The live-data preview is running on private loopback at `http://127.0.0.1:3000/jobs`. Its public configuration is provided only to the process; no credential/configuration file has been written. The sign-in form is verified ready. The user's earlier authenticated smoke test remains separate at port 4173 and its files are retained.

At this implementation checkpoint, the frontend's real-data acceptance was **pending the user's sign-in in the new preview**. The prior smoke test and synthetic visual QA were not treated as proof that every new frontend query works against production RLS. The remaining acceptance step was normal sign-in and review of real data before introducing production schema changes.

No production fixture, schema migration, workflow request, application submission, or external message was issued during Phase 1 implementation.

## Authenticated acceptance · October 1, 2026

Diana explicitly approved Phase 1 real-data acceptance. She confirmed signing in as Diana and reviewing multiple real opportunities. She reported that the core Job Hunt HQ experience, stage organization, evaluation scores, tabs, navigation, and real Supabase data work as intended. This acceptance is based on her direct authenticated review and explicit approval.

She recorded two later product improvements as non-blocking: make the plain-English translation identify the underlying business problem behind the hire, and populate/surface recent company signals in Opportunity Intelligence when the research workflow is available. They are tracked in [`docs/02-requirements/requirements.md`](../docs/02-requirements/requirements.md#job-hunt-hq-deferred-product-improvements). No improvement implementation was started as part of this acceptance record.

**Next gate:** Explicit approval of the reviewed Phase 2 production migration. Diana expressly instructed that it must not be applied yet. Phase 1 acceptance does not authorize that migration or activation of `HQ_HUMAN_ACTIONS`. Production migration approval remains withheld.
