// Pure worker boundary helpers. No database, network, preparation, ranking,
// permission changes, or external actions happen in this module.
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
    (a) =>
      a.workspace_id === workspaceId &&
      a.status === "open" &&
      (!a.assigned_to_principal_id ||
        a.assigned_to_principal_id === principalId),
  );
  const eligible = open.filter((a) => {
    if (!a.available_after) return true;
    const resume = Date.parse(a.available_after);
    if (!Number.isFinite(resume))
      throw new Error("Invalid action deferral timestamp");
    return resume <= clock;
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
  const revision = task.title === "Prepare requested application revisions";
  const match = task.description?.match(
    /^Use draft package ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\. /i,
  );
  if (revision && !match)
    throw new Error("Revision task must identify its exact draft package");
  const target = match ? local.find((p) => p.id === match[1]) : local[0];
  if (match && (!target || target.id !== local[0]?.id))
    throw new Error(
      "Revision package is unavailable, foreign, archived, or superseded",
    );
  if (!target)
    return { disposition: "create", package_id: null, candidate_notes: null };
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
