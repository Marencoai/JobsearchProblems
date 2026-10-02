// Pure request boundary. Existing research workflow performs permitted writes;
// completed Evaluation snapshots and pursuit authority are never rewritten.
export function researchRefreshTarget(
  task: {
    workspace_id: string;
    opportunity_id: string;
    task_type: string;
    domain: string;
    trigger_type: string;
    trigger_reference: string;
    source_activity_event_id: string;
    description: string;
  },
  event: {
    id: string;
    workspace_id: string;
    opportunity_id: string;
    event_type: string;
  },
  opportunity: {
    id: string;
    workspace_id: string;
    company_id: string;
    is_currently_active: boolean;
    opportunity_stage: string;
  },
) {
  const d = JSON.parse(task.description);
  if (
    task.task_type !== "refresh_company_intelligence" ||
    task.domain !== "company_intelligence" ||
    task.trigger_type !== "candidate_action" ||
    task.trigger_reference !== "candidate_requested_research_refresh" ||
    event.event_type !== "research_refresh_requested" ||
    task.source_activity_event_id !== event.id ||
    task.workspace_id !== event.workspace_id ||
    task.workspace_id !== opportunity.workspace_id ||
    task.opportunity_id !== event.opportunity_id ||
    task.opportunity_id !== opportunity.id ||
    d.contract_version !== 1 ||
    d.workspace_id !== task.workspace_id ||
    d.opportunity_id !== opportunity.id ||
    d.company_id !== opportunity.company_id ||
    d.activity_event_id !== event.id ||
    d.preserve_completed_evaluations !== true ||
    d.authorizes_preparation !== false ||
    !opportunity.is_currently_active ||
    opportunity.opportunity_stage === "closed"
  )
    throw new Error("Research request target/authority mismatch");
  return {
    workspace_id: opportunity.workspace_id,
    opportunity_id: opportunity.id,
    company_id: opportunity.company_id,
    preserve_completed_evaluations: true,
    authorizes_preparation: false,
  };
}
