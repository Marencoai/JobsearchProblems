"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { OfferActionError } from "@/lib/offer";
import type {
  OfferBundle,
  OfferService,
  Offer,
  OfferTerms,
  OfferCommand,
  OfferInput,
} from "@/lib/offer";
import type { JobView } from "@/lib/types";
import { date } from "@/lib/format";
export const OfferContext = createContext<OfferService | null>(null);
function money(value: number | null, currency: string) {
  if (value === null) return "Not recorded";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}
export function OfferPanel({ job }: { job: JobView }) {
  const service = useContext(OfferContext);
  const [bundle, setBundle] = useState<OfferBundle | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!service) return;
    void service
      .load(job)
      .then((data) => {
        if (active) setBundle(data);
      })
      .catch(() => {
        if (active)
          setError("Offer records could not be loaded. Please retry.");
      });
    return () => {
      active = false;
    };
  }, [service, job]);
  if (!service)
    return (
      <p className="notice">
        Structured offer review will be available after its reviewed rollout.
        Recorded offer activity remains below.
      </p>
    );
  if (!bundle)
    return (
      <p role={error ? "alert" : "status"}>
        {error || "Loading offer records…"}
      </p>
    );
  return (
    <div className="stage-records">
      {error && <p role="alert">{error}</p>}
      {!bundle.offers.length && (
        <p className="notice">No structured offer recorded for this role.</p>
      )}
      {bundle.offers.map((offer) => {
        const versions = bundle.terms
          .filter((t) => t.offer_id === offer.id)
          .sort((a, b) => b.version_number - a.version_number);
        const current = versions[0];
        return (
          <section className="package-summary" key={offer.id}>
            <div className="item-title">
              <h3>Offer received {date(offer.received_at)}</h3>
              <span className="tag">{offer.status}</span>
            </div>
            {current ? (
              <>
                <TermsView terms={current} />
                {["received", "negotiating"].includes(offer.status) && (
                  <OfferControls
                    key={offer.updated_at + current.id}
                    offer={offer}
                    terms={current}
                    onAction={async (command, input, id) => {
                      await service.act(
                        job,
                        offer,
                        current,
                        command,
                        input,
                        id,
                      );
                      setBundle(await service.load(job));
                    }}
                  />
                )}
              </>
            ) : (
              <p>Terms have not been recorded.</p>
            )}
            <h4>Negotiation history</h4>
            {bundle.negotiations
              .filter((n) => n.offer_id === offer.id)
              .map((n) => (
                <p key={n.id}>
                  <span className="tag">{n.entry_type}</span> {n.exact_text}{" "}
                  <span className="record-caption">{date(n.occurred_at)}</span>
                </p>
              ))}
            <h4>Recorded decisions</h4>
            {bundle.decisions
              .filter((d) => d.offer_id === offer.id)
              .map((d) => (
                <p key={d.id}>
                  <strong>{d.decision}</strong> · {d.reason} ·{" "}
                  {date(d.decided_at)}
                  <br />
                  <span className="record-caption">
                    Terms version{" "}
                    {versions.find((t) => t.id === d.offer_terms_id)
                      ?.version_number ?? "not recorded"}
                  </span>
                </p>
              ))}
            {versions.length > 1 && (
              <details>
                <summary>Earlier offer terms ({versions.length - 1})</summary>
                {versions.slice(1).map((t) => (
                  <TermsView key={t.id} terms={t} />
                ))}
              </details>
            )}
          </section>
        );
      })}
    </div>
  );
}
function TermsView({ terms: t }: { terms: OfferTerms }) {
  return (
    <>
      <p className="record-caption">
        Terms version {t.version_number} · {t.currency} · Base period:{" "}
        {t.base_period}
      </p>
      <dl className="offer-terms">
        {Object.entries({
          Base: money(t.base, t.currency),
          Variable: money(t.variable, t.currency),
          "OTE (employer stated)": money(t.ote, t.currency),
          "Variable details": t.variable_notes,
          Equity: t.equity,
          "Equity units": t.equity_units,
          "Equity percent": t.equity_percent,
          Vesting: t.equity_vesting,
          Benefits: t.benefits_notes,
          "Start date": t.start_date,
          "Location / travel": t.location_travel,
          "Travel percent": t.travel_percent,
          Quota: t.quota,
          Ramp: t.ramp,
          Territory: t.territory,
          "Response deadline": t.expires_at
            ? new Date(t.expires_at).toLocaleString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZoneName: "short",
              })
            : "Not recorded",
          "Other terms": t.terms_notes,
        }).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value ?? "Not recorded"}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
const termLabels = {
  currency: "Currency (ISO code)",
  base: "Base",
  base_period: "Base period",
  variable: "Variable",
  ote: "OTE",
  variable_notes: "Variable details",
  equity: "Equity",
  equity_units: "Equity units",
  equity_percent: "Equity percent",
  equity_vesting: "Vesting",
  benefits_notes: "Benefits",
  start_date: "Start date",
  location_travel: "Location / travel",
  travel_percent: "Travel percent",
  quota: "Quota",
  ramp: "Ramp",
  territory: "Territory",
  expires_at: "Response deadline",
  terms_notes: "Other terms",
};
function OfferControls({
  offer,
  terms,
  onAction,
}: {
  offer: Offer;
  terms: OfferTerms;
  onAction: (
    command: OfferCommand,
    input: OfferInput,
    id: string,
  ) => Promise<void>;
}) {
  const [command, setCommand] = useState<OfferCommand | null>(null),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [revised, setRevised] = useState<
    Record<string, string | number | null>
  >(() =>
    Object.fromEntries(
      Object.keys(termLabels).map((k) => [k, terms[k as keyof OfferTerms]]),
    ),
  );
  const [locked, setLocked] = useState(false);
  const request = useRef<{
      id: string;
      command: OfferCommand;
      input: OfferInput;
    } | null>(null),
    pending = useRef(false),
    dialog = useRef<HTMLDialogElement | null>(null),
    trigger = useRef<HTMLElement | null>(null);
  const final = command === "accept" || command === "decline";
  useEffect(() => {
    if (command) dialog.current?.showModal();
    else dialog.current?.close();
  }, [command]);
  function close() {
    if (busy || locked) return;
    setCommand(null);
    setError("");
    setReason("");
    setConfirmed(false);
    trigger.current?.focus();
  }
  return (
    <>
      <div className="dialog-actions">
        {(["accept", "negotiate", "decline", "revise_terms"] as const).map(
          (c) => (
            <button
              className="button secondary"
              key={c}
              onClick={(e) => {
                trigger.current = e.currentTarget;
                setCommand(c);
              }}
            >
              {c === "accept"
                ? "Accept"
                : c === "decline"
                  ? "Decline"
                  : c === "negotiate"
                    ? "Negotiate"
                    : "Record revised terms"}
            </button>
          ),
        )}
      </div>
      <dialog
        ref={dialog}
        aria-labelledby={`offer-dialog-${offer.id}`}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        className="human-action-dialog"
      >
        <h3 id={`offer-dialog-${offer.id}`}>
          {final
            ? `Record ${command === "accept" ? "acceptance" : "decline"}`
            : command === "negotiate"
              ? "Plan your negotiation"
              : "Record revised offer terms"}
        </h3>
        <p>
          Review terms version {terms.version_number}. This records your own
          decision or plan. Employer communication remains a separate human
          action.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!command || pending.current) return;
            pending.current = true;
            setBusy(true);
            setError("");
            request.current ??= {
              id: crypto.randomUUID(),
              command,
              input:
                command === "revise_terms"
                  ? { terms: revised }
                  : final
                    ? { confirmed, reason }
                    : { entry_type: "plan", exact_text: reason },
            };
            try {
              await onAction(
                request.current.command,
                request.current.input,
                request.current.id,
              );
              request.current = null;
              setCommand(null);
              setReason("");
              setConfirmed(false);
              trigger.current?.focus();
            } catch (failure) {
              const retryable =
                !(failure instanceof OfferActionError) || failure.retryable;
              setLocked(retryable);
              if (!retryable) request.current = null;
              setError(
                failure instanceof OfferActionError
                  ? failure.message
                  : "Could not confirm this request. Retry with the same reviewed input.",
              );
            } finally {
              pending.current = false;
              setBusy(false);
            }
          }}
        >
          {command === "revise_terms" ? (
            Object.entries(termLabels).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  required={key === "currency" || key === "base_period"}
                  pattern={
                    key === "currency"
                      ? "[A-Z]{3}"
                      : key === "base_period"
                        ? "annual|monthly|hourly"
                        : undefined
                  }
                  type={
                    [
                      "base",
                      "variable",
                      "ote",
                      "equity_units",
                      "equity_percent",
                      "travel_percent",
                    ].includes(key)
                      ? "number"
                      : key === "start_date"
                        ? "date"
                        : "text"
                  }
                  min={
                    [
                      "base",
                      "variable",
                      "ote",
                      "equity_units",
                      "equity_percent",
                      "travel_percent",
                    ].includes(key)
                      ? 0
                      : undefined
                  }
                  max={
                    ["equity_percent", "travel_percent"].includes(key)
                      ? 100
                      : undefined
                  }
                  step="any"
                  value={revised[key] ?? ""}
                  disabled={busy || locked}
                  maxLength={1800}
                  onChange={(e) =>
                    setRevised({
                      ...revised,
                      [key]:
                        (key === "currency"
                          ? e.target.value.toUpperCase()
                          : e.target.value) || null,
                    })
                  }
                />
              </label>
            ))
          ) : (
            <label>
              {final ? "Decision reason" : "Negotiation plan"}
              <textarea
                required
                maxLength={6000}
                disabled={busy || locked}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          {final && (
            <label className="confirmation-check">
              <input
                type="checkbox"
                required
                disabled={busy || locked}
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I reviewed these exact terms and am recording my own{" "}
              {command === "accept" ? "acceptance" : "decline"} decision.
            </label>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="dialog-actions">
            <button
              type="button"
              className="button secondary"
              disabled={busy || locked}
              onClick={close}
            >
              Cancel
            </button>
            <button
              className="button primary"
              disabled={busy || (final && !confirmed)}
            >
              {busy
                ? "Recording…"
                : locked
                  ? "Retry same request"
                  : final
                    ? "Record decision"
                    : "Save"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
