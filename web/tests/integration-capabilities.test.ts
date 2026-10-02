import { describe, expect, it, vi } from "vitest";
import { readOnlyFetch, type PublicConfig } from "@/lib/supabase/client";
const origin = "https://xhhfnxswwspejdxjyvzz.supabase.co";
const domains = [
  ["outreach", "outreach_engagements", "hq_outreach_action"],
  ["interview", "interviews", "hq_interview_action"],
  ["offer", "offers", "hq_offer_action"],
] as const;
describe("combined domain transport boundary", () => {
  it.each([undefined, "outreach", "interview", "offer", "all"] as const)(
    "keeps %s capabilities independent and private ledgers inaccessible",
    async (selected) => {
      const capabilities: Omit<PublicConfig, "url" | "key"> = {
        manualIntake: true,
        materialDelivery: true,
      };
      for (const [name] of domains)
        capabilities[name] = selected === "all" || selected === name;
      const native = vi.fn<typeof fetch>(async () => new Response("{}"));
      const send = readOnlyFetch(origin, native, true, capabilities);
      for (const [name, table, rpc] of domains) {
        for (const [path, method] of [
          [table, "GET"],
          [`rpc/${rpc}`, "POST"],
        ]) {
          const request = send(`${origin}/rest/v1/${path}`, { method });
          if (capabilities[name]) await request;
          else await expect(request).rejects.toThrow();
        }
        await expect(
          send(`${origin}/rest/v1/${table}`, { method: "PATCH" }),
        ).rejects.toThrow();
        await expect(
          send(`${origin}/rest/v1/private.${name}_action_requests`),
        ).rejects.toThrow();
        await expect(
          send(`${origin}/rest/v1/rpc/${rpc}?extra=1`, { method: "POST" }),
        ).rejects.toThrow();
      }
      expect(native).toHaveBeenCalledTimes(
        selected === "all" ? 6 : selected ? 2 : 0,
      );
    },
  );
});

describe("all seven integrated capabilities", () => {
  const capabilities = [
    "humanActions",
    "manualIntake",
    "materialDelivery",
    "researchRefresh",
    "outreach",
    "interview",
    "offer",
  ] as const;
  it.each(["off", ...capabilities, "all"])(
    "%s opens only reviewed routes",
    async (selected) => {
      const native = vi.fn<typeof fetch>(async () => new Response("{}"));
      const flags: Omit<PublicConfig, "url" | "key"> = {};
      for (const flag of capabilities)
        flags[flag] = selected === "all" || selected === flag;
      const send = readOnlyFetch(origin, native, flags.humanActions, flags);
      const workspace = "11111111-1111-4111-8111-111111111111",
        material = "22222222-2222-4222-8222-222222222222",
        request = "33333333-3333-4333-8333-333333333333";
      const routes = [
        ["humanActions", "POST", "/rest/v1/rpc/hq_human_action"],
        ["manualIntake", "POST", "/rest/v1/rpc/hq_request_job_intake"],
        [
          "manualIntake",
          "POST",
          `/storage/v1/object/hq-intake/${workspace}/${material}/${request}/${"a".repeat(64)}.txt`,
        ],
        ["materialDelivery", "GET", "/rest/v1/application_material_artifacts"],
        [
          "materialDelivery",
          "GET",
          `/storage/v1/object/hq-materials/${workspace}/${material}/${"b".repeat(64)}.pdf`,
        ],
        ["researchRefresh", "POST", "/rest/v1/rpc/hq_request_research_refresh"],
        ["outreach", "POST", "/rest/v1/rpc/hq_outreach_action"],
        ["outreach", "GET", "/rest/v1/outreach_engagements"],
        ["interview", "POST", "/rest/v1/rpc/hq_interview_action"],
        ["interview", "GET", "/rest/v1/interviews"],
        ["offer", "POST", "/rest/v1/rpc/hq_offer_action"],
        ["offer", "GET", "/rest/v1/offers"],
      ] as const;
      for (const [owner, method, path] of routes) {
        const operation = send(origin + path, { method });
        if (flags[owner]) await operation;
        else await expect(operation).rejects.toThrow();
      }
      for (const [method, path] of [
        ["PATCH", "/rest/v1/opportunities"],
        ["POST", "/rest/v1/application_material_artifacts"],
        ["GET", "/rest/v1/private.interview_action_requests"],
        ["GET", "/rest/v1/private.offer_action_requests"],
        ["GET", "/rest/v1/private.outreach_action_requests"],
        ["POST", "/storage/v1/object/list/hq-materials"],
        ["GET", "/storage/v1/object/public/hq-materials/anything.pdf"],
        ["POST", "/storage/v1/object/sign/hq-materials"],
        [
          "DELETE",
          `/storage/v1/object/hq-materials/${workspace}/${material}/${"b".repeat(64)}.pdf`,
        ],
        ["POST", "/rest/v1/rpc/hq_request_research_refresh?extra=1"],
        ["GET", "/auth/v1/admin/users"],
      ])
        await expect(send(origin + path, { method })).rejects.toThrow();
      expect(native).toHaveBeenCalledTimes(
        routes.filter(([owner]) => flags[owner]).length,
      );
    },
  );
});
