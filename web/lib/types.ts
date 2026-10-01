import type { Database } from "./database.types";
export type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Principal = Pick<
  Row<"principals">,
  "id" | "name" | "auth_user_id" | "principal_type" | "status"
>;
export type Membership = Pick<
  Row<"workspace_memberships">,
  "id" | "workspace_id" | "role_id" | "status"
>;
export type Workspace = Pick<Row<"workspaces">, "id" | "name" | "status">;
export type Role = Pick<Row<"roles">, "id" | "name">;
export type Opportunity = Row<"opportunities">;
export type Company = Pick<
  Row<"companies">,
  | "id"
  | "name"
  | "website_url"
  | "careers_url"
  | "industry"
  | "company_size"
  | "headquarters_location"
>;
export type Evaluation = Row<"evaluations">;
export type Evidence = Row<"evaluation_evidence">;
export type Gap = Row<"application_gaps">;
export type Intelligence = Row<"company_intelligence">;
export type EvaluationIntelligence = Row<"evaluation_company_intelligence">;
export type Source = Row<"opportunity_sources">;
export type Package = Row<"application_packages">;
export type Material = Row<"application_materials">;
export type MaterialArtifact = {
  id: string;
  workspace_id: string;
  application_material_id: string;
  format: "pdf" | "docx";
  bucket_id: "hq-materials";
  storage_path: string;
  sha256: string;
  byte_size: number;
  renderer_key: string;
  input_sha256: string;
  source_docx_sha256: string;
  qa: {
    visual_pass: boolean;
    parse_back_pass: boolean;
    page_count: number;
    renderer_key: string;
    input_sha256: string;
    docx_sha256: string;
    pdf_sha256: string;
  };
  created_at: string;
  created_by_principal_id: string;
};
export type Application = Row<"applications">;
export type SubmittedMaterial = Row<"application_submitted_materials">;
export type Action = Pick<
  Row<"next_actions">,
  | "id"
  | "opportunity_id"
  | "internal_task_id"
  | "source_activity_event_id"
  | "assigned_to_principal_id"
  | "action_type"
  | "title"
  | "context_summary"
  | "priority"
  | "due_at"
  | "status"
> & { updated_at?: string; available_after?: string | null };
export type Task = Pick<
  Row<"internal_tasks">,
  | "id"
  | "opportunity_id"
  | "task_type"
  | "domain"
  | "status"
  | "trigger_type"
  | "trigger_reference"
> & {
  source_activity_event_id?: string | null;
  result_summary?: string | null;
  created_at?: string;
};
export type Activity = Pick<
  Row<"activity_events">,
  | "id"
  | "opportunity_id"
  | "event_type"
  | "event_timestamp"
  | "summary"
  | "source_system"
>;
export type ActivityLink = Pick<
  Row<"activity_event_links">,
  "activity_event_id" | "entity_type" | "entity_id"
>;
export type Identity = {
  principal: Principal;
  email: string;
  memberships: Membership[];
  workspaces: Workspace[];
  roles: Role[];
};
export type WorkspaceData = {
  opportunities: Opportunity[];
  companies: Company[];
  evaluations: Evaluation[];
  evidence: Evidence[];
  gaps: Gap[];
  intelligence: Intelligence[];
  evaluationIntelligence: EvaluationIntelligence[];
  sources: Source[];
  packages: Package[];
  materials: Material[];
  artifacts?: MaterialArtifact[];
  applications: Application[];
  submittedMaterials: SubmittedMaterial[];
  actions: Action[];
  tasks: Task[];
  activities: Activity[];
  activityLinks: ActivityLink[];
};
export const STAGES = [
  "Evaluate",
  "Pursue",
  "Resume",
  "Application",
  "Outreach",
  "Interview",
  "Offer",
] as const;
export type Stage = (typeof STAGES)[number];
export type JobView = {
  reviewAction?: Action;
  opportunity: Opportunity;
  company?: Company;
  evaluation?: Evaluation;
  package?: Package;
  packages: Package[];
  application?: Application;
  stage: Stage | null;
  nextAction: string;
  action?: Action;
  evidence: Evidence[];
  gaps: Gap[];
  intelligence: Intelligence[];
  evaluationIntelligence: EvaluationIntelligence[];
  sources: Source[];
  materials: Material[];
  artifacts?: MaterialArtifact[];
  applications: Application[];
  submittedMaterials: SubmittedMaterial[];
  activities: Activity[];
};
