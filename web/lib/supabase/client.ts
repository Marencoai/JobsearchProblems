import { INTERVIEW_TABLES } from "../interview";
import { OFFER_TABLES } from "../offer";
import type {
  Contact,
  OpportunityContact,
  Engagement,
  EngagementOpportunity,
  OutreachMessage,
  OutreachEvidence,
  OutreachInteraction,
  RelationshipNote,
  OutreachTaskLink,
} from "../outreach-types";
type ProposedTable<T> = {
  Row: T;
  Insert: never;
  Update: never;
  Relationships: [];
};
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MaterialArtifact } from "@/lib/types";
import type { Database, Json } from "@/lib/database.types";

// Draft RPC contract overlays live generated types until migration approval.
// Regenerate database.types.ts from the deployed project after that gate.
type HqDatabase = Database & {
  public: {
    Tables: {
      contacts: ProposedTable<Contact>;
      opportunity_contacts: ProposedTable<OpportunityContact>;
      outreach_engagements: ProposedTable<Engagement>;
      outreach_engagement_opportunities: ProposedTable<EngagementOpportunity>;
      outreach_messages: ProposedTable<OutreachMessage>;
      outreach_message_evidence: ProposedTable<OutreachEvidence>;
      outreach_interactions: ProposedTable<OutreachInteraction>;
      relationship_notes: ProposedTable<RelationshipNote>;
      outreach_task_links: ProposedTable<OutreachTaskLink>;

      application_material_artifacts: {
        Row: MaterialArtifact;
        Insert: MaterialArtifact;
        Update: never;
        Relationships: [];
      };
    };
    Functions: {
      hq_outreach_action: {
        Args: {
          target_workspace_id: string;
          request_id: string;
          command: string;
          payload: Json;
        };
        Returns: Json;
      };
      hq_request_research_refresh: {
        Args: {
          target_workspace_id: string;
          target_opportunity_id: string;
          expected_updated_at: string;
          request_id: string;
        };
        Returns: Json;
      };
      hq_request_job_intake: {
        Args: { target_workspace_id: string; request_id: string; input: Json };
        Returns: Json;
      };
      hq_human_action: {
        Args: {
          target_workspace_id: string;
          target_opportunity_id: string;
          expected_updated_at: string;
          request_id: string;
          command: string;
          payload: Json;
        };
        Returns: Json;
      };
    };
  };
};
export type HqClient = SupabaseClient<HqDatabase>;
export type PublicConfig = {
  url: string;
  key: string;
  humanActions?: boolean;
  outreach?: boolean;
  interview?: boolean;
  offer?: boolean;
  manualIntake?: boolean;
  materialDelivery?: boolean;
  researchRefresh?: boolean;
};
export const OUTREACH_READ_TABLES = new Set([
  "contacts",
  "opportunity_contacts",
  "outreach_engagements",
  "outreach_engagement_opportunities",
  "outreach_messages",
  "outreach_message_evidence",
  "outreach_interactions",
  "relationship_notes",
  "outreach_task_links",
]);
export const READ_TABLES = new Set([
  "principals",
  "workspace_memberships",
  "roles",
  "workspaces",
  "companies",
  "opportunities",
  "opportunity_sources",
  "company_intelligence",
  "evaluations",
  "evaluation_evidence",
  "evaluation_company_intelligence",
  "application_gaps",
  "application_packages",
  "application_materials",
  "applications",
  "application_submitted_materials",
  "next_actions",
  "internal_tasks",
  "activity_events",
  "activity_event_links",
]);
export function validConfig(config: PublicConfig): boolean {
  try {
    const url = new URL(config.url);
    return (
      url.origin === "https://xhhfnxswwspejdxjyvzz.supabase.co" &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      /^sb_publishable_[A-Za-z0-9_-]+$/.test(config.key)
    );
  } catch {
    return false;
  }
}
export function readOnlyFetch(
  origin: string,
  nativeFetch: typeof fetch,
  humanActions = false,
  capabilities: Omit<PublicConfig, "url" | "key"> = {},
): typeof fetch {
  const { interview = false, offer = false, outreach = false } = capabilities;
  return async (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const table = url.pathname.startsWith("/rest/v1/")
      ? url.pathname.slice("/rest/v1/".length)
      : "";
    const authRead = method === "GET" && url.pathname === "/auth/v1/user";
    const login =
      method === "POST" &&
      url.pathname === "/auth/v1/token" &&
      url.search === "?grant_type=password";
    const logout =
      method === "POST" &&
      url.pathname === "/auth/v1/logout" &&
      url.search === "?scope=local";
    const dataRead =
      method === "GET" &&
      (READ_TABLES.has(table) ||
        (interview && INTERVIEW_TABLES.includes(table)) ||
        (offer && OFFER_TABLES.includes(table)) ||
        (outreach && OUTREACH_READ_TABLES.has(table)) ||
        (capabilities.materialDelivery === true &&
          table === "application_material_artifacts"));
    const intakeRpc =
      capabilities.manualIntake === true &&
      method === "POST" &&
      url.pathname === "/rest/v1/rpc/hq_request_job_intake" &&
      !url.search;
    const researchRpc =
      capabilities.researchRefresh === true &&
      method === "POST" &&
      url.pathname === "/rest/v1/rpc/hq_request_research_refresh" &&
      !url.search;
    const intakePath =
      "hq-intake/[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9]{64}\\.(pdf|docx|png|jpg|txt)";
    const materialPath =
      "hq-materials/[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9]{64}\\.(pdf|docx)";
    const storageRead =
      method === "GET" &&
      !url.search &&
      ((capabilities.manualIntake === true &&
        new RegExp("^/storage/v1/object/" + intakePath + "$").test(
          url.pathname,
        )) ||
        (capabilities.materialDelivery === true &&
          new RegExp("^/storage/v1/object/" + materialPath + "$").test(
            url.pathname,
          )));
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    const intakeUpload =
      capabilities.manualIntake === true &&
      method === "POST" &&
      !url.search &&
      new RegExp("^/storage/v1/object/" + intakePath + "$").test(
        url.pathname,
      ) &&
      headers.get("x-upsert") !== "true";
    const domainRpc =
      method === "POST" &&
      !url.search &&
      ((interview && url.pathname === "/rest/v1/rpc/hq_interview_action") ||
        (offer && url.pathname === "/rest/v1/rpc/hq_offer_action") ||
        (outreach && url.pathname === "/rest/v1/rpc/hq_outreach_action"));
    const humanRpc =
      humanActions &&
      method === "POST" &&
      url.pathname === "/rest/v1/rpc/hq_human_action" &&
      !url.search;
    if (
      url.origin !== origin ||
      url.username ||
      url.password ||
      !(
        authRead ||
        login ||
        logout ||
        dataRead ||
        humanRpc ||
        domainRpc ||
        intakeRpc ||
        researchRpc ||
        storageRead ||
        intakeUpload
      )
    ) {
      throw new Error("This preview permits authenticated reads only.");
    }
    return nativeFetch(input, {
      ...init,
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
    });
  };
}
export function createHqClient(
  config: PublicConfig,
  nativeFetch: typeof fetch = fetch,
): HqClient {
  if (!validConfig(config))
    throw new Error("Public configuration is unavailable.");
  return createClient<HqDatabase>(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      debug: false,
    },
    global: {
      fetch: readOnlyFetch(
        new URL(config.url).origin,
        nativeFetch,
        config.humanActions === true,
        config,
      ),
    },
  });
}
