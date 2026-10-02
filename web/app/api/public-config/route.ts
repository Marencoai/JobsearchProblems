import { validConfig } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";
export function GET() {
  const config = {
    url: process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "",
    key: process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] ?? "",
    // Enable only after live Phase 1 acceptance and approval/deployment of the
    // reviewed migration. The default remains the existing read-only preview.
    humanActions: process.env["HQ_HUMAN_ACTIONS"] === "1",
    manualIntake: process.env["HQ_MANUAL_INTAKE"] === "1",
    materialDelivery: process.env["HQ_MATERIAL_DELIVERY"] === "1",
    researchRefresh: process.env["HQ_RESEARCH_REFRESH"] === "1",
  };
  const headers = { "Cache-Control": "private, no-store" };
  if (!validConfig(config))
    return Response.json(
      { error: "The public connection has not been configured." },
      { status: 503, headers },
    );
  return Response.json(config, { headers });
}
