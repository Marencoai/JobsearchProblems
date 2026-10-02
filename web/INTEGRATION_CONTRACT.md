# PR4 shared frontend integration contract

This documents the intake/delivery owner branch for the final isolated domain
integration. It does not change Outreach/Interview/Offer owner worktrees or
certify a combined stack. Preserve the user-authored worker snapshot commit
`a254eaed87e8b99da1608bcda236e6a03515f98e` and approved Phase2 SQL blob
`0ef9a55b7158d19a99cdf426a628b234191ee318`.

## Explicit capabilities

Current PR4 API:

```ts
declare function readOnlyFetch(
  origin: string,
  nativeFetch: typeof fetch,
  humanActions?: boolean,
  capabilities?: {
    manualIntake?: boolean;
    materialDelivery?: boolean;
    researchRefresh?: boolean;
  },
): typeof fetch;
declare function createHqClient(
  config: PublicConfig,
  nativeFetch?: typeof fetch,
): HqClient;
declare function loadWorkspace(
  client: HqClient,
  workspaceId: string,
  principalId: string,
  humanActions?: boolean,
  materialDelivery?: boolean,
): Promise<WorkspaceData>;
```

All optional capability booleans default false. Public config has `url`, public
`key`, and the four independent booleans above.
Server flags are `HQ_HUMAN_ACTIONS`, `HQ_MANUAL_INTAKE`,
`HQ_MATERIAL_DELIVERY`, `HQ_RESEARCH_REFRESH`; only exact `1` enables a flag.
No new flag is activated here. Packet viewing uses existing approved Materials
and has no independent mutation capability or new table.

PR5/PR6's fourth/fifth positional Interview/Offer booleans collide with this
fourth capabilities object. The final integrator must combine **all explicit
capabilities** and update all callers/tests together; choosing either shared
file loses the other domain. Prefer one typed capabilities object for the
combined API, with every optional boolean default false. Include all domains'
distinct public config flags, optional read-table overlays and narrow RPC
allowlists. Do not enable one capability implicitly through another.

| PR4 capability    | Additional allowed transport                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Human actions     | POST exact `hq_human_action` RPC                                                             |
| Manual intake     | POST exact `hq_request_job_intake`; POST/GET exact hashed `hq-intake` object path; no upsert |
| Material delivery | GET artifact registrations; GET exact hashed `hq-materials` object path                      |
| Research refresh  | POST exact `hq_request_research_refresh` RPC                                                 |

Origin is pinned; redirect/error, no-store and omitted browser credentials are
preserved. Raw table mutations, arbitrary RPCs, object listing, public/signed
object URLs, object overwrite/delete and private domain request ledgers remain
denied. Caller auth/RLS remains authoritative. New proposed types overlay the
generated schema; do not regenerate from an unapplied schema or include secrets.

## Components and resets

Session adds `manualIntake`, `materialDelivery`, `researchRefresh` plus
`intake(input,key)`, `upload(file,key)`, `deliver(material,artifact)` and
`refreshResearch(opportunity,key)` (returns exact task ID). Each operation
refreshes active human/Workspace identity, checks generation/Workspace after
async work, and shares the existing mutation guard for writes. Authentication
is in-memory. Sign-out/Workspace changes invalidate generations, clear loaded
data and unmount dialogs/file bytes; a stale result must not enter a new scope.
Application-level server flags remain independent of identity.

`HqShell` optional callbacks: `onIntake`, `onUpload`, `onDelivery`,
`onResearchRefresh`, alongside existing `onAction`. `WorkspaceScreen` passes
each only when its capability is explicitly enabled. `WorkspaceData.artifacts`
is optional and loaded only for material delivery. Task query adds
`workspace_id`; `JobView.researchTasks` is optional, filtered to company
intelligence work for that role, with a component-level Workspace check.

`ResearchRefresh` freezes the exact opportunity/version and key across uncertain
retry, prevents duplicate clicks, and permits a new key after the returned task
completes/fails/cancels. It is keyed by Workspace/Opportunity. Pending/blocked
states retain recorded facts and show plain text; raw machine results stay hidden.

`ApplicationPacket` selects only the exact approved Package and current
approved/submitted Materials in the same Workspace/Opportunity. Structured
answers bind an exact requirements Material ID. Missing required answers or
attachments disable client submission confirmation; an enabled delivery
capability also requires consistent registered pairs for required resume/cover
letter. This is a client acceptance guard, not a change to approved Phase2 RPC
authority. ATS navigation and Copy never call submission. Opening an old
submission resolves its exact Material ID/Workspace/type, never the latest
version. Legacy `file_url`/`storage_path` are preserved as history without a
clickable download bypass.

## QA matrix required for combined integration

PR4 automated tests cover default-off, each individual capability and all four
on, forbidden raw writes, SDK version/key/workspace envelopes, uncertain retry,
exact byte hashes and historical identity. The combined integrator must extend
that matrix across Outreach/Interview/Offer and their private-ledger denials,
retest sign-out/Workspace reset and preserve seven-stage source-aware actions.
Merge shared CSS, shell, client and QA screen intentionally. Do not resolve by
discarding a domain's transport checks, props, contexts or fixture flags.

Development-only `/qa` flags are `job`, `actions`, `intake`, `delivery`, `fail`,
`refresh`, `packet`. Combined PR4 fixture route:
`/qa?job=application&actions=1&packet=1&delivery=1&refresh=1`.
They use explicit synthetic callbacks, never server capability activation.
`/qa` remains 404 in production even with its fixture flag set. Packet fixture
files remain transport fixtures; canonical document QA is separate evidence.
Current toolset has no browser controller; new packet/refresh layout and actual
OS-saved PDF/DOCX/upload selection still need supported browser acceptance.
