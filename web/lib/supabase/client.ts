import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
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
  outreach = false,
): typeof fetch {
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
      (READ_TABLES.has(table) || (outreach && OUTREACH_READ_TABLES.has(table)));
    const outreachRpc =
      outreach &&
      method === "POST" &&
      url.pathname === "/rest/v1/rpc/hq_outreach_action" &&
      !url.search;
    const humanRpc =
      humanActions &&
      method === "POST" &&
      url.pathname === "/rest/v1/rpc/hq_human_action" &&
      !url.search;
    if (
      url.origin !== origin ||
      url.username ||
      url.password ||
      !(authRead || login || logout || dataRead || humanRpc || outreachRpc)
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
        config.outreach === true,
      ),
    },
  });
}
