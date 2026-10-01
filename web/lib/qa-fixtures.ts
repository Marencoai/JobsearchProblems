// Synthetic UI fixtures only. This module is never a fallback for live data.
import type {
  Action,
  Evaluation,
  Identity,
  Opportunity,
  Package,
  Task,
  WorkspaceData,
} from "./types";
export const fixtureIdentity: Identity = {
  principal: {
    id: "fixture-human",
    name: "Diana Marenco",
    auth_user_id: "fixture-auth",
    principal_type: "human",
    status: "active",
  },
  email: "fixture@example.invalid",
  memberships: [
    {
      id: "fixture-membership",
      workspace_id: "fixture-workspace",
      role_id: "fixture-owner",
      status: "active",
    },
  ],
  workspaces: [
    {
      id: "fixture-workspace",
      name: "Visual QA · Synthetic workspace",
      status: "active",
    },
  ],
  roles: [{ id: "fixture-owner", name: "Owner" }],
};
export function opportunity(
  id = "evaluate",
  changes: Partial<Opportunity> = {},
): Opportunity {
  return {
    id,
    workspace_id: "fixture-workspace",
    company_id: "fixture-company",
    title: "Senior Director, Revenue Operations",
    normalized_title: null,
    canonical_url: "https://example.invalid/careers/fixture",
    requisition_id: "QA-001",
    location_text: "San Francisco, CA",
    employment_type: "full_time",
    work_arrangement: "hybrid",
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    salary_period: null,
    job_family_id: null,
    posting_date: "2026-09-27",
    closing_date: null,
    first_discovered_at: "2026-09-27T12:00:00Z",
    last_verified_at: "2026-10-01T12:00:00Z",
    is_currently_active: true,
    opportunity_stage: "evaluating",
    closed_reason: null,
    previous_opportunity_id: null,
    job_description_text:
      "Synthetic job description for visual QA. Lead revenue operations, align sales and marketing systems, and improve operating efficiency.",
    created_at: "2026-09-27T12:00:00Z",
    updated_at: "2026-10-01T12:00:00Z",
    created_by_principal_id: null,
    updated_by_principal_id: null,
    ...changes,
  };
}
export function evaluation(
  id = "evaluation",
  changes: Partial<Evaluation> = {},
): Evaluation {
  return {
    id,
    workspace_id: "fixture-workspace",
    opportunity_id: "evaluate",
    version_number: 1,
    evaluation_status: "complete",
    evaluation_method_version: "fixture",
    candidate_fit_score: 89,
    opportunity_fit_score: 76,
    pursuit_score: 82,
    opportunity_type: "core",
    evidence_confidence: "high",
    problem_translation:
      "The company is looking for a senior leader to build and scale Revenue Operations, connecting sales, marketing, and customer success. This role will drive data-informed decisions, improve operational efficiency, and partner closely with leadership to support continued growth.",
    problem_fit_summary:
      "• A strategic operator who can unify revenue operations across functions\n• Deep experience with CRM and revenue systems\n• Experience scaling processes in growing environments\n• Strong cross-functional leadership and change management\n• Comfort working with technical teams and data",
    company_fit_summary:
      "A growing technology business with a collaborative operating culture.",
    career_optionality_summary:
      "An opportunity to build executive scope while applying operational and AI experience.",
    strengths_summary:
      "• Mission and product align with your interests\n• High-impact role with broad scope\n• Opportunity to apply your operations and AI experience\n• Strong company momentum",
    tradeoffs_summary:
      "• Highly competitive role\n• Fast-paced, high expectations\n• San Francisco location (hybrid)\n• Complex stakeholder dynamics",
    unresolved_questions:
      "Confirm team size, reporting line, and the scope of decision-making authority.",
    recommended_next_action: "decide_pursuit",
    required_decision_authority: "human",
    opportunity_snapshot: {},
    evaluated_at: "2026-10-01T12:00:00Z",
    created_at: "2026-10-01T12:00:00Z",
    updated_at: "2026-10-01T12:00:00Z",
    created_by_principal_id: null,
    updated_by_principal_id: null,
    ...changes,
  };
}
export function action(id = "decide", changes: Partial<Action> = {}): Action {
  return {
    id,
    opportunity_id: "evaluate",
    internal_task_id: null,
    source_activity_event_id: null,
    assigned_to_principal_id: "fixture-human",
    action_type: "decide",
    title: "Decide to pursue or pass",
    context_summary: null,
    priority: 70,
    due_at: null,
    status: "open",
    ...changes,
  };
}
export function task(id = "task", changes: Partial<Task> = {}): Task {
  return {
    id,
    opportunity_id: "evaluate",
    task_type: "evaluate_opportunity",
    domain: "evaluation",
    status: "succeeded",
    trigger_type: "manual",
    trigger_reference: null,
    ...changes,
  };
}
export function applicationPackage(
  id = "package",
  changes: Partial<Package> = {},
): Package {
  return {
    id,
    opportunity_id: "resume",
    workspace_id: "fixture-workspace",
    package_number: 1,
    status: "ready_for_review",
    application_template_id: null,
    evaluation_id: null,
    candidate_notes: null,
    prepared_by_principal_id: null,
    approved_by_principal_id: null,
    approved_at: null,
    created_at: "2026-10-01T12:00:00Z",
    updated_at: "2026-10-01T12:00:00Z",
    created_by_principal_id: null,
    updated_by_principal_id: null,
    ...changes,
  };
}
export function emptyData(changes: Partial<WorkspaceData> = {}): WorkspaceData {
  return {
    opportunities: [],
    companies: [],
    evaluations: [],
    evidence: [],
    gaps: [],
    intelligence: [],
    evaluationIntelligence: [],
    sources: [],
    packages: [],
    materials: [],
    applications: [],
    submittedMaterials: [],
    actions: [],
    tasks: [],
    activities: [],
    activityLinks: [],
    ...changes,
  };
}
export function visualFixture(): WorkspaceData {
  return emptyData({
    opportunities: [
      opportunity(),
      opportunity("evaluate-2", { title: "Business Systems Architect" }),
      opportunity("evaluate-3", { title: "Go-to-Market Operations Lead" }),
      opportunity("pursue", {
        title: "Director of Business Operations",
        opportunity_stage: "pursuing",
      }),
      opportunity("resume", {
        title: "Head of Revenue Systems",
        opportunity_stage: "pursuing",
      }),
      opportunity("application", {
        title: "VP, Operational Excellence",
        opportunity_stage: "pursuing",
      }),
      opportunity("outreach", {
        title: "Strategy & Operations Lead",
        opportunity_stage: "pursuing",
      }),
      opportunity("interview", {
        title: "Director, Transformation",
        opportunity_stage: "interviewing",
      }),
      opportunity("offer", {
        title: "Chief of Staff",
        opportunity_stage: "offer",
      }),
      opportunity("closed", {
        title: "Historical Operations Role",
        opportunity_stage: "closed",
        is_currently_active: false,
        closed_reason: "passed",
      }),
    ],
    companies: [
      {
        id: "fixture-company",
        name: "Northstar AI",
        industry: "Technology · Artificial Intelligence",
        company_size: "1,001–5,000",
        headquarters_location: "San Francisco, CA",
        website_url: "https://example.invalid",
        careers_url: null,
      },
    ],
    evaluations: [
      evaluation(),
      evaluation("evaluation-resume", {
        opportunity_id: "resume",
        candidate_fit_score: null,
        opportunity_fit_score: 0,
      }),
    ],
    evidence: [
      {
        id: "evidence",
        workspace_id: "fixture-workspace",
        evaluation_id: "evaluation",
        evidence_role: "strength",
        evidence_snapshot: { title: "Revenue systems transformation" },
        evidence_story_id: null,
        project_id: null,
        skill_id: null,
        relevance_summary:
          "Led a cross-functional systems improvement program.",
        confidence_level: "high",
        created_at: "2026-10-01T12:00:00Z",
        created_by_principal_id: null,
      },
    ],
    gaps: [
      {
        id: "gap",
        workspace_id: "fixture-workspace",
        opportunity_id: "evaluate",
        evaluation_id: "evaluation",
        gap_type: "information",
        severity: "medium",
        blocking_status: "non_blocking",
        description: "Confirm the required leadership scope.",
        resolution_status: "open",
        resolution_type: null,
        resolution_notes: null,
        resolved_at: null,
        skill_id: null,
        created_at: "2026-10-01T12:00:00Z",
        updated_at: "2026-10-01T12:00:00Z",
        created_by_principal_id: null,
        updated_by_principal_id: null,
      },
    ],
    intelligence: [
      {
        id: "intel",
        workspace_id: "fixture-workspace",
        company_id: "fixture-company",
        intelligence_type: "company_signal",
        title: "Expanded enterprise team",
        summary:
          "Synthetic research fixture: the company is investing in its enterprise operations.",
        source_name: "Fixture company announcement",
        source_url: "https://example.invalid/news",
        evidence_type: "reported",
        confidence_level: "medium",
        researched_at: "2026-10-01T12:00:00Z",
        published_at: "2026-09-30T12:00:00Z",
        expires_at: null,
        is_active: true,
        created_at: "2026-10-01T12:00:00Z",
        updated_at: "2026-10-01T12:00:00Z",
        created_by_principal_id: null,
        updated_by_principal_id: null,
      },
    ],
    packages: [
      applicationPackage(),
      applicationPackage("package-approved", {
        opportunity_id: "application",
        status: "approved",
        approved_at: "2026-10-01T12:00:00Z",
      }),
    ],
    materials: [
      {
        id: "resume-material",
        workspace_id: "fixture-workspace",
        application_package_id: "package",
        material_type: "resume",
        version_number: 1,
        status: "draft",
        content_text:
          "SYNTHETIC QA RESUME\n\nDiana Marenco\nOperations leadership\n\nThis is a UI fixture, not candidate content.",
        file_url: null,
        storage_path: null,
        is_current_package_version: true,
        source_template_id: null,
        created_at: "2026-10-01T12:00:00Z",
        updated_at: "2026-10-01T12:00:00Z",
        created_by_principal_id: null,
        updated_by_principal_id: null,
      },
    ],
    applications: [
      {
        id: "fixture-application",
        workspace_id: "fixture-workspace",
        opportunity_id: "application",
        application_package_id: "package-approved",
        attempt_number: 1,
        application_stage: "confirmed",
        application_url: "https://example.invalid/application",
        approved_by_principal_id: null,
        submitted_by_principal_id: null,
        submitted_at: "2026-10-01T12:00:00Z",
        confirmed_at: "2026-10-01T12:00:00Z",
        submission_method: "manual",
        confirmation_type: "email",
        confirmation_reference: "Synthetic confirmation",
        notes: null,
        created_at: "2026-10-01T12:00:00Z",
        updated_at: "2026-10-01T12:00:00Z",
        created_by_principal_id: null,
        updated_by_principal_id: null,
      },
    ],
    submittedMaterials: [
      {
        id: "fixture-snapshot",
        workspace_id: "fixture-workspace",
        application_id: "fixture-application",
        application_material_id: "fixture-submitted-material",
        material_type: "resume",
        submitted_at: "2026-10-01T12:00:00Z",
        submitted_material_snapshot: {
          content_text: "Exact synthetic submitted resume snapshot.",
        },
        created_at: "2026-10-01T12:00:00Z",
        created_by_principal_id: null,
      },
    ],
    actions: [
      action(),
      action("outreach-action", {
        opportunity_id: "outreach",
        internal_task_id: "outreach-task",
        action_type: "send",
        title: "Review a follow-up",
        priority: 80,
      }),
    ],
    tasks: [
      task("outreach-task", {
        opportunity_id: "outreach",
        domain: "outreach",
        task_type: "prepare_outreach",
      }),
    ],
  });
}
