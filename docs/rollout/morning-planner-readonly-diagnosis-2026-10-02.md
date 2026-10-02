# Morning Planner read-only diagnosis · October 2, 2026

Morning remains paused. No production records, permissions, flags, credentials or schedules were changed during this investigation.

## Proven findings

The initial 14:49:57 UTC failure was SQLSTATE 42501, “Active workspace authority required”, through hq_planner_inputs → hq_lock_planner_scope → hq_workspace_candidate. The resolver requires auth.uid() to map to an active principal, active workspace membership and workspace.read permission. A row's supplied actor ID does not establish that authority.

The read-only management connection observed at 15:30:00 UTC used postgres and had no Auth UID, resolved principal or nonempty request JWT settings. This is consistent with the initial failure; it does not reconstruct the failed invocation's actual claims. The recorded human actor currently has active Owner membership, and the workspace has exactly one active human Owner. Current membership is therefore not the demonstrated cause.

Plan ef3e507c-730e-411b-a8f9-d8705cacd3e1 remains draft, with no One Thing. Its header was created at 14:56:59 UTC, six required items at 14:57:32 and three optional items at 14:57:50. All nine remain pending.

The postgres table owner bypasses RLS, but enabled triggers still run. A draft header can preserve caller-supplied actor attribution when the resolver returns NULL, because the insert lifecycle does not enforce the update permission check. Item inserts additionally require hq_plan_item_guard → hq_assert_action_eligible → hq_workspace_candidate. Under the current unchanged guards, successful item inserts require resolved authority. RLS bypass alone cannot explain the nine successful item writes, and their recorded actor IDs do not prove authentication provenance.

## Evidence limits

The parent’s narrow log review found no final activation database error in the relevant available stream. A platform/tool policy block before SQL remains possible; a database denial of final activation is not proven. Earlier undefined-column errors for principals.is_active and external_subject reflect invalid identity queries; the actual resolver uses status and auth_user_id.

Separate tool calls can use independent sessions. Transaction-local settings do not survive their transaction, but no call transcript proves that such setup occurred or reset here. The available log stream cannot prove absence of preceding context setup. Historical trigger state and the relationship of earlier errors to this exact scheduled invocation are also not established.

The parent has already requested one redacted excerpt: the final blocked tool call, exact denial and immediately preceding context setup. No duplicate request is needed.

## Safe remediation recommendation

Keep Morning paused and all HQ flags off. Verify the worker's real caller transport through the existing authorized Auth/PostgREST path, including resolved principal, active membership and required permissions on each request. Require a successful hq_planner_inputs authority check before any draft write; stop the entire run on failure.

Do not map management postgres to the human Owner, trust supplied actor IDs, forge JWT/settings, broaden grants or weaken the guards. If the scheduler cannot supply legitimate application identity, a trusted narrowly scoped worker contract requires separate review. Preserve the partial draft pending that review; no activation, deletion or supersession is authorized here.

Application Queue's enabled state and reported run time do not establish successful authenticated execution. It was not run or modified.

## Preserved evidence

Sanitized read-only catalog snapshots accompany this report. They contain resolver/guard definitions, permission and trigger metadata, and plan timing/status metadata; no credential values or Auth user IDs. The earlier rollout inventories were copied into evidence/2026-10-02 after reconnection, preserving their original rollout-time snapshots. Subsequent live planner activity does not change those historical observations.

