import {
  emptyOutreach,
  type Contact,
  type Engagement,
  type OutreachData,
  type OutreachMessage,
} from "./outreach-types";
import type { OutreachCommand, OutreachPayload } from "./outreach";
import type { Json } from "./database.types";
const workspace = "fixture-workspace",
  timestamp = "2026-10-01T12:00:00Z";
export function outreachFixture(): OutreachData {
  const data = emptyOutreach();
  data.contacts = [
    contact(
      "alex",
      "Alex Rivera",
      "Director, Revenue Operations",
      "alex.rivera@example.invalid",
    ),
    contact("sam", "Sam Chen", "Talent Partner", "sam.chen@example.invalid"),
    contact(
      "morgan",
      "Morgan Blake",
      "Revenue Strategy Lead",
      "morgan.blake@example.invalid",
    ),
  ];
  data.opportunityContacts = [
    {
      id: "alex-role",
      workspace_id: workspace,
      opportunity_id: "outreach",
      contact_id: "alex",
      relationship_role: "outreach_target",
      is_primary: true,
      selection_method: "recommended",
      relevance:
        "Leads the team this role would partner with. A thoughtful conversation could clarify the team's priorities.",
      source_system: "company_careers",
      source_reference: "https://example.invalid/team",
      notes: null,
    },
    {
      id: "sam-role",
      workspace_id: workspace,
      opportunity_id: "outreach",
      contact_id: "sam",
      relationship_role: "outreach_target",
      is_primary: false,
      selection_method: "recommended",
      relevance:
        "Supports leadership hiring. A useful alternative for understanding the process and role scope.",
      source_system: "verified_profile",
      source_reference: null,
      notes: null,
    },
  ];
  data.engagements = [engagement("alex-relationship", "alex")];
  data.engagementOpportunities = [
    {
      id: "alex-role-link",
      workspace_id: workspace,
      outreach_engagement_id: "alex-relationship",
      opportunity_id: "outreach",
      relationship_type: "outreach_target",
      is_current: true,
    },
    {
      id: "alex-second-role",
      workspace_id: workspace,
      outreach_engagement_id: "alex-relationship",
      opportunity_id: "pursue",
      relationship_type: "related_role",
      is_current: true,
    },
  ];
  data.messages = [
    message("alex-v1", "alex-relationship", "alex", "outreach", {
      message_status: "archived",
      content: "Hi Alex, I'd love to learn more about your team's work.",
    }),
    message("alex-v2", "alex-relationship", "alex", "outreach", {
      draft_series_id: "alex-v1",
      version_number: 2,
      supersedes_message_id: "alex-v1",
      created_at: "2026-10-01T13:00:00Z",
      content:
        "Hi Alex, I’m exploring the Revenue Operations opportunity and was interested in how your team connects strategy with execution.\n\nMy work has focused on building clearer operating systems across sales, finance, and customer teams. I’d value your perspective on the team’s priorities and what success in this role could look like.\n\nWould you be open to a brief conversation?\n\nThank you,\nDiana",
    }),
  ];
  data.messageEvidence = [
    {
      id: "example-evidence",
      workspace_id: workspace,
      outreach_message_id: "alex-v2",
      evidence_story_id: "synthetic-story",
      project_id: null,
      skill_id: null,
      usage_context:
        "Cross-functional operating systems — synthetic example for review.",
    },
  ];
  data.notes = [
    {
      id: "alex-note",
      workspace_id: workspace,
      contact_id: "alex",
      outreach_engagement_id: "alex-relationship",
      note_type: "professional_context",
      note_text:
        "Appears to care about practical, measurable improvements. Verify this in a conversation.",
      validation_status: "inferred",
      created_at: timestamp,
    },
  ];
  return data;
}
function contact(
  id: string,
  full_name: string,
  title: string,
  email: string | null,
): Contact {
  return {
    id,
    workspace_id: workspace,
    company_id: "fixture-company",
    full_name,
    title,
    email,
    linkedin_url: `https://www.linkedin.com/in/synthetic-${id}`,
    phone: null,
    location_text: null,
    relationship_type: null,
    relationship_context: null,
    source_system: "synthetic",
    source_reference: null,
    status: "active",
    revision: 1,
  };
}
function engagement(id: string, contact_id: string): Engagement {
  return {
    id,
    workspace_id: workspace,
    contact_id,
    company_id: "fixture-company",
    goal: "Explore a relevant opportunity",
    relationship_context: null,
    relationship_state: "cold",
    outreach_state: "message_ready",
    status: "active",
    revision: 1,
    last_meaningful_interaction_at: null,
    next_follow_up_at: null,
  };
}
function message(
  id: string,
  outreach_engagement_id: string,
  contact_id: string,
  opportunity_id: string | null,
  values: Partial<OutreachMessage> = {},
): OutreachMessage {
  return {
    id,
    workspace_id: workspace,
    outreach_engagement_id,
    contact_id,
    opportunity_id,
    draft_series_id: id,
    version_number: 1,
    supersedes_message_id: null,
    channel: "linkedin",
    direction: "outbound",
    purpose: "opportunity_outreach",
    subject: null,
    content: "",
    message_status: "review",
    approval_status: "pending",
    prepared_by_principal_id: "fixture-human",
    approved_by_principal_id: null,
    sent_by_principal_id: null,
    sent_at: null,
    received_at: null,
    created_at: timestamp,
    response_to_message_id: null,
    external_reference: null,
    recipient_snapshot: null,
    opportunity_snapshot: null,
    ...values,
  };
}

// Development-only browser state. This adapter has no client/network/worker.
// The real transitions and RLS are validated independently by SQL/SDK tests.
export function applyOutreachFixture(
  input: OutreachData,
  command: OutreachCommand,
  payload: OutreachPayload,
  id: string,
): { data: OutreachData; result: Json } {
  const data = structuredClone(input),
    text = (k: string) =>
      typeof payload[k] === "string" ? (payload[k] as string) : "";
  let result: Json = {};
  let work = data.engagements.find((e) => e.id === payload.engagement_id);
  if (command === "add_manual_target") {
    const person = contact(
      id,
      text("full_name"),
      text("title"),
      text("email") || null,
    );
    person.linkedin_url = text("linkedin_url") || null;
    data.contacts.push(person);
    data.opportunityContacts.push({
      id: id + "-role",
      workspace_id: workspace,
      opportunity_id: text("opportunity_id"),
      contact_id: id,
      relationship_role: "outreach_target",
      is_primary: false,
      selection_method: "manual",
      relevance: text("reason"),
      source_system: "candidate",
      source_reference: null,
      notes: null,
    });
    work = engagement(id + "-engagement", id);
    data.engagements.push(work);
    data.engagementOpportunities.push({
      id: id + "-link",
      workspace_id: workspace,
      outreach_engagement_id: work.id,
      opportunity_id: text("opportunity_id"),
      relationship_type: "outreach_target",
      is_current: true,
    });
    result = { contact_id: id, engagement_id: work.id };
  } else if (command === "save_contact") {
    const person = contact(
      id,
      text("full_name"),
      text("title"),
      text("email") || null,
    );
    person.linkedin_url = text("linkedin_url") || null;
    person.relationship_context = text("relationship_context") || null;
    data.contacts.push(person);
    result = { contact_id: id };
  } else if (command === "create_engagement") {
    work = engagement(id, text("contact_id"));
    data.engagements.push(work);
    result = { engagement_id: id };
  } else if (command === "select_primary_contact") {
    data.opportunityContacts
      .filter(
        (l) =>
          l.opportunity_id === payload.opportunity_id &&
          l.relationship_role === payload.relationship_role,
      )
      .forEach((l) => (l.is_primary = l.contact_id === payload.contact_id));
    result = { contact_id: text("contact_id") };
  } else if (command === "link_contact") {
    data.opportunityContacts.push({
      id,
      workspace_id: workspace,
      opportunity_id: text("opportunity_id"),
      contact_id: text("contact_id"),
      relationship_role: "outreach_target",
      is_primary: false,
      selection_method: "manual",
      relevance: text("relevance"),
      source_system: "candidate",
      source_reference: null,
      notes: null,
    });
    result = { opportunity_contact_id: id, contact_id: text("contact_id") };
  } else if (command === "start_engagement") {
    work = data.engagements.find(
      (e) =>
        e.contact_id === payload.contact_id &&
        e.status === "active" &&
        data.engagementOpportunities.some(
          (l) =>
            l.outreach_engagement_id === e.id &&
            l.opportunity_id === payload.opportunity_id &&
            l.is_current,
        ),
    );
    if (!work) {
      work = engagement(id, text("contact_id"));
      data.engagements.push(work);
      data.engagementOpportunities.push({
        id: id + "-role",
        workspace_id: workspace,
        outreach_engagement_id: id,
        opportunity_id: text("opportunity_id"),
        relationship_type: "outreach_target",
        is_current: true,
      });
    }
    result = { engagement_id: work.id };
  } else if (command === "save_draft" && work) {
    const old = data.messages.find((m) => m.id === payload.message_id);
    if (old) old.message_status = "archived";
    data.messages.push(
      message(id, work.id, work.contact_id, text("opportunity_id") || null, {
        channel: text("channel"),
        subject: text("subject") || null,
        content: text("content"),
        draft_series_id: old?.draft_series_id ?? id,
        version_number: (old?.version_number ?? 0) + 1,
        supersedes_message_id: old?.id ?? null,
        created_at: new Date().toISOString(),
      }),
    );
    work.outreach_state = "message_ready";
    result = { message_id: id };
  } else if (command === "mark_sent" && work) {
    const m = data.messages.find((m) => m.id === payload.message_id);
    if (!m) throw new Error("Synthetic version unavailable");
    Object.assign(m, {
      message_status: "sent",
      approval_status: "approved",
      approved_by_principal_id: "fixture-human",
      sent_by_principal_id: "fixture-human",
      sent_at: text("sent_at"),
      recipient_snapshot: payload.recipient,
      opportunity_snapshot: {
        id: m.opportunity_id,
        title: "Synthetic Revenue Operations opportunity",
      },
    });
    work.next_follow_up_at = text("follow_up_at") || null;
    work.outreach_state = "waiting";
    result = { message_id: m.id };
  } else if (command === "request_draft") result = { task_id: id };
  else if (command === "add_note") {
    data.notes.push({
      id,
      workspace_id: workspace,
      contact_id: text("contact_id"),
      outreach_engagement_id: text("engagement_id") || null,
      note_type: "professional_context",
      note_text: text("note_text"),
      validation_status: text("validation_status"),
      created_at: new Date().toISOString(),
    });
    result = { note_id: id };
  } else if (command === "record_interaction" && work) {
    data.interactions.push({
      id,
      workspace_id: workspace,
      outreach_engagement_id: work.id,
      contact_id: work.contact_id,
      opportunity_id: text("opportunity_id") || null,
      interaction_type: text("interaction_type"),
      summary: text("summary"),
      occurred_at: text("occurred_at"),
      source_system: "candidate",
      source_reference: null,
    });
    result = { interaction_id: id };
  } else
    throw new Error("This action is unavailable in the synthetic preview.");
  if (work) work.revision++;
  return { data, result };
}
