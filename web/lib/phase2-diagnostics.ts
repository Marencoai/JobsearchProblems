import type { HqClient } from "./supabase/client";

export function phase2DiagnosticsEnabled(environment?: string, flag?: string) {
  return environment === "development" && flag === "1";
}

export type Phase2ReadOnlyReport = {
  observed_at_browser_utc: string;
  principal_id: string;
  principal_type: "human";
  workspace_id: string;
  active_membership_verified: true;
  available_after_postgrest_read: true;
  sampled_open_action_present: boolean;
  human_actions_enabled: boolean;
  workflow_writes: false;
  rpc_executed: false;
  safe_to_enable: false;
};

// The Session provider verifies the normal owning-app identity/membership
// before this read and checks its generation again before returning the report.
// No Auth values, source rows or arbitrary server errors enter the report.
export async function readPhase2Diagnostics(
  client: HqClient,
  principalId: string,
  workspaceId: string,
  humanActions: boolean,
): Promise<Phase2ReadOnlyReport> {
  const result = await client
    .from("next_actions")
    .select("id,available_after")
    .eq("workspace_id", workspaceId)
    .eq("status", "open")
    .limit(1);
  if (result.error || !Array.isArray(result.data))
    throw new Error("The authenticated Phase 2 column read did not pass.");
  return {
    observed_at_browser_utc: new Date().toISOString(),
    principal_id: principalId,
    principal_type: "human",
    workspace_id: workspaceId,
    active_membership_verified: true,
    available_after_postgrest_read: true,
    sampled_open_action_present: result.data.length === 1,
    human_actions_enabled: humanActions,
    workflow_writes: false,
    rpc_executed: false,
    safe_to_enable: false,
  };
}
