# Morning Planner identity transport decision · October 2, 2026

## Decision

The current exposed ChatGPT Supabase management tools cannot express the application's authenticated caller contract. Keep Morning paused. Recommend one separately reviewed **Planner Agent application tool connection**, using a dedicated Supabase Auth principal and the existing PostgREST/RLS path. Do not build or deploy a server until the scheduled ChatGPT environment's ability to use that connection is demonstrated. This is a new caller/runtime and least-privilege setup proposal, outside the unchanged approved schema rollout.

No missing transcript is required to reach this decision. The nine historical item inserts remain unexplained beyond the evidence limits in [the diagnosis](morning-planner-readonly-diagnosis-2026-10-02.md); they are not proof that the worker can authenticate consistently, activate a Plan, revalidate it and deliver the queue.

## Compatibility evidence

| Surface | What exists | Scheduled planner compatibility |
| --- | --- | --- |
| Supabase management SQL tool | Exposed arguments are project_id and query only; observed connection is postgres with NULL Auth UID/principal | No legitimate app-user token/session input. SQL claim overrides would impersonate identity, not authenticate it. |
| Agent mappings | Evaluation and Application Agents both currently active, Auth-bound and members of Diana's workspace | Neither role has next_action.read or any daily_plan permission. Do not repurpose or expand these roles. |
| Human app session | supabase-js signInWithPassword, network getUser verification, active principal/membership checks; memory-only session | Usable interactive human path. It is neither persistent scheduled identity nor a credential source for the model. |
| Existing app fetch allowlist | GET allowed tables plus gated exact human/domain commands | hq_planner_inputs is not allowed; daily_plans/items/block reads are not allowed. Existing diagnostic reads one open Next Action's available_after only. |
| Worker support | Credential-free reference helpers and self-contained scheduled prompt | No application Auth transport, token broker or deployed worker. Morning skill explicitly says ChatGPT automation, not persistent Node. |
| Edge Functions | Read-only inventory returns zero deployed functions | No existing application worker gateway to adopt. |

Read-only live membership/permission inventory accompanies this report. No Auth user UUIDs, credentials or tokens were retrieved. Historical identity migrations contain management-side set_config during provisioning; those one-time privileged migration statements are not a supported normal Auth runtime and must not be copied into scheduled execution. Repository acceptance claims prove historical scoped database behavior, not today's scheduled tool transport.

Official Supabase documentation distinguishes developer/organization MCP access from end-user application access and lists SQL execution tools rather than user sign-in tools: [MCP documentation](https://supabase.com/docs/guides/ai-tools/mcp). Normal application authorization uses the Data API's grants/RLS: [API security](https://supabase.com/docs/guides/api/securing-your-api). Auth getUser validates a session against the Auth server: [getUser](https://supabase.com/docs/reference/javascript/auth-getuser). Reconnecting or supplying a management PAT does not make auth.uid resolve to the Planner Agent.

## One proposed connection

Keep ChatGPT as the scheduling/synthesis surface. Add one application-facing tool adapter, separate from the Supabase management connector, callable by that actual scheduled runtime. The adapter's server-side authenticated session is a dedicated Planner Agent Auth user, bound to exactly one active agent principal and membership. It obtains genuine access tokens through Supabase Auth and calls PostgREST with that token and the public project key. Tokens/passwords stay in the adapter's approved secret store; they never enter model-visible arguments, responses, logs, browser configuration or SQL. No service/admin key or direct privileged SQL fallback.

Tool authentication must bind the authorized task/connection to that configured workspace; callers cannot choose another principal, token or tenant. Use fixed planner operations rather than arbitrary SQL/URL/table access: authority/preflight read, scoped planner input reads, validated draft persistence, activation and active-plan delivery recheck. Reject owner impersonation, arbitrary mutation payloads, application approvals/submissions, outreach sends and workspace management.

Every operation authenticates and checks the actual database-resolved principal/membership. Call hq_planner_inputs before the first write and again on the active Plan before delivery. Use exact eligible actions, existing lifecycle/versioning/history and current candidate derivation. Draft/activation failures return a blocked result without queue delivery; read and retain an existing partial draft for recovery rather than blindly creating duplicates. This design does not promise atomic writes across HTTP requests and does not introduce a new database writer. Any later atomic-persistence RPC is a separate proposal.

The Planner Agent role proposal uses existing permission definitions: workspace.read, settings.read, automation_policy.read, company.read, opportunity.read, evaluation.read, application.read, next_action.read/create/update/complete and daily_plan.read/create/update. Include internal_task.read only if the exact blocked-work reader needs it; do not grant task create/update/execute. Before implementation approval, freeze the tool request/response contract, exact read projections, reconciler mutations and necessary additional read-only join permissions from existing policies. daily_plan.complete, application.prepare/approve/submit/confirm, all domain writes and role/membership administration remain outside this planner proposal. A distinct Application Queue transport requires its own existing handoff/agent contract; this proposal does not resolve it by sharing the Planner identity.

## Approval and setup required

One consolidated parent review should cover: (1) scheduled ChatGPT support for the proposed app tool connection, including an actual no-data connectivity invocation; (2) the adapter hosting/authentication and server-only secret custody; (3) dedicated Planner Auth user/principal, one workspace membership and the frozen minimal existing-permission matrix; (4) isolated acceptance workspace/fixtures and allowed bounded writes; (5) prompt adoption and controlled test delivery. Existing schema approval does not authorize these trust-boundary/access/runtime changes.

Do not configure production credentials or provision authority during feasibility checking. First verify platform capability using a harmless credential-free stub on a separately approved test connection. If that scheduler cannot invoke the app connection, stop: this proposal is not deployable there. A different scheduler/runtime would require a new explicit decision; do not silently introduce a Node process, cron or Edge Function.

After local implementation review, submit the exact setup/deployment/access packet once, with rollback and evidence. Do not resume Morning until the actual scheduled session passes normal Auth/PostgREST end-to-end acceptance and the parent authorizes activation. No HQ UI flag needs enabling to test a worker transport.

## Required acceptance and rollback

- Actual scheduled invocation reaches the authorized adapter; no management SQL is used. Auth principal attribution is Planner Agent, while candidate selection remains the canonical human Owner.
- Missing/expired/revoked Auth, disabled principal/membership, denied permission, wrong tenant and anonymous calls fail before any draft write. Session expiry between operations fails closed and does not leak secrets.
- Positive synthetic run creates eligible items, persists One Thing, activates, rechecks the same active Plan and delivers only validated IDs. Future deferrals, changed action state, stale Plan, empty queue and ambiguous/no Owner stop or reconcile according to existing contracts.
- Inject failures before write, between item writes and before/after activation; prove no unvalidated delivery, no retry duplication, preserved draft/history and deterministic recovery. Do not use the real October 2 draft as a test fixture.
- Agent cannot perform application decisions, submissions, outreach, domain writes or authority administration; workspace isolation holds. Existing Evaluation/Application roles remain unchanged.
- Rollback: pause the task, disable the app connection/adapter and revoke its stored session/credential; separately approved membership/role disable if needed. Preserve Plans/items/history and approved schema. No deletion or permissive fallback.

These are proposed tests, not executed hosted acceptance. Current work was read-only research and documentation.

## Immediate human diagnostic

The existing development-only Phase 2 diagnostic can validate Diana's own normal sign-in, active workspace membership and authenticated available_after read, with all HQ flags off. It returns safe_to_enable=false and executes no RPC or writes. A passing result narrows the problem to the scheduled transport; it does not prove hq_planner_inputs or activation behavior.

A narrowly allowlisted read-only hq_planner_inputs diagnostic could be proposed locally if useful, but it is not currently present and should not be called through a claimed existing UI path. No diagnostic flag was enabled, browser session impersonated or credential requested in this review.

