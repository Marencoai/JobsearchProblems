// @vitest-environment jsdom
import { beforeAll, afterEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { OfferPanel, OfferContext } from "@/components/offer-panel";
import { offerFixture } from "@/lib/offer-fixture";
import { buildJobViews } from "@/lib/workflow";
import { visualFixture } from "@/lib/qa-fixtures";
import { readOnlyFetch, createHqClient } from "@/lib/supabase/client";
import { OfferActionError, offerService } from "@/lib/offer";
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);
const job = buildJobViews(visualFixture()).find(
  (j) => j.opportunity.id === "offer",
)!;
it("keeps disabled domain read-only without new queries or decision controls", () => {
  render(<OfferPanel job={job} />);
  expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
});
it("shows structured terms and cancels without recording a decision", async () => {
  const service = offerFixture();
  service.act = vi.fn();
  render(
    <OfferContext.Provider value={service}>
      <OfferPanel job={job} />
    </OfferContext.Provider>,
  );
  await screen.findByText("$140,000.00");
  expect(screen.getByText("Quota")).toBeTruthy();
  expect(screen.getByText("Western region")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Accept" }));
  const button = screen.getByRole("button", { name: "Record decision" });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(service.act).not.toHaveBeenCalled();
});
it("human-confirmed exact terms and reason retry with same request and frozen input", async () => {
  const service = offerFixture();
  service.act = vi
    .fn()
    .mockRejectedValueOnce(new Error("uncertain"))
    .mockResolvedValue(undefined);
  render(
    <OfferContext.Provider value={service}>
      <OfferPanel job={job} />
    </OfferContext.Provider>,
  );
  await screen.findByText("$140,000.00");
  fireEvent.click(screen.getByRole("button", { name: "Decline" }));
  fireEvent.change(screen.getByLabelText("Decision reason"), {
    target: { value: "Quota and territory do not fit" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Record decision" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Retry same request" }));
  await waitFor(() => expect(service.act).toHaveBeenCalledTimes(2));
  const calls = vi.mocked(service.act).mock.calls;
  expect(calls[0][2].id).toBe("synthetic-terms-v1");
  expect(calls[0][3]).toBe("decline");
  expect(calls[0][4]).toEqual({
    reason: "Quota and territory do not fit",
    confirmed: true,
  });
  expect(calls[1][5]).toBe(calls[0][5]);
  expect(calls[1][4]).toEqual(calls[0][4]);
});
it("allows negotiation notes without external send or final decision confirmation", async () => {
  const service = offerFixture();
  service.act = vi.fn().mockResolvedValue(undefined);
  render(
    <OfferContext.Provider value={service}>
      <OfferPanel job={job} />
    </OfferContext.Provider>,
  );
  await screen.findByText("$140,000.00");
  fireEvent.click(screen.getByRole("button", { name: "Negotiate" }));
  fireEvent.change(screen.getByLabelText("Negotiation plan"), {
    target: { value: "Ask about ramp guarantee" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(service.act).toHaveBeenCalledTimes(1));
  expect(vi.mocked(service.act).mock.calls[0][4]).toEqual({
    entry_type: "plan",
    exact_text: "Ask about ramp guarantee",
  });
});
it("SDK preserves exact offer/terms IDs, reviewed timestamps and request ID", async () => {
  const origin = "https://xhhfnxswwspejdxjyvzz.supabase.co",
    native = vi.fn().mockResolvedValue(
      new Response('{"offer_id":"synthetic-offer"}', {
        headers: { "Content-Type": "application/json" },
      }),
    );
  const client = createHqClient(
    { url: origin, key: "sb_publishable_fixture_only", offer: true },
    native,
  );
  const bundle = await offerFixture().load(job);
  await offerService(
    client,
    () => job.opportunity.workspace_id,
    async () => {},
  ).act(
    job,
    bundle.offers[0],
    bundle.terms[0],
    "accept",
    { confirmed: true, reason: "Reviewed" },
    "same-request",
  );
  const [url, init] = native.mock.calls[0];
  expect(String(url)).toBe(origin + "/rest/v1/rpc/hq_offer_action");
  expect(JSON.parse(init.body)).toMatchObject({
    expected_updated_at: job.opportunity.updated_at,
    request_id: "same-request",
    payload: {
      offer_id: "synthetic-offer",
      offer_terms_id: "synthetic-terms-v1",
      confirmed: true,
      reason: "Reviewed",
    },
  });
  client.auth.stopAutoRefresh();
});
it("default transport blocks domain RPC and raw writes; flags remain independent", async () => {
  const origin = "https://xhhfnxswwspejdxjyvzz.supabase.co",
    native = vi.fn().mockResolvedValue(new Response("{}"));
  await expect(
    readOnlyFetch(origin, native)(origin + "/rest/v1/offers"),
  ).rejects.toThrow();
  await expect(
    readOnlyFetch(
      origin,
      native,
      false,
      true,
    )(origin + "/rest/v1/rpc/hq_offer_action", { method: "POST" }),
  ).rejects.toThrow();
  const on = readOnlyFetch(origin, native, false, false, true);
  await on(origin + "/rest/v1/offers");
  await on(origin + "/rest/v1/rpc/hq_offer_action", { method: "POST" });
  await expect(
    on(origin + "/rest/v1/offers", { method: "PATCH" }),
  ).rejects.toThrow();
  await expect(
    on(origin + "/rest/v1/rpc/hq_interview_action", { method: "POST" }),
  ).rejects.toThrow();
  expect(native).toHaveBeenCalledTimes(2);
});

it("allows correcting or canceling a deterministic rejected request", async () => {
  const service = offerFixture();
  service.act = vi
    .fn()
    .mockRejectedValue(new OfferActionError("Review fields", false));
  render(
    <OfferContext.Provider value={service}>
      <OfferPanel job={job} />
    </OfferContext.Provider>,
  );
  await screen.findByText("$140,000.00");
  fireEvent.click(screen.getByRole("button", { name: "Decline" }));
  fireEvent.change(screen.getByLabelText("Decision reason"), {
    target: { value: "Reviewed reason" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Record decision" }));
  await screen.findByRole("alert");
  expect(
    (screen.getByLabelText("Decision reason") as HTMLTextAreaElement).disabled,
  ).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(document.querySelector("dialog[open]")).toBeNull();
});
