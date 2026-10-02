# Consolidated planner and preparation hardening · proposed only

This is one locally generated forward migration for independent review. Nothing
in this package applies DDL, edits scheduled tasks, grants hosted access, creates
fixtures, enables flags, submits applications or sends messages.

- File: `supabase/migrations/20261002024651_hq_planner_revision_enforcement.sql`.
- SHA-256: `fa5782a9fc29cd9fc043c82340588bc368fb221c7b283520449a7d4227aa4000`.
- Generated with the existing Supabase CLI's `migration new`; apply only this
  exact reviewed file after the separate production approval. Never `db push`.
- Already applied Phase 2 SQL remains byte-for-byte unchanged, SHA-256
  `3e82cde7e177255c3767129a20417a87f50afc867f8db7163ba20e1987288125`.
- The other two PR4 intake/delivery and research migrations retain their existing
  review hashes and remain separate, unapproved and unapplied.

## Concrete schema and authority change

Two nullable, no-default `hq_preparation_task_id` columns are added: one on
Packages and one on Materials. There is no row backfill or new workflow table.
The scoped Package→Task foreign key and one-Package-per-Task partial unique
index bind the exact preparation handoff. A composite Material→Package/Task
foreign key enforces the complete scoped pair. Binding and Task authority are
immutable; new managed Material inserts must explicitly carry that Task ID.
Historical Material rows retain null and their content/version identity remains
immutable under the original lifecycle guard.

Six additional triggers guard Plan Item insertion, One Thing/activation,
Package insert lock ordering, managed Package lifecycle/binding, managed
Material creation/lifecycle/current selection and bound Task authority. Original
guards, policies and function definitions stay intact. The existing human RPC
is replaced only to add the two-line atomic Package binding after it creates
the revision Task; every other byte of its body and its existing ACL is preserved.

The candidate is the sole active human with active membership in the canonical
global Owner role of the existing active Workspace. Neither planner identity nor
a caller-supplied candidate ID chooses that person. Zero/multiple such Owners
fail closed for new selection. Historical completion remains legal after a
later deferral; original history/completion guards continue to apply.

There are three new caller-invoker RPCs, all with empty search path:

| RPC                                                                   | Required caller and result                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hq_planner_inputs(target_workspace_id, target_plan_id default null)` | Existing Workspace/Next Action/Plan read authority. Returns the resolved candidate, database observation time, all open deduplication IDs, candidate-eligible IDs, and optional active-Plan delivery/One Thing IDs.                                                                                         |
| `hq_preparation_target(target_workspace_id, target_task_id)`          | Existing Owner/orchestrator authority for Workspace, Opportunity, Task read/create and application read/prepare, under its existing RLS. Locks and creates/binds/reuses initial work, or resolves an already structured revision. Returns exact Task/Package/notes and prepare/reuse/completed disposition. |
| `hq_preparation_ready(w, t, p, expected_updated_at)`                  | Existing application read/prepare authority, including the narrow agent. Validates the exact handed-off Task/Package pair, current target and reviewed Package version before moving preparing→ready_for_review.                                                                                            |

`EXECUTE` is granted to `authenticated` only for these three RPCs and two scoped
private lock helpers. Their PUBLIC/anon execution is revoked. The private
planner helper checks active Workspace membership, Workspace read, Next Action
read and Plan read before locking that Workspace's rows; it returns only the
resolved candidate ID, captured locked action IDs and database observation time. The private readiness helper checks application read/
prepare and the active Workspace, exact bound pair and canonical Task state;
it returns void and exposes no Task rows. These helpers need a scoped definer
lock because invoker row-locking SELECTs also consult UPDATE policies. All other
new private functions revoke PUBLIC/anon/authenticated execution; all eleven
private definer functions have empty search path and explicit scoped checks or
are uncallable trigger entry points.

No business permission definitions, role-permission rows, memberships, policies,
table grants, Storage rules or existing helper attributes change. The
Application Agent keeps exactly its existing twelve permissions, with no Task
read/execute, approval, submission or role administration. Local tests execute
the positive preparation/readiness path and negative Task lookup under that
exact role. Owner handoff uses the existing broad Owner role; a read/create-only
Task role does not gain the Owner's existing row-lock/update authority.

## Lock protocol and compatibility

Planner selection locks the current action FOR SHARE and checks `clock_timestamp`
after the lock. Delivery locks the exact active Plan and all Workspace open
actions in ID order before checking current eligibility. Subsequent invoker reads are restricted to
that captured locked set; concurrent inserts appear only on a fresh call. Those action locks
conflict with ordinary `available_after` updates and the existing human deferral
RPC. Every open action remains in deduplication, including another assignee's
and future-deferred actions. Eligibility narrows only the selection/delivery set.

Preparation commands and inserts fence on the same scoped Opportunity row used
by the existing human RPC before Task/Package/version work. The earliest Package
INSERT trigger takes that fence before the original Package advisory version
lock. Material INSERT takes it before the original Material version lock and
automatic current-version reconciliation. No global or Workspace-wide lock is
added.

A raw UPDATE necessarily owns its Package/Material row before its BEFORE trigger
runs. It must therefore acquire the Opportunity fence with NOWAIT: contention
raises SQLSTATE 40001, rolling back that operation, rather than waiting in the
opposite order to the human RPC. The worker must refresh its Owner handoff and
retry the whole operation. The controlled readiness RPC takes Opportunity first
and then locks the Package under the existing agent update policy. Native tests
cover both execution orders and prove rejection before the held fence releases.
These choices follow PostgreSQL's documented [row-lock conflicts](https://www.postgresql.org/docs/17/explicit-locking.html)
and [NOWAIT behavior](https://www.postgresql.org/docs/17/sql-select.html).

Unclassified legacy Opportunities retain the original initial direct create/
reuse path; existing unrelated work does not acquire a new Task requirement.
New HQ revisions always bind atomically. The Owner RPC automatically classifies
only a new initial Task with the existing exact `hq:pursue:<Opportunity ID>`
idempotency key, or resolves an existing immutable binding. A reviewed/approved
legacy initial Package is reused without adding a binding or modifying history.
An unbound completed Task is reported completed without creating another Package.
Other unbound pending legacy work fails closed regardless of mutable title or
description. Before cutover, any such task needs reviewed Owner classification
of the actual candidate authority and exact current working Package through the
existing scoped binding write; no description parser or automatic backfill is
provided. Its approval is distinct from, and never repeats, candidate pursuit.

Managed wrong/stale/foreign/archived targets, unbound decoys, missing/mismatched
Material Task IDs, preparation after Task completion and resurrection of
terminal current flags are rejected. A prepare-only agent cannot create an
unbound Package on a managed Opportunity, reopen its reviewed/approved result or
archive older managed history. Existing authorized human approval/submission/
rejection/archival authority remains under the original lifecycle rules.

## Worker adoption and cutover

The exact proposed, self-contained replacements and complete resulting prompts
are in [the prompt artifact](qa-evidence/phase2-hardening-proposed-worker-prompts.json).
They replace only the two previous HQ insertion fragments in the user-verified
snapshot at commit `4f2341e9d09bef4ccc8d4abb1e31b67c91ebe35c`. Removing each new
fragment recovers the unchanged base prompt with only its old HQ fragment removed.
Schedules and enabled states are not changed. Nothing was adopted or read back
from live task APIs in this follow-up. The previous denied task edit is not retried
or bypassed. There is no new Node/service deployment prerequisite.

Before a single production approval, independently review this exact SQL/hash,
ACL/private lookup scope, all direct-write tests, legacy classification and both
prompt replacements. Refresh live catalog and migration inventory; confirm this
generated version/name has not already been applied, the original body/ACL pin
still matches, and the configured Workspace has exactly one authoritative Owner.
Inventory pending canonical preparation tasks, working Packages/Materials and
their exact scopes. Stop for ambiguity; do not silently mutate or guess old work.

After approval, apply only this file and compare expected catalog deltas, then
adopt the exact hardened caller instructions through a supported task-write and
readback path before any new managed revision is processed. An old caller
omitting the Material Task ID safely fails once managed work exists; it is not
compatible with that new contract. Confirm normal authenticated human/agent
acceptance and scheduled behavior before activating the human UI flag. Keep the
diagnostic separate and default off. The bounded hosted fixture proposal still
requires its own Workspace-purpose/access/run approval and supported owning-app
Auth context; no fixture command runner or fixtures are authorized by this SQL.

SQL enforces persisted selections and bound, current preparation writes. A
valid pair for another independently authorized task is still authorized work;
the database cannot know an LLM's unstated intended task. Callers must carry the
selected Task ID rather than inventing/replacing both IDs. SQL also cannot police
arbitrary scheduled-task free text after raw history reads. Revalidated delivery
IDs require controlled final rendering; a guarantee over the actual delivered
message remains unverified on the current ChatGPT task surface. This migration
does not certify ATS inspection, factual answer completeness, renderer QA or
the two separate proposed file/intake/research migrations.

## Rollback and evidence

Before commit, ordinary transaction rollback leaves no DDL. After apply, disable
the human feature flag and roll back the UI if needed while preserving deferrals,
immutable bindings, Materials, approved/submitted history and hardened worker
instructions. Do not drop columns, remove guards, restore the description parser
or blindly retry an old caller. A database down migration or access/task changes
require a separately reviewed approval; none is supplied or executed here.

Local evidence at this SQL hash:

- 236 web tests in 20 files pass, including the exact proposed prompt-preservation check;
  27 dedicated guard/role tests plus one catalog compatibility test are included.
- 21 native PostgreSQL 17.6 cases pass. Twelve new cases cover future deferral,
  due boundary during a lock wait, reverse-order deferral/delivery, initial
  handoff retry, Material insert/revision both orders, raw readiness both orders,
  successive revisions, raw Material current selection and unrelated Opportunity
  progress, and an inserted-then-deferred action in the widened post-lock read
  window. Existing nine intake/research/human transaction cases also pass.
- The catalog test applies this exact migration without either other proposed
  migration and proves unchanged policies, table grants/RLS, permissions, roles,
  memberships, all original triggers, helper definitions and original RPC ACL.
  Removing only the binding statement restores the approved RPC body exactly.
- Native tests use an owned temporary PostgreSQL cluster/private Unix socket,
  TCP disabled and synthetic Auth/records; cleanup is confirmed. PGlite tests
  use memory and simulated claim UUIDs only. Neither is live Auth acceptance.
- Lint, typecheck and optimized production build pass. Final format and prompt checks
  are recorded in [the validation artifact](qa-evidence/phase2-hardening-local-validation.json).

No hosted schema/grants/rows, live tasks, flags, external applications or messages
were changed in this implementation turn. Parent remains responsible for PR7
integration, independent review and the consolidated production gate.
