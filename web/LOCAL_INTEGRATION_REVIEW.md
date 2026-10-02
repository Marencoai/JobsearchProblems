# Local v1 integration review · 2026-10-02

This isolated candidate combines PRs 2–6. It is local-only on `codex/local-v1-integration`; no main merge, deployment, hosted schema/data/permission mutation, live worker edit, real submission, message send, meeting invitation or offer commitment occurred. Production capabilities remain independently off by default.

## Published source pins

| Package                   | Reviewed published head                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| PR2 Phase2                | `a254eaed87e8b99da1608bcda236e6a03515f98e`                                                                                    |
| PR3 Outreach final freeze | `0a31190b99ed52d332c61d97f8b9f21af3fb9f7c`                                                                                    |
| PR4 Intake/delivery       | `802fbfe8a151a6859f3754ef5f7ad0f0db67dafa`                                                                                    |
| PR5 Interview             | `bf9fb8238613a1d8405f7570cde8a7b338e62aee` (final dependency pin update; original `a116c37df8d87b50d61e32db25209616aae63ee4`) |
| PR6 Offer                 | `c11a6f5069c621c30c4488a82a5eb78336475dfe` (final dependency pin update; original `18cf31dab1f83c59726e5623031e9b5e66532387`) |

Outreach advanced during integration from `255ecfb` to its published frozen head above; this candidate includes the final head. PR4 was reread remotely and had not advanced. Owner branches/worktrees and standalone review packages are preserved. Standalone PR5/6 reports/tests now pin the frozen Outreach dependency. Their independent suites pass (Interview147, Interview+Offer168), and both native mixed lock orders pass again from each updated standalone package.

## Exact SQL and rollout order

| Proposed file                                                               | SHA-256                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Outreach `20261001230000_outreach_domain.sql`                               | `9a8dffce9152ffa51220c5da6787d1c87f4444b11d4b21b3b697f6c04c194e6b` |
| Interview `001_interview.sql`                                               | `1c1d6aef2c244793d844db34e9c861aafe56d01475d3ab2f70d0deed53255f11` |
| Interview `002_interview_contacts.sql`                                      | `54db40039beb65379fd9493b839a9812987036bbcf809a25694e8b2c5863780f` |
| Offer `001_offer.sql`                                                       | `f8b04664ef59d365c9a8a2703b1eedf413a559727a967a68fb26b10442d37851` |
| Intake/delivery `20261001225212_hq_manual_intake_and_material_delivery.sql` | `ad96b4e0bdbba0a8da1c12522f733e86f6f785cfe0caa60ce68c0b02545084a6` |

No application SQL was changed by integration beyond importing owners' exact published commits. Approved Phase2 migration remains Git blob `0ef9a55b7158d19a99cdf426a628b234191ee318`. Interview contacts must follow canonical Outreach Contacts. Core Interview and Offer can be reviewed independently; each domain requires its own explicit production approval covering schema/RLS/permissions and rollout. Intake/delivery is separately proposed by PR4. All backfill/rollback/permission plans remain in the respective domain review documents. Forward-disable writes and preserve exact history; do not drop committed human evidence. Approval of this local integration is not permission to apply SQL.

## Integration changes

Shared Session, role workspace, QA fixtures, capability route and SDK transport now carry Phase2, Outreach, Interview, Offer, Intake and Delivery together. SDK fetch takes a named capabilities object instead of conflicting positional booleans. Interview may read canonical Contacts for interviewers even when Outreach writing is disabled; all write RPC capabilities remain independent. No private request ledger is readable by the frontend, no raw domain writes are allowed, and no admin key is introduced. Outreach refresh retains loaded exact artifact records; synthetic job navigation retains all enabled fixture flags.

Native harnesses now provide the same test-only Supabase Storage catalog interface as PR4's harness. Auth remains synthetic UUID claims. Real migrations/policies/triggers execute in owned disposable PostgreSQL 17.6 clusters with private Unix sockets, no TCP listeners or inherited DB credentials; historical real-agent identity provisioning is skipped. PGlite adapts only its unavailable pgcrypto extension declaration. None of these shims changes production schema.

## Verification

- Combined 21 test files / 335 tests pass with the final pinned Outreach dependency, including Interview Contacts, tenant/agent boundaries, immutable histories and independent transport gates.
- Node24.15.0: typecheck, lint, formatting and Next16.3.8 optimized build pass.
- Native Interview: four request/source/preparation/review races plus actor-scoped private ledger boundary pass.
- Native Offer: five receipt/terms/Accept-vs-Decline/retry races plus actor-scoped ledger boundary pass.
- Final Outreach native suite: five Outreach races, historical exact Phase2 Pursue deadlock reproduction, four corrected Pursue/save_positioning overlap orders, tenant denial, RLS/grant/catalog checks and forward-disable rollback pass.
- Mixed Interview/Outreach and Offer/Outreach: both lock orders pass against final frozen SQL, both exact writes commit once. Workspace and Opportunity use compatible NO KEY UPDATE locks; existing Phase2 SQL is unchanged.
- Native Phase2/intake suite: two intake retry races and five human Pursue/Pass/revision/approval/submission races pass. Separate local regression verifies exact unchanged Pursue alongside the compatible frozen Outreach lock.
- Installed headless Chrome154.0.8037.93 in fresh owned profiles: Outreach behavioral suite passes at five responsive widths; zero external requests/page errors. Interview download is real: 638 UTF8 bytes, exact content match, SHA256 `25c124209932013033de8b6a5f97f32fb20bc648d83df2810988cec1cc33963a`.

Browser integration evidence is in `qa-evidence/integration/`; script `scripts/integration-browser-check.mjs` exercises seven roles at desktop/mobile, synthetic PDF.js rendering, PDF/DOCX downloads and URL/text/file-picker intake. Synthetic transport files are not canonical Word/renderer or hosted Storage acceptance. The DOCX fixture is a 63-byte transport sentinel rather than a complete Word document. Installed Chrome full-page capture leaves a blank PDF canvas tile in one dialog image; the separately captured `synthetic-pdf-canvas.png` displays actual rendered text, and the browser asserts dark text pixels plus exact extracted text. Canonical visual renderer acceptance remains pending.

## Master brief §26: 18-item checkpoint

| Item                                  | Local evidence                                                                   | Remaining gate                                                              |
| ------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1 Sign in as Diana                    | Prior user-accepted Phase1 real sign-in preserved                                | Not revalidated against hosted system here                                  |
| 2 Seven stage groups                  | Combined synthetic desktop/mobile navigation; source-aware Interview next action | Preserve derived stages and authoritative Opportunity lifecycle             |
| 3 Coherent role workspace             | All domain panels share selected role/session                                    | Hosted acceptance                                                           |
| 4 Separate fit scores                 | Existing workflow/UI regression preserved                                        | None introduced; real-data acceptance prior                                 |
| 5 Research/freshness                  | Recorded research UI preserved                                                   | Research refresh worker integration and deferred richer signals             |
| 6 Pursue/Pass/Defer                   | Existing SQL/UI tests and native races                                           | Exact approved rollout and worker reconciliation                            |
| 7 Generated material review           | Version/text viewers and review contracts                                        | Real generation worker adoption/handoff                                     |
| 8 Exact PDF/DOCX                      | Pair/hash contracts, synthetic rendering/download transport                      | Canonical renderer and hosted durable artifact verification                 |
| 9 Approve exact materials             | RLS/immutable approval tests and native retry                                    | Hosted rollout                                                              |
| 10 Employer ATS + answer/files packet | Existing URLs and material context                                               | Strongest apply link/complete approved packet remains owner scope           |
| 11 Explicit submission                | Human-only confirmation, retry/native races                                      | Hosted validation; no real submission during QA                             |
| 12 Employer-received exact versions   | Snapshot/immutability tests and recorded historical reader                       | PR4 legacy file_url bypass fix and hosted exact-byte history verification   |
| 13 Recommended/manual contacts        | New canonical Contacts UI, synthetic manual target and native tests              | Outreach production approval and agent/worker adoption                      |
| 14 Exact message + sent state         | Exact revisions, explicit human attestation, native/browser tests                | Approval; no external send performed                                        |
| 15 Interview preparation              | Structured schedule/prep/questions/evidence/cheatsheet, human gates              | Separate approval, hosted QA, bounded Gmail reconciliation writer authority |
| 16 Offer management                   | Structured immutable terms/negotiation/explicit decisions                        | Separate approval and hosted QA; no external commitment                     |
| 17 URL/JD/upload intake               | Controlled intake contracts/RLS/races, synthetic UI                              | Worker target/adoption and hosted upload/Storage acceptance                 |
| 18 Clear next actions                 | Shared role-stage/source-aware next action; raw queues hidden                    | Combined hosted workflow and blocked-state acceptance                       |

## Recommendation and blockers

Use the candidate for parent-coordinated integration review, then one exact production approval per new domain. Do not claim full v1 or hosted end-to-end completion. Worker deployment/reconciliation and durable real renderer/Storage acceptance remain separate gates. PR4 owner still owns the legacy material URL bypass and complete apply/history delivery work; no duplicate implementation was added here. Intake/delivery owner changes after this pin require a new integration pass. Production schema/permission changes, external commitments, public deployment and main merge remain unauthorized.
