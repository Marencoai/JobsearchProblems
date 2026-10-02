import type { Json } from "./database.types";
export type Contact = {
  id: string;
  workspace_id: string;
  company_id: string | null;
  full_name: string;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  phone: string | null;
  location_text: string | null;
  relationship_type: string | null;
  relationship_context: string | null;
  source_system: string;
  source_reference: string | null;
  status: string;
  revision: number;
};
export type OpportunityContact = {
  id: string;
  workspace_id: string;
  opportunity_id: string;
  contact_id: string;
  relationship_role: string;
  is_primary: boolean;
  selection_method: string;
  relevance: string;
  source_system: string;
  source_reference: string | null;
  notes: string | null;
};
export type Engagement = {
  id: string;
  workspace_id: string;
  contact_id: string;
  company_id: string | null;
  goal: string | null;
  relationship_context: string | null;
  relationship_state: string;
  outreach_state: string;
  status: string;
  revision: number;
  last_meaningful_interaction_at: string | null;
  next_follow_up_at: string | null;
};
export type EngagementOpportunity = {
  id: string;
  workspace_id: string;
  outreach_engagement_id: string;
  opportunity_id: string;
  relationship_type: string | null;
  is_current: boolean;
};
export type OutreachMessage = {
  id: string;
  workspace_id: string;
  outreach_engagement_id: string;
  contact_id: string;
  opportunity_id: string | null;
  draft_series_id: string;
  version_number: number;
  supersedes_message_id: string | null;
  channel: string;
  direction: string;
  purpose: string | null;
  subject: string | null;
  content: string;
  message_status: string;
  approval_status: string | null;
  prepared_by_principal_id: string | null;
  approved_by_principal_id: string | null;
  sent_by_principal_id: string | null;
  sent_at: string | null;
  received_at: string | null;
  created_at: string;
  response_to_message_id: string | null;
  external_reference: string | null;
  recipient_snapshot: Json | null;
  opportunity_snapshot: Json | null;
};
export type OutreachEvidence = {
  id: string;
  workspace_id: string;
  outreach_message_id: string;
  evidence_story_id: string | null;
  project_id: string | null;
  skill_id: string | null;
  usage_context: string;
};
export type OutreachInteraction = {
  id: string;
  workspace_id: string;
  outreach_engagement_id: string;
  contact_id: string;
  opportunity_id: string | null;
  interaction_type: string;
  summary: string;
  occurred_at: string;
  source_system: string;
  source_reference: string | null;
};
export type RelationshipNote = {
  id: string;
  workspace_id: string;
  contact_id: string;
  outreach_engagement_id: string | null;
  note_type: string;
  note_text: string;
  validation_status: string;
  created_at: string;
};
export type OutreachTaskLink = {
  id: string;
  workspace_id: string;
  internal_task_id: string;
  outreach_engagement_id: string;
  outreach_message_id: string | null;
  purpose: string;
};
export type OutreachData = {
  contacts: Contact[];
  opportunityContacts: OpportunityContact[];
  engagements: Engagement[];
  engagementOpportunities: EngagementOpportunity[];
  messages: OutreachMessage[];
  messageEvidence: OutreachEvidence[];
  interactions: OutreachInteraction[];
  notes: RelationshipNote[];
  taskLinks: OutreachTaskLink[];
};
export const emptyOutreach = (): OutreachData => ({
  contacts: [],
  opportunityContacts: [],
  engagements: [],
  engagementOpportunities: [],
  messages: [],
  messageEvidence: [],
  interactions: [],
  notes: [],
  taskLinks: [],
});
