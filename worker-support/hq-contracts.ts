// Optional offline checks only. Authority and locks come from the reviewed
// database RPCs; supplied identity/time cannot replace those calls. No Node
// runtime is required by the scheduled worker contract.
export type PlannerAction = {
  id: string;
  workspace_id: string;
  assigned_to_principal_id: string | null;
  status: string;
  available_after?: string | null;
};
export type PlannerItem = {
  id: string;
  workspace_id: string;
  next_action_id: string;
};
export function plannerEligibility(
  workspaceId: string,
  principalId: string,
  actions: PlannerAction[],
  items: PlannerItem[],
  now: string,
) {
  const clock = Date.parse(now);
  if (!workspaceId || !principalId || !Number.isFinite(clock))
    throw new Error("Workspace, human principal, and valid clock are required");
  const open = actions.filter(
    (a) => a.workspace_id === workspaceId && a.status === "open",
  );
  const eligible = open.filter((a) => {
    const resume = a.available_after ? Date.parse(a.available_after) : null;
    if (resume !== null && !Number.isFinite(resume))
      throw new Error("Invalid action deferral timestamp");
    return (
      (!a.assigned_to_principal_id ||
        a.assigned_to_principal_id === principalId) &&
      (resume === null || resume <= clock)
    );
  });
  const ids = new Set(eligible.map((a) => a.id));
  return {
    deduplication_action_ids: open.map((a) => a.id),
    eligible_action_ids: [...ids],
    delivery_plan_item_ids: items
      .filter(
        (i) => i.workspace_id === workspaceId && ids.has(i.next_action_id),
      )
      .map((i) => i.id),
  };
}
export type PreparationTask = {
  id: string;
  workspace_id: string;
  opportunity_id: string;
  task_type: string;
  domain: string;
  trigger_type: string;
  trigger_reference: string;
  title: string;
  description: string | null;
};
export type PreparationPackage = {
  id: string;
  workspace_id: string;
  opportunity_id: string;
  package_number: number;
  status: string;
  candidate_notes: string | null;
  hq_preparation_task_id?: string | null;
};
export function preparationTarget(
  task: PreparationTask,
  packages: PreparationPackage[],
) {
  if (
    task.task_type !== "prepare_application_package" ||
    task.domain !== "application" ||
    task.trigger_type !== "candidate_action" ||
    task.trigger_reference !== "candidate_decided_to_pursue" ||
    !task.id ||
    !task.workspace_id ||
    !task.opportunity_id
  )
    throw new Error(
      "Explicit candidate application preparation authority is required",
    );
  const local = packages
    .filter(
      (p) =>
        p.workspace_id === task.workspace_id &&
        p.opportunity_id === task.opportunity_id &&
        p.status !== "archived",
    )
    .sort((a, b) => b.package_number - a.package_number);
  // Initial and legacy classification belongs to the Owner RPC. Never infer
  // package authority from mutable titles, descriptions, or package recency.
  const bound = packages.filter((p) => p.hq_preparation_task_id === task.id);
  if (!bound.length)
    return {
      disposition: "owner_handoff_required",
      package_id: null,
      candidate_notes: null,
    };
  const target = local.find((p) => p.hq_preparation_task_id === task.id);
  if (bound.length !== 1 || !target || target.id !== local[0]?.id)
    throw new Error(
      "Revision package is unavailable, foreign, archived, or superseded",
    );
  if (target.status === "ready_for_review" || target.status === "approved")
    return {
      disposition: "already_ready",
      package_id: target.id,
      candidate_notes: target.candidate_notes,
    };
  if (!["draft", "preparing"].includes(target.status))
    throw new Error("Package is not a working preparation target");
  return {
    disposition: "reuse",
    package_id: target.id,
    candidate_notes: target.candidate_notes,
  };
}
