# Phase 2 enforcement and bounded hosted validation proposal

**Prepared October 2, 2026; no fixture writes, access grants or new DDL applied.**
The exact approved migration is already applied and must not be reapplied.
Keep `HQ_HUMAN_ACTIONS` disabled. This proposal does not authorize production
hardening, live task edits, activation, applications or messages.

## Current validation availability

The current tool catalog exposes no browser/computer/session controller. The
Supabase management connection does not carry Diana's or Application Agent's
normal Auth session. No tokens, browser storage, credential files or Auth
values were inspected, exported or copied; no claims were forged. An available
normally signed-in session must be used only inside its owning app. The tested
`authenticated` database role without Auth claims is explicitly not evidence
of authenticated human/agent acceptance.

Read-only metadata identifies these existing workspaces:

| Workspace        | ID                                     | Observed context                                                                                                                      |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Test Workspace   | `538d7b18-ca89-4950-a5b0-164a77837095` | Active; Diana has existing active Owner membership and an Auth binding. Zero Opportunities, Internal Tasks, Packages and Daily Plans. |
| Test Workspace 2 | `063adec2-3b67-436c-8a65-c55590859386` | Active; a different human has Owner membership. Same four record counts are zero. Diana has no observed membership.                   |
| Diana Job Search | `9341c194-c4f6-45c4-b3b1-37a832a7fc68` | Production; no test mutations allowed. No existing deferral/revision acceptance cases.                                                |

Names and empty counts do not certify a test-only purpose. Confirm that the
first workspace is reserved for these synthetic fixtures before writing.
No access changes are needed for Diana or the foreign-workspace denial check.
No Application Agent membership currently exists in either candidate test
workspace. An Auth binding's existence does not establish an available session.

### Optional user-run owning-session check

The follow-up includes a temporary in-page diagnostic, default off and gated to
development plus `HQ_PHASE2_DIAGNOSTICS=1`. It renders inside the existing HQ
Session provider, so a button uses that app's normal in-memory authenticated
client; no token copying, new client, RPC allowlist expansion or alternate app
session is involved. Production never enables the panel even if the flag is set.

After the maintainer integrates this code into the normal owning HQ development
runtime and deliberately enables that diagnostic flag, the user can click
**Read-only Phase 2 diagnostic → Check signed-in access** in the existing page.
Use the ordinary HQ sign-in if that owning app has no current session. Signing
in alone does not restore the unavailable automation controller: this is an
explicit user-operated diagnostic UI, not automated browser QA. This worker has
not restarted another owner's app, enabled the panel or performed a live check.

The provider revalidates the user/principal/active Workspace membership, performs
one scoped `GET next_actions?select=id,available_after&limit=1`, then rechecks its
session generation and Workspace. The displayed report has only whitelisted
IDs, booleans and a browser-observation timestamp. No Auth identifier, email,
token, source text or raw server error is printed; changing Workspace/signing
out discards the old panel. The user may share that displayed report if desired.

This can establish normal human Auth/PostgREST column-read evidence without
fixture approval. It makes no RPC/workflow write, does not prove agent authority,
does not certify the latest server flag state beyond the client's loaded config,
and does not test scheduled behavior or make activation safe. Agent checks still
require that agent's normally authenticated owning-app context.

## Database enforcement decision

**A consolidated controlled database path is needed to meet a requirement that
the database reject these two mistakes even if an automation chooses wrongly.**
No actual worker error has been observed; successful behavioral tests alone
would not close the schema-level gaps. The live definitions show:

- `public.prepare_daily_plan_item`, `private.validate_todays_one_thing` and
  `private.enforce_daily_plan_lifecycle` contain no `available_after` guard.
  A still-open deferred action can satisfy the current plan-write checks.
- Material INSERT permits a prepare-authorized caller on draft/preparing/
  ready-for-review Packages. It checks package scope/lifecycle but has no
  preparation-task target input or immutable task→Package binding. A wrong
  accessible working Package can pass those checks.

Existing RPC/RLS/lifecycle enforcement of human authority, tenant scope,
idempotency, exact reviewed versions and approved/submitted history remains
valid. These are separate selection invariants. The already approved SQL file
and its blob stay unchanged.

## One forward hardening design, for exact SQL review before apply

Use the existing database, lifecycle triggers and Owner→Application Agent flow;
no new service, scheduler, evaluator or Node deployment requirement.

1. **Planner authority:** a caller-invoker input/delivery RPC under existing RLS
   returns all scoped open action IDs for deduplication and a separate eligible
   set computed using database time, candidate identity, open status and null/
   due deferral. Delivery joins existing plan IDs to current action eligibility;
   historical snapshots are preserved. New Plan Item, One Thing and activation
   guards reject future-deferred or foreign-assigned selections at write time.
   Allow completed/superseded historical selections to remain unchanged.
2. **Revision authority:** add a structured immutable binding for the authorized
   preparation Task, Workspace, Opportunity and exact target Package. Record
   it atomically when the forward version of the existing revision command
   creates the new draft/task. An Owner handoff validates candidate authority,
   latest non-archived target, status and notes. It returns an existing reviewed
   result on retry rather than regenerating it. Enforce the binding again on
   managed Material writes and Package readiness; reject another working,
   foreign, archived, stale or superseded target, including direct table writes.
3. **Narrow agent boundary:** the preparer keeps its existing twelve business
   permissions. It gains no Internal Task read/execute, approval, submission,
   service credentials or global role grants. Any new binding SELECT surface
   exposes only the scoped handoff under `application.prepare`, not arbitrary
   task data. Internal guard lookup may use the existing private-trigger pattern;
   public command functions remain caller-invoker with explicit execution grants.
   Review every security-definer change and lookup scope rather than assuming
   RLS alone proves the bound target.
4. **Concurrency and compatibility:** lock in a documented common order from
   Workspace/Opportunity to Task/binding, Package and Materials; planner locks
   actions in a stable order compatible with deferral updates. Revalidate under
   those locks using database time. Demonstrate future/exact-boundary races,
   revision-vs-readiness/material races, retries and unrelated-tenant isolation
   in native PostgreSQL before hosted approval. Preserve legacy authorized
   initial create/reuse behavior through an explicit handoff; no extra pursuit
   or strategy approval. Do not parse ambiguous historical task descriptions or
   silently enforce a new contract on unclassified existing work.
5. **Cutover:** provide exact generated forward migration, SQL hash, policy/
   grant diff, self-contained worker insertion and local evidence together for
   one schema/caller-contract review. Refresh live inventory before apply.
   Do not replace the reviewed file or reuse its migration name. Actual task
   adoption needs supported readback; denied edits must not be bypassed.

Filtered SQL results cannot prevent an LLM from mentioning a deferred action in
free text after reading unrelated/raw history. Database authority can enforce
the eligible set and persisted selections. A guarantee over the final delivered
message additionally requires the existing delivery caller to render/accept
only that revalidated set through a controlled output path. If the ChatGPT task
delivery surface cannot provide that path, state that guarantee as unverified;
do not claim a read-only RPC alone controls arbitrary external composition.

## One minimal fixture/validation approval proposal

Suggested parent-facing approval request:

> Confirm that Test Workspace `538d7b18-ca89-4950-a5b0-164a77837095` is test-only
> and approve the single bounded synthetic run below, through normal authenticated
> Diana/Owner and the existing Application Agent in their owning apps. Permit one
> isolated prepare-only role/membership there if needed, with exactly the existing
> twelve permissions. Preserve all fixture/audit records afterward. This approves
> neither new production DDL, scheduled-task changes nor flag activation.

Preconditions: normal sessions are available through supported owning-app tools;
current test-workspace counts/permissions are rechecked; every generated record
is marked `HQ Phase2 validation / synthetic only` and its ID recorded before
dependent writes. Halt on unexpected rows, identity, workspace or lifecycle
result. No Auth user/password/token is created or altered. No generic admin
credential, forged claims or management-role impersonation is used for the
acceptance calls.

The ordinary HQ client remains read-only while `HQ_HUMAN_ACTIONS` is off, and
the new diagnostic deliberately permits no RPCs. A fixture run therefore also
needs a supported, normally authenticated owning-app command surface. If none
exists, locally implement/review one development-only fixture runner first:
fixed Test Workspace ID, only approved fixture IDs/commands/row caps, existing
RLS, expected versions and fresh identity checks, no arbitrary SQL or generic
RPC/table-write forwarding. Its transport must reject every production
Workspace and remain absent in production. Add its exact allowed operations
to the single fixture approval before execution; do not enable the global human
flag, weaken the normal client boundary or use a browser console/token export
as a shortcut. This runner is proposed, not implemented or authorized to write.

Bound the full run, including retries and automatic side effects, to:

| Table/surface                                                               | Maximum new rows or operations                                                                       |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Existing test Workspace and Diana Owner membership                          | No creates or updates                                                                                |
| Workspace-local role                                                        | At most 1, named `HQ validation prepare-only`                                                        |
| Role permissions                                                            | Exactly 12 existing keys listed below; no new permission definitions                                 |
| Workspace membership                                                        | At most 1 for the existing Application Agent principal in this test Workspace only                   |
| Companies                                                                   | 1 fictional company, no employer/network action                                                      |
| Opportunities                                                               | 2 fictional roles: deferral and revision                                                             |
| Evaluations                                                                 | 2 synthetic evaluations completed by existing permitted Owner workflow                               |
| Next Actions                                                                | At most 5, including RPC-generated apply/review actions; never replacement actions to evade deferral |
| Application Packages                                                        | At most 3: original, exact requested revision, optional intentional stale-target decoy               |
| Application Materials                                                       | At most 6 synthetic text-only rows, three per original/revision; no real files or Storage objects    |
| Internal Tasks                                                              | At most 2, including Pursue/revision side effects; Owner uses legal lifecycle transitions            |
| Daily Plans / Items / Work Blocks                                           | At most 2 plans, 4 items, 2 populated blocks                                                         |
| Activity Events                                                             | At most 10, including attributed successful command records; identical retries must not add events   |
| Applications / Submitted Materials / Outreach / Interview / Offer / Storage | Zero rows or actions                                                                                 |
| New hardening binding, if separately approved/applied                       | At most 2 fixture bindings; no such table/write is authorized by this fixture proposal itself        |

Prepare-only keys: `workspace.read`, `company.read`, `job_family.read`,
`opportunity.read`, `opportunity_source.read`, `company_intelligence.read`,
`candidate_knowledge.read`, `settings.read`, `evaluation.read`,
`application_gap.read`, `application.read`, `application.prepare`.
Do not add `internal_task.read/execute`, `application.approve/submit` or any
global/Diana Job Search membership. If a role/membership already exists with a
different permission set, halt rather than silently editing it.

Run order and acceptance boundaries:

1. Read normal caller identities/permissions inside their owning app without
   logging Auth values. As Diana, verify test read paths and a foreign-workspace
   human RPC denial against Test Workspace 2; this rejection must precede writes.
2. Create the scoped synthetic source/evaluation/decision records. Pursue only
   the fictional revision role, checking same-key replay and one attributed
   task/event. Build the original text-only Package through legal preparation
   transitions, then approve only those exact synthetic Material IDs.
3. Put the original deferral action in an active synthetic plan while eligible.
   Defer the same action to a short future time with the human RPC; duplicate
   retry must preserve the same ID and one event. Verify deduplication retains
   it, current eligible/new-plan/delivery sets exclude it, and the original plan
   snapshot is unchanged. Check re-eligibility after its natural due boundary
   within a ten-minute run deadline; no timestamp rewrite or replacement row.
4. Request revisions of the exact original Package once plus identical replay.
   Check one new draft/task, exact target/notes and unchanged approved originals.
   Owner→existing preparer writes only the three synthetic rows on that target,
   reaches review readiness legally, and Owner finalizes the same fixture task.
   This exercises the handoff/database path; fictional text-only materials do
   not certify ATS inspection, canonical document generation or Storage delivery.
5. Agent human-RPC approval/submission and task execution attempts must fail
   before mutations. Human submission-without-confirmation may be tested only
   on a locally proven pre-write rejection path before the revision is created;
   no successful submission call is allowed. Foreign/stale-version/mismatched
   retry failures must add no records. Verify exact original hashes/IDs/status
   and capture a read-only after-count comparison.
6. Direct wrong-target Material writes, deferred Plan writes and stale target
   readiness attempts are **not zero-write negative tests on the current schema**.
   Run those acceptance attempts only after the consolidated hardening SQL is
   separately approved/applied and its pre-write rejection is proven locally.
   Until then, the live definition audit establishes the gap without inserting
   a record merely to demonstrate that permissive behavior.

Use one controlled invocation of an existing worker routine with explicit test
Workspace scope only if its owning app supports that scope without editing or
running the production schedules. A manual Auth/RPC fixture pass is not evidence
that the two production scheduled tasks actually ran. Their target remains
Diana Job Search. Do not temporarily retarget, clone, run or reschedule them
under this approval. Report separately any delivery/runtime path that cannot
be exercised safely.

The row budget deliberately covers the Auth/RPC/handoff contract, not a full
employer/ATS preparation run. It creates no Candidate Settings, Automation
Policies, Candidate Knowledge, templates or fake employer verification. A full
worker that requires those inputs must halt rather than borrow production
context or pretend an ATS was inspected. Additional test policy/configuration
or hosted-runner changes require a concrete extension to this approval scope.

Keep generated IDs, timestamps, exact instruction/SQL hashes, caller type and
permission booleans, before/after counts, denied errors and immutable artifact
fingerprints in the audit. Do not log tokens or real candidate facts. Leave the
test role, membership and records intact for inspection; no deletes, resets,
destructive cleanup or rollback of recorded human history. Stop the run at the
first cap violation or unexplained result. If the necessary owning-app sessions
remain unavailable, approval alone is not an execution workaround.
