import type {
  Action,
  Activity,
  JobView,
  Opportunity,
  Package,
  Stage,
  Task,
  WorkspaceData,
} from "./types";

export function actionStage(
  action: Action,
  tasks: Task[],
  activities: Activity[] = [],
): Stage | undefined {
  const source = activities.find(
    (a) =>
      a.id === action.source_activity_event_id &&
      a.opportunity_id === action.opportunity_id &&
      a.source_system === "hq",
  );
  if (source?.event_type.startsWith("interview_")) return "Interview";
  const task = tasks.find((t) => t.id === action.internal_task_id);
  if (task?.domain === "interview") return "Interview";
  if (task?.domain === "outreach") return "Outreach";
  if (action.action_type === "apply") return "Application";
  if (task?.domain === "application")
    return action.action_type === "decide" ? "Pursue" : "Resume";
  if (action.action_type === "decide" || task?.domain === "evaluation")
    return "Evaluate";
}
function actionOrder(a: Action, b: Action): number {
  return (
    b.priority - a.priority ||
    (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999") ||
    a.id.localeCompare(b.id)
  );
}
export function deriveStage(
  opportunity: Opportunity,
  actions: Action[],
  tasks: Task[],
  pkg?: Package,
  now = new Date(),
  activities: Activity[] = [],
): { stage: Stage | null; action?: Action; nextAction: string } {
  if (
    opportunity.opportunity_stage === "closed" ||
    !opportunity.is_currently_active
  ) {
    return {
      stage: null,
      nextAction:
        opportunity.closed_reason?.replaceAll("_", " ") ?? "No longer active",
    };
  }
  const open = actions
    .filter(
      (a) =>
        a.opportunity_id === opportunity.id &&
        a.status === "open" &&
        (!a.available_after ||
          new Date(a.available_after).getTime() <= now.getTime()),
    )
    .sort(actionOrder);
  const interviewAction = open.find(
    (a) => actionStage(a, tasks, activities) === "Interview",
  );
  if (opportunity.opportunity_stage === "offer")
    return {
      stage: "Offer",
      action: open[0],
      nextAction: open[0]?.title ?? "Review the offer",
    };
  if (opportunity.opportunity_stage === "interviewing" || interviewAction)
    return {
      stage: "Interview",
      action: interviewAction ?? open[0],
      nextAction: interviewAction?.title ?? "Review interview updates",
    };
  const active = open.find((a) => actionStage(a, tasks, activities));
  if (active)
    return {
      stage: actionStage(active, tasks, activities)!,
      action: active,
      nextAction: active.title,
    };
  if (pkg?.status === "approved")
    return { stage: "Application", nextAction: "Review application status" };
  if (pkg?.status === "ready_for_review")
    return { stage: "Resume", nextAction: "Review your application package" };
  if (opportunity.opportunity_stage === "pursuing")
    return { stage: "Pursue", nextAction: "Preparation is underway" };
  const deferred = actions
    .filter(
      (a) =>
        a.opportunity_id === opportunity.id &&
        a.status === "open" &&
        a.available_after &&
        new Date(a.available_after) > now,
    )
    .sort((a, b) => a.available_after!.localeCompare(b.available_after!))[0];
  return {
    stage: "Evaluate",
    nextAction: deferred
      ? "Saved for later · review " +
        new Date(deferred.available_after!).toLocaleDateString()
      : "Review fit and decide",
  };
}
export function buildJobViews(data: WorkspaceData): JobView[] {
  return data.opportunities
    .map((opportunity) => {
      const evaluation = data.evaluations
        .filter(
          (e) =>
            e.opportunity_id === opportunity.id &&
            e.evaluation_status === "complete",
        )
        .sort((a, b) => b.version_number - a.version_number)[0];
      const packages = data.packages
        .filter((p) => p.opportunity_id === opportunity.id)
        .sort((a, b) => b.package_number - a.package_number);
      const pkg = packages.find((p) => p.status !== "archived");
      const applications = data.applications
        .filter((a) => a.opportunity_id === opportunity.id)
        .sort((a, b) => b.attempt_number - a.attempt_number);
      const workflow = deriveStage(
        opportunity,
        data.actions,
        data.tasks,
        pkg,
        new Date(),
        data.activities,
      );
      const application = applications[0];
      // Submission alone does not invent outreach work. The approved Application view
      // remains inspectable until a real outreach/interview/offer action is present.
      if (
        workflow.stage === "Application" &&
        application &&
        ["submitted", "confirmed"].includes(application.application_stage) &&
        !workflow.action
      ) {
        workflow.nextAction =
          application.application_stage === "confirmed"
            ? "Application confirmed · awaiting an update"
            : "Application submitted · awaiting confirmation";
      }
      if (workflow.stage === "Evaluate" && !evaluation)
        workflow.nextAction = "Evaluation is pending";
      return {
        // An unlinked approval is surfaced with its title for explicit human
        // reconciliation; it does not independently invent a Resume stage.
        reviewAction: data.actions
          .filter(
            (a) =>
              a.opportunity_id === opportunity.id &&
              a.status === "open" &&
              (a.action_type === "approve" || a.action_type === "review") &&
              ((!a.internal_task_id && a.action_type === "approve") ||
                data.tasks.some(
                  (t) =>
                    t.id === a.internal_task_id && t.domain === "application",
                )),
          )
          .sort(actionOrder)[0],
        opportunity,
        researchTasks: data.tasks.filter(
          (t) =>
            t.opportunity_id === opportunity.id &&
            t.domain === "company_intelligence",
        ),
        company: data.companies.find((c) => c.id === opportunity.company_id),
        evaluation,
        package: pkg,
        packages,
        application,
        ...workflow,
        evidence: data.evidence.filter(
          (e) => e.evaluation_id === evaluation?.id,
        ),
        gaps: data.gaps.filter((g) => g.evaluation_id === evaluation?.id),
        intelligence: data.intelligence.filter(
          (i) => i.company_id === opportunity.company_id && i.is_active,
        ),
        evaluationIntelligence: data.evaluationIntelligence.filter(
          (i) => i.evaluation_id === evaluation?.id,
        ),
        sources: data.sources.filter(
          (s) => s.opportunity_id === opportunity.id,
        ),
        materials: data.materials
          .filter((m) =>
            data.packages.some(
              (p) =>
                p.opportunity_id === opportunity.id &&
                p.id === m.application_package_id,
            ),
          )
          .sort((a, b) => b.version_number - a.version_number),
        applications,
        submittedMaterials: data.submittedMaterials.filter((m) =>
          applications.some((a) => a.id === m.application_id),
        ),
        activities: data.activities
          .filter(
            (a) =>
              a.opportunity_id === opportunity.id ||
              data.activityLinks.some(
                (link) =>
                  link.activity_event_id === a.id &&
                  link.entity_type === "opportunity" &&
                  link.entity_id === opportunity.id,
              ),
          )
          .sort((a, b) => b.event_timestamp.localeCompare(a.event_timestamp)),
      };
    })
    .sort((a, b) =>
      b.opportunity.first_discovered_at.localeCompare(
        a.opportunity.first_discovered_at,
      ),
    );
}
