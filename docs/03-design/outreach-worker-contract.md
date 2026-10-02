# Proposed Outreach consumer contract

Production off. This is integration for the existing task/Principal/permission architecture, not a deployed worker or a grant of new authority. Apply the reviewed Outreach domain only after its one production approval; separately configure the narrow future worker role and consumer before enabling generation/inbox/wait processing.

Workers authenticate normally, resolve their active Principal and membership, and query explicit `workspace_id`. Use `internal_tasks`, existing lifecycle/dependency/attempt controls, and `outreach_task_links`; do not introduce another queue or schedule. The existing queue owner assigns the configured Principal and advances the task to running according to its current authority. An unassigned task is not proof that an agent may grant itself task-management authority.

## Draft preparation

1. The human requests `request_draft` for an active engagement and optional linked opportunity. For regeneration, include the exact working `message_id`. The RPC queues `task_type='prepare_outreach_draft'`, `domain='outreach'`, `trigger_type='candidate_action'`, `trigger_reference='candidate_requested_outreach_draft'`, with typed routing. It generates no text.
2. Read the exact task link, engagement, contact and approved shared context through the worker's authenticated RLS. Retrieve prior version/history and Candidate Knowledge/Company Intelligence only with the corresponding existing read capabilities; do not copy private memory or unrelated personal details into professional notes.
3. When the exact task is running and owned by this Principal, call `outreachPreparationTarget` or the CLI below with the actual queried records. Terminal work is a no-op. Wrong tenant/person/role/task, unauthorized trigger or sent/superseded regeneration target fails closed.
4. The existing worker prepares text using its governed workflow. Preserve selected evidence references and distinguish inferred relationship context from candidate confirmation. Never overwrite an existing version or autoapprove/claim sent.
5. Publish `complete_draft` with the same exact task/engagement/role/optional base message, reviewed engagement revision, channel/subject/content/evidence and stable request UUID. The controlled RPC checks ownership/authorization again, saves a new version, creates the human review action, and completes only that preparation task atomically. Retry with the original request UUID and payload. If stale, reload and reconcile rather than blindly replacing the human's newer text.

```sh
node worker-support/outreach-cli.mts preparation < /path/to/synthetic-or-authorized-context.json
```

Input keys: `principal_id`, `task`, `task_link`, `engagement`, `messages`. The CLI is pure routing and emits IDs/revision/disposition only, not raw content or credentials. It is not a database client or permission source.

## Incoming communications

The existing authorized Gmail/hiring consumer may call `record_received` only after verified source matching and appropriate role review. Preserve exact content, channel, actual received timestamp and deterministic external reference. A workspace/channel/direction external-reference constraint and stable request key prevent duplication. Never infer that an outbound draft was sent from an inbound message.

Set `response_to_message_id` only when source evidence ties the incoming communication to that exact sent message/workstream/role. An exact response resolves that specific wait and any contextual follow-up review; a general networking note never cancels other outstanding waits. Every incoming message creates a contextual human review with original source metadata in Activity history. Sent content remains frozen.

## Waiting and follow-up

`mark_sent` can create an `outreach_follow_up` task in `waiting` with `not_before` and `waiting_condition='outreach_response_or_due'`. `outreach_task_links` ties it to the exact sent version. The engagement's next-follow-up timestamp is only a display cache. Existing consumer scheduling stays authoritative.

Read exact task/link/message/engagement and linked incoming messages. Pass actual rows to `outreachFollowUpDisposition` or:

```sh
node worker-support/outreach-cli.mts follow-up < /path/to/synthetic-or-authorized-context.json
```

Input keys match preparation plus `now`. Terminal work stays terminal; inactive workstreams are blocked; exact incoming replies resolve the wait. A due timestamp only recommends `reconcile_follow_up`, which creates/reuses one human review action. It never automatically generates or sends another message. Human `resolve_follow_up` records a no-send decision, or a new explicit mark-sent may resolve that identified prior wait after a subsequent message was externally sent.

## Capability boundary

The migration grants no agent role. Future draft/inbox/wait roles must receive only the exact command/context capabilities they need, reviewed against the SQL command matrix. Preparation needs `outreach.draft` and context/activity/task/action abilities; evidence requires existing `candidate_knowledge.read`. A worker never needs `outreach.approve`, `outreach.record_sent`, `outreach.send`, Auth administration, workspace/role management, application submission, or a service role. Human-only command checks remain in force even after a mistaken domain grant.

Keep the consumer disabled until its real identity/role is explicitly configured and the matching migration is approved/deployed. Local tests establish SQL/policy/consumer contracts; they do not establish hosted Auth/PostgREST acceptance or live consumer adoption. Real outreach remains a separate human authorization gate.
