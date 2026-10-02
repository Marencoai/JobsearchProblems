import type { HqClient } from "./supabase/client";
import type { Opportunity } from "./types";
export type ResearchRefreshHandler = (
  opportunity: Opportunity,
  requestId: string,
) => Promise<{ task_id: string } | void>;
export async function requestResearchRefresh(
  client: HqClient,
  workspace: string,
  opportunity: Opportunity,
  requestId: string,
) {
  if (opportunity.workspace_id !== workspace)
    throw new Error("This role belongs to a different workspace.");
  const { data, error } = await client.rpc("hq_request_research_refresh", {
    target_workspace_id: workspace,
    target_opportunity_id: opportunity.id,
    expected_updated_at: opportunity.updated_at,
    request_id: requestId,
  });
  if (error)
    throw new Error(
      error.code === "40001"
        ? "This role changed. Reload and start a new research request."
        : error.code === "42501"
          ? "Your account cannot request research in this workspace."
          : "The research request could not be confirmed. Retry the same request safely.",
    );
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    data.command !== "request_research_refresh" ||
    typeof data.task_id !== "string"
  )
    throw new Error(
      "The research request could not be confirmed. Retry the same request safely.",
    );
  return { task_id: data.task_id };
}
