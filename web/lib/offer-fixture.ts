import type { OfferBundle, OfferService } from "./offer";
export function offerFixture(): OfferService {
  const bundle: OfferBundle = {
    offers: [
      {
        id: "synthetic-offer",
        workspace_id: "fixture-workspace",
        opportunity_id: "offer",
        received_at: "2026-10-01T12:00:00Z",
        status: "received",
        negotiation_state: "not_started",
        final_decision: null,
        decision_at: null,
        updated_at: "2026-10-01T12:00:00Z",
      },
    ],
    terms: [
      {
        id: "synthetic-terms-v1",
        offer_id: "synthetic-offer",
        version_number: 1,
        currency: "USD",
        base: 140000,
        base_period: "annual",
        variable: 60000,
        ote: 200000,
        variable_notes: "Performance-dependent commission",
        equity: "Options",
        equity_units: 10000,
        equity_percent: null,
        equity_vesting: "Four years",
        benefits_notes: "Synthetic health plan",
        start_date: "2026-11-01",
        location_travel: "Remote; quarterly travel",
        travel_percent: 15,
        quota: "1.5M ARR",
        ramp: "Six months",
        territory: "Western region",
        expires_at: "2026-10-10T17:00:00Z",
        terms_notes: "Synthetic fixture only.",
      },
    ],
    negotiations: [],
    decisions: [],
  };
  return {
    load: async () => structuredClone(bundle),
    act: async (_job, offer, terms, command, input) => {
      const now = new Date().toISOString();
      const current = bundle.offers[0];
      if (command === "negotiate") {
        bundle.negotiations.push({
          id: now,
          offer_id: offer.id,
          offer_terms_id: terms.id,
          entry_type: "plan",
          exact_text: input.exact_text ?? "",
          occurred_at: now,
        });
        current.status = "negotiating";
      } else if (command === "revise_terms") {
        bundle.terms.push({
          ...terms,
          ...input.terms,
          id: now,
          version_number: terms.version_number + 1,
        });
      } else {
        current.status = command === "accept" ? "accepted" : "declined";
        current.final_decision = current.status;
        bundle.decisions.push({
          id: now,
          offer_id: offer.id,
          offer_terms_id: terms.id,
          decision: current.status,
          reason: input.reason ?? "",
          decided_at: now,
          created_by_principal_id: "synthetic-human",
        });
      }
      current.updated_at = now;
    },
  };
}
