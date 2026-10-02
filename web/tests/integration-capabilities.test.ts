import { describe, expect, it, vi } from "vitest";
import { readOnlyFetch, type PublicConfig } from "@/lib/supabase/client";
const origin = "https://xhhfnxswwspejdxjyvzz.supabase.co";
const domains = [
  ["outreach", "contacts", "hq_outreach_action"],
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
