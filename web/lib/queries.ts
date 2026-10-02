import type { HqClient } from "./supabase/client";
import type { Identity, WorkspaceData, Row } from "./types";

type ReadResult = { data: unknown[] | null; error: unknown };
export async function readPages<T>(
  query: (from: number, to: number) => PromiseLike<ReadResult>,
): Promise<T[]> {
  const rows: T[] = [];
  const size = 200;
  for (let from = 0; from < 10_000; from += size) {
    const result = await query(from, from + size - 1);
    if (result.error || !Array.isArray(result.data))
      throw new Error("We couldn’t load this data. Please retry.");
    rows.push(...(result.data as T[]));
    if (result.data.length < size) return rows;
  }
  throw new Error("This workspace needs a more focused query to load safely.");
}
export async function resolveIdentity(client: HqClient): Promise<Identity> {
  const verified = await client.auth.getUser();
  if (verified.error || !verified.data.user)
    throw new Error(
      "Your session could not be verified. Please sign in again.",
    );
  const result = await client
    .from("principals")
    .select("id,name,auth_user_id,principal_type,status")
    .eq("auth_user_id", verified.data.user.id)
    .eq("principal_type", "human")
    .eq("status", "active")
    .limit(2);
  if (result.error || result.data?.length !== 1)
    throw new Error("Your active human profile could not be resolved.");
  const principal = result.data[0];
  const memberships = await readPages<Identity["memberships"][number]>(
    (from, to) =>
      client
        .from("workspace_memberships")
        .select("id,workspace_id,role_id,status")
        .eq("principal_id", principal.id)
        .eq("status", "active")
        .order("id")
        .range(from, to),
  );
  if (!memberships.length)
    throw new Error(
      "No active workspace membership is visible for this account.",
    );
  const [workspaces, roles] = await Promise.all([
    client
      .from("workspaces")
      .select("id,name,status")
      .in(
        "id",
        memberships.map((m) => m.workspace_id),
      )
      .eq("status", "active")
      .order("name"),
    client
      .from("roles")
      .select("id,name")
      .in("id", [...new Set(memberships.map((m) => m.role_id))]),
  ]);
  if (workspaces.error || roles.error || !workspaces.data?.length)
    throw new Error("Your workspace access could not be loaded.");
  return {
    principal,
    email: verified.data.user.email ?? "",
    memberships,
    workspaces: workspaces.data,
    roles: roles.data ?? [],
  };
}
export async function loadWorkspace(
  client: HqClient,
  workspaceId: string,
  principalId: string,
  humanActions = false,
  materialDelivery = false,
): Promise<WorkspaceData> {
  const paged = <T>(
    query: (from: number, to: number) => PromiseLike<ReadResult>,
  ) => readPages<T>(query);
  const [
    opportunities,
    companies,
    evaluations,
    evidence,
    gaps,
    intelligence,
    evaluationIntelligence,
    sources,
    packages,
    materials,
    applications,
    submittedMaterials,
    actions,
    tasks,
    activities,
    activityLinks,
  ] = await Promise.all([
    paged<Row<"opportunities">>((a, b) =>
      client
        .from("opportunities")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("id")
        .range(a, b),
    ),
    paged<WorkspaceData["companies"][number]>((a, b) =>
      client
        .from("companies")
        .select(
          "id,name,website_url,careers_url,industry,company_size,headquarters_location",
        )
        .eq("workspace_id", workspaceId)
        .order("id")
        .range(a, b),
    ),
    paged<Row<"evaluations">>((a, b) =>
      client
        .from("evaluations")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("id")
        .range(a, b),
    ),
    paged<Row<"evaluation_evidence">>((a, b) =>
      client
        .from("evaluation_evidence")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("id")
        .range(a, b),
    ),
    paged<Row<"application_gaps">>((a, b) =>
      client
        .from("application_gaps")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("id")
        .range(a, b),
    ),
    paged<Row<"company_intelligence">>((a, b) =>
      client
        .from("company_intelligence")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("id")
        .range(a, b),
    ),
    paged<Row<"evaluation_company_intelligence">>((a, b) =>
      client
        .from("evaluation_company_intelligence")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("id")
        .range(a, b),
    ),
    paged<Row<"opportunity_sources">>((a, b) =>
      client
        .from("opportunity_sources")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("id")
        .range(a, b),
    ),
    paged<Row<"application_packages">>((a, b) =>
      client
        .from("application_packages")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("id")
        .range(a, b),
    ),
    paged<Row<"application_materials">>((a, b) =>
      client
        .from("application_materials")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("id")
        .range(a, b),
    ),
    paged<Row<"applications">>((a, b) =>
      client
        .from("applications")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("id")
        .range(a, b),
    ),
    paged<Row<"application_submitted_materials">>((a, b) =>
      client
        .from("application_submitted_materials")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("id")
        .range(a, b),
    ),
    paged<WorkspaceData["actions"][number]>((a, b) =>
      client
        .from("next_actions")
        .select(
          "id,opportunity_id,internal_task_id,source_activity_event_id,assigned_to_principal_id,action_type,title,context_summary,priority,due_at,status,updated_at" +
            (humanActions ? ",available_after" : ""),
        )
        .eq("workspace_id", workspaceId)
        .or(
          "assigned_to_principal_id.eq." +
            principalId +
            ",assigned_to_principal_id.is.null",
        )
        .order("id")
        .range(a, b),
    ),
    paged<WorkspaceData["tasks"][number]>((a, b) =>
      client
        .from("internal_tasks")
        .select(
          "id,workspace_id,opportunity_id,task_type,domain,status,trigger_type,trigger_reference,source_activity_event_id",
        )
        .eq("workspace_id", workspaceId)
        .order("id")
        .range(a, b),
    ),
    paged<WorkspaceData["activities"][number]>((a, b) =>
      client
        .from("activity_events")
        .select(
          "id,opportunity_id,event_type,event_timestamp,summary,source_system",
        )
        .eq("workspace_id", workspaceId)
        .order("id")
        .range(a, b),
    ),
    paged<WorkspaceData["activityLinks"][number]>((a, b) =>
      client
        .from("activity_event_links")
        .select("activity_event_id,entity_type,entity_id")
        .eq("workspace_id", workspaceId)
        .order("id")
        .range(a, b),
    ),
  ]);
  const artifacts = materialDelivery
    ? await paged<NonNullable<WorkspaceData["artifacts"]>[number]>((a, b) =>
        client
          .from("application_material_artifacts")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("id")
          .range(a, b),
      )
    : [];
  return {
    artifacts,
    opportunities,
    companies,
    evaluations,
    evidence,
    gaps,
    intelligence,
    evaluationIntelligence,
    sources,
    packages,
    materials,
    applications,
    submittedMaterials,
    actions,
    tasks,
    activities,
    activityLinks,
  };
}
