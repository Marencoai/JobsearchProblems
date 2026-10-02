import { afterEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/public-config/route";
const flags = [
  ["HQ_HUMAN_ACTIONS", "humanActions"],
  ["HQ_MANUAL_INTAKE", "manualIntake"],
  ["HQ_MATERIAL_DELIVERY", "materialDelivery"],
  ["HQ_RESEARCH_REFRESH", "researchRefresh"],
  ["HQ_OUTREACH", "outreach"],
  ["HQ_INTERVIEW", "interview"],
  ["HQ_OFFER", "offer"],
] as const;
afterEach(() => vi.unstubAllEnvs());
it.each(["off", ...flags.map(([env]) => env), "all"])(
  "public config %s preserves independent exact-1 flags",
  async (selected) => {
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      "https://xhhfnxswwspejdxjyvzz.supabase.co",
    );
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "sb_publishable_synthetic_only",
    );
    for (const [env] of flags)
      vi.stubEnv(env, selected === "all" || selected === env ? "1" : "true");
    const response = GET();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const config = await response.json();
    for (const [env, key] of flags)
      expect(config[key]).toBe(selected === "all" || selected === env);
    expect(Object.keys(config).sort()).toEqual(
      ["url", "key", ...flags.map(([, key]) => key)].sort(),
    );
  },
);
