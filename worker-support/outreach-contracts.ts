// Routing checks for existing authenticated workers. No research, generation,
// network, sending, permission changes, or database writes happen here.
export type OutreachTask = {
  id: string;
  workspace_id: string;
  opportunity_id: string | null;
  task_type: string;
  domain: string;
  trigger_type: string | null;
  trigger_reference: string | null;
  status: string;
  owner_principal_id: string | null;
  not_before: string | null;
};
export type OutreachTaskLink = {
  workspace_id: string;
  internal_task_id: string;
  outreach_engagement_id: string;
  outreach_message_id: string | null;
  purpose: string;
};
export type OutreachEngagement = {
  id: string;
  workspace_id: string;
  contact_id: string;
  status: string;
  revision: number;
};
export type OutreachMessage = {
  id: string;
  workspace_id: string;
  outreach_engagement_id: string;
  contact_id: string;
  opportunity_id: string | null;
  draft_series_id: string;
  version_number: number;
  direction: string;
  message_status: string;
  response_to_message_id: string | null;
};
function checkRoute(
  actor: string,
  task: OutreachTask,
  link: OutreachTaskLink,
  engagement: OutreachEngagement,
  purpose: "draft" | "follow_up",
) {
  if (
    !actor ||
    !task.id ||
    !task.workspace_id ||
    !engagement.id ||
    !engagement.contact_id ||
    !Number.isInteger(engagement.revision) ||
    engagement.revision < 1 ||
    task.owner_principal_id !== actor ||
    task.domain !== "outreach" ||
    link.workspace_id !== task.workspace_id ||
    engagement.workspace_id !== task.workspace_id ||
    link.internal_task_id !== task.id ||
    link.outreach_engagement_id !== engagement.id ||
    link.purpose !== purpose
  )
    throw new Error(
      "Exact same-workspace owned Outreach task route is required",
    );
}
function targetMessage(
  task: OutreachTask,
  link: OutreachTaskLink,
  engagement: OutreachEngagement,
  messages: OutreachMessage[],
) {
  const target = messages.find((m) => m.id === link.outreach_message_id);
  if (
    !target ||
    target.workspace_id !== task.workspace_id ||
    target.outreach_engagement_id !== engagement.id ||
    target.contact_id !== engagement.contact_id ||
    target.opportunity_id !== task.opportunity_id
  )
    throw new Error("Exact message context is unavailable or foreign");
  return target;
}
export function outreachPreparationTarget(
  actor: string,
  task: OutreachTask,
  link: OutreachTaskLink,
  engagement: OutreachEngagement,
  messages: OutreachMessage[],
) {
  checkRoute(actor, task, link, engagement, "draft");
  if (
    task.task_type !== "prepare_outreach_draft" ||
    task.trigger_type !== "candidate_action" ||
    task.trigger_reference !== "candidate_requested_outreach_draft"
  )
    throw new Error(
      "Explicit candidate Outreach preparation request is required",
    );
  if (task.status === "completed" || task.status === "cancelled")
    return { disposition: "terminal", task_id: task.id };
  if (task.status !== "running" || engagement.status !== "active")
    throw new Error(
      "Preparation requires an active engagement and running task",
    );
  const target = link.outreach_message_id
    ? targetMessage(task, link, engagement, messages)
    : null;
  if (
    target &&
    (target.direction !== "outbound" ||
      !["draft", "review", "approved"].includes(target.message_status) ||
      messages.some(
        (m) =>
          m.workspace_id === task.workspace_id &&
          m.draft_series_id === target.draft_series_id &&
          m.version_number > target.version_number,
      ))
  )
    throw new Error("Requested draft was sent, archived, or superseded");
  return {
    disposition: "prepare",
    task_id: task.id,
    engagement_id: engagement.id,
    expected_revision: engagement.revision,
    opportunity_id: task.opportunity_id,
    message_id: target?.id ?? null,
    command: "complete_draft",
  };
}
export function outreachFollowUpDisposition(
  actor: string,
  task: OutreachTask,
  link: OutreachTaskLink,
  engagement: OutreachEngagement,
  messages: OutreachMessage[],
  now: string,
) {
  checkRoute(actor, task, link, engagement, "follow_up");
  if (task.task_type !== "outreach_follow_up")
    throw new Error("An existing Outreach wait task is required");
  const clock = Date.parse(now);
  if (!Number.isFinite(clock)) throw new Error("Valid clock is required");
  if (task.status === "completed" || task.status === "cancelled")
    return { disposition: "terminal", task_id: task.id };
  if (
    !["waiting", "ready", "running"].includes(task.status) ||
    engagement.status !== "active"
  )
    return { disposition: "blocked", task_id: task.id };
  const sent = targetMessage(task, link, engagement, messages);
  if (sent.direction !== "outbound" || sent.message_status !== "sent")
    throw new Error("Wait task must reference the exact sent version");
  if (
    messages.some(
      (m) =>
        m.workspace_id === task.workspace_id &&
        m.outreach_engagement_id === engagement.id &&
        m.direction === "inbound" &&
        m.message_status === "received" &&
        m.response_to_message_id === sent.id,
    )
  )
    return { disposition: "responded", task_id: task.id };
  const due = task.not_before ? Date.parse(task.not_before) : NaN;
  if (!Number.isFinite(due))
    throw new Error("Authoritative wait time is required");
  return {
    disposition: due > clock ? "waiting" : "candidate_review",
    task_id: task.id,
    // Even when due, only reconciliation may surface a human action. Never
    // automatically draft/send follow-up or infer that a message was sent.
    command: "reconcile_follow_up",
  };
}
