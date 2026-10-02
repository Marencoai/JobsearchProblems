import type { HqClient } from "./supabase/client";
import type { Json } from "./database.types";
import type { OutreachData } from "./outreach-types";
import { readPages } from "./queries";
export const OUTREACH_COMMANDS = [
  "save_contact",
  "add_manual_target",
  "start_engagement",
  "link_contact",
  "select_primary_contact",
  "create_engagement",
  "update_engagement",
  "link_engagement",
  "save_draft",
  "request_draft",
  "approve_message",
  "mark_sent",
  "resolve_follow_up",
  "add_note",
  "record_interaction",
] as const;
export type OutreachCommand = (typeof OUTREACH_COMMANDS)[number];
export type OutreachPayload = { [key: string]: Json | undefined };
export type OutreachHandler = (
  command: OutreachCommand,
  payload: OutreachPayload,
  requestId: string,
) => Promise<Json>;
export async function runOutreachAction(
  client: HqClient,
  workspaceId: string,
  command: OutreachCommand,
  payload: OutreachPayload,
  requestId: string,
) {
  if (!OUTREACH_COMMANDS.includes(command) || !workspaceId || !requestId)
    throw new Error("Outreach request is incomplete.");
  const { data, error } = await client.rpc("hq_outreach_action", {
    target_workspace_id: workspaceId,
    request_id: requestId,
    command,
    payload,
  });
  if (error) {
    if (error.code === "40001")
      throw new Error("This relationship changed. Reload and review it again.");
    if (error.code === "42501")
      throw new Error("Your account cannot perform this Outreach action.");
    if (error.code === "PGRST202")
      throw new Error("Outreach is not enabled for this workspace yet.");
    throw new Error(
      "The result could not be confirmed. Retry this same request safely.",
    );
  }
  const key: Record<OutreachCommand, string> = {
    save_contact: "contact_id",
    add_manual_target: "engagement_id",
    start_engagement: "engagement_id",
    link_contact: "opportunity_contact_id",
    select_primary_contact: "contact_id",
    create_engagement: "engagement_id",
    update_engagement: "engagement_id",
    link_engagement: "engagement_opportunity_id",
    save_draft: "message_id",
    request_draft: "task_id",
    approve_message: "message_id",
    mark_sent: "message_id",
    resolve_follow_up: "task_id",
    add_note: "note_id",
    record_interaction: "interaction_id",
  };
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data[key[command]] !== "string"
  )
    throw new Error(
      "The result could not be confirmed. Retry this same request safely.",
    );
  return data;
}
export async function loadOutreach(
  client: HqClient,
  workspaceId: string,
): Promise<OutreachData> {
  const tableMap = {
    contacts: "contacts",
    opportunityContacts: "opportunity_contacts",
    engagements: "outreach_engagements",
    engagementOpportunities: "outreach_engagement_opportunities",
    messages: "outreach_messages",
    messageEvidence: "outreach_message_evidence",
    interactions: "outreach_interactions",
    notes: "relationship_notes",
    taskLinks: "outreach_task_links",
  } as const;
  const pairs = await Promise.all(
    Object.entries(tableMap).map(async ([key, table]) => {
      const rows = await readPages<OutreachData[keyof OutreachData][number]>(
        (from, to) =>
          client
            .from(table)
            .select("*")
            .eq("workspace_id", workspaceId)
            .order("id")
            .range(from, to),
      );
      if (rows.some((r) => r.workspace_id !== workspaceId || !r.id))
        throw new Error("Outreach data is unavailable. Reload this workspace.");
      return [key, rows] as const;
    }),
  );
  return Object.fromEntries(pairs) as OutreachData;
}
