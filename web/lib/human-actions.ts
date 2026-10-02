import type { HqClient } from "./supabase/client";
import type { Json } from "./database.types";
import type { JobView } from "./types";
export const HUMAN_COMMANDS = [
  "pursue",
  "pass",
  "defer",
  "approve_package",
  "request_changes",
  "save_positioning",
  "confirm_submission",
] as const;
export type HumanCommand = (typeof HUMAN_COMMANDS)[number];
export type HumanPayload = { [key: string]: Json | undefined };
export type HumanActionHandler = (
  job: JobView,
  command: HumanCommand,
  payload: HumanPayload,
  requestId: string,
) => Promise<void>;

export async function runHumanAction(
  client: HqClient,
  workspaceId: string,
  job: JobView,
  command: HumanCommand,
  payload: HumanPayload,
  requestId: string,
) {
  const { data, error } = await client.rpc("hq_human_action", {
    target_workspace_id: workspaceId,
    target_opportunity_id: job.opportunity.id,
    expected_updated_at: job.opportunity.updated_at,
    request_id: requestId,
    command,
    payload,
  });
  if (error) {
    if (error.code === "40001")
      throw new Error(
        "This role or its materials changed. Reload and review before trying again.",
      );
    if (error.code === "42501")
      throw new Error(
        "Your account cannot perform this action in this workspace.",
      );
    if (error.code === "PGRST202")
      throw new Error(
        "Human actions have not been enabled for this workspace yet.",
      );
    const safeMessages = [
      "Resolve blocking or unknown application gaps before approval",
      "The package is not ready for review",
      "Every current material must have resolved content",
      "Review the latest application package",
      "No eligible candidate decision is open",
      "This opportunity is no longer active",
      "A completed evaluation is required",
      "Approved positioning is frozen; request a new package",
    ];
    const known = safeMessages.find((message) =>
      error.message.includes(message),
    );
    throw new Error(
      known ??
        "The action could not be confirmed. You can retry this same request safely.",
    );
  }
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    data.command !== command
  )
    throw new Error(
      "The action could not be confirmed. You can retry this same request safely.",
    );
  return data;
}
