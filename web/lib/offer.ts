import type { SupabaseClient } from "@supabase/supabase-js";
import type { HqClient } from "./supabase/client";
import type { JobView } from "./types";
export class OfferActionError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
  ) {
    super(message);
  }
}
export type Offer = {
  id: string;
  workspace_id: string;
  opportunity_id: string;
  received_at: string;
  status: string;
  negotiation_state: string;
  final_decision: string | null;
  decision_at: string | null;
  updated_at: string;
};
export type OfferTerms = {
  id: string;
  offer_id: string;
  version_number: number;
  currency: string;
  base: number | null;
  base_period: string;
  variable: number | null;
  ote: number | null;
  variable_notes: string | null;
  equity: string | null;
  equity_units: number | null;
  equity_percent: number | null;
  equity_vesting: string | null;
  benefits_notes: string | null;
  start_date: string | null;
  location_travel: string | null;
  travel_percent: number | null;
  quota: string | null;
  ramp: string | null;
  territory: string | null;
  expires_at: string | null;
  terms_notes: string | null;
};
export type Negotiation = {
  id: string;
  offer_id: string;
  offer_terms_id: string;
  entry_type: string;
  exact_text: string;
  occurred_at: string;
};
export type OfferDecision = {
  id: string;
  offer_id: string;
  offer_terms_id: string;
  decision: string;
  reason: string;
  decided_at: string;
  created_by_principal_id: string;
};
export type OfferBundle = {
  offers: Offer[];
  terms: OfferTerms[];
  negotiations: Negotiation[];
  decisions: OfferDecision[];
};
export type OfferCommand = "accept" | "decline" | "negotiate" | "revise_terms";
export type OfferInput = {
  confirmed?: boolean;
  reason?: string;
  exact_text?: string;
  entry_type?: string;
  terms?: Record<string, string | number | null>;
};
export type OfferService = {
  load: (job: JobView) => Promise<OfferBundle>;
  act: (
    job: JobView,
    offer: Offer,
    terms: OfferTerms,
    command: OfferCommand,
    input: OfferInput,
    requestId: string,
  ) => Promise<void>;
};
export const OFFER_TABLES = [
  "offers",
  "offer_terms",
  "offer_negotiations",
  "offer_decisions",
];
export function offerService(
  client: HqClient,
  workspaceId: () => string,
  reload: () => Promise<void>,
): OfferService {
  const db = client as unknown as SupabaseClient;
  async function read<T>(
    table: string,
    field: string,
    ids: string[],
    scope: string,
  ): Promise<T[]> {
    if (!ids.length) return [];
    const rows: T[] = [];
    for (let from = 0; from < 10000; from += 200) {
      const result = await db
        .from(table)
        .select("*")
        .eq("workspace_id", scope)
        .in(field, ids)
        .order("id")
        .range(from, from + 199);
      if (result.error || !Array.isArray(result.data))
        throw new Error(
          "Offer records could not be loaded. Verify access and rollout.",
        );
      rows.push(...(result.data as T[]));
      if (result.data.length < 200) return rows;
    }
    throw new Error("Offer history needs a more focused query.");
  }
  return {
    async load(job) {
      const scope = workspaceId();
      if (job.opportunity.workspace_id !== scope)
        throw new Error("Offer workspace changed; reload.");
      const offers = await read<Offer>(
        "offers",
        "opportunity_id",
        [job.opportunity.id],
        scope,
      );
      const ids = offers.map((o) => o.id);
      const [terms, negotiations, decisions] = await Promise.all([
        read<OfferTerms>("offer_terms", "offer_id", ids, scope),
        read<Negotiation>("offer_negotiations", "offer_id", ids, scope),
        read<OfferDecision>("offer_decisions", "offer_id", ids, scope),
      ]);
      return { offers, terms, negotiations, decisions };
    },
    async act(job, offer, terms, command, input, requestId) {
      const scope = workspaceId();
      if (
        job.opportunity.workspace_id !== scope ||
        offer.workspace_id !== scope
      )
        throw new Error("Offer workspace changed; reload.");
      const result = await db.rpc("hq_offer_action", {
        target_workspace_id: scope,
        target_opportunity_id: job.opportunity.id,
        expected_updated_at: job.opportunity.updated_at,
        request_id: requestId,
        command,
        payload: {
          offer_id: offer.id,
          offer_updated_at: offer.updated_at,
          offer_terms_id: terms.id,
          ...input,
        },
      });
      if (
        result.error &&
        [
          "23514",
          "22P02",
          "22007",
          "22008",
          "40001",
          "42501",
          "P0001",
          "PGRST202",
        ].includes(result.error.code)
      )
        throw new OfferActionError(
          result.error.code === "40001"
            ? "Offer records changed. Reload and review before trying again."
            : "The request was rejected without recording a change. Review the fields, access or rollout before trying again.",
          false,
        );
      if (result.error || result.data?.offer_id !== offer.id)
        throw new OfferActionError(
          "Decision or negotiation could not be confirmed. Reload or retry this same reviewed request.",
          true,
        );
      await reload();
    },
  };
}
