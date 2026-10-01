import { validConfig } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";
export function GET() {
  const config = {
    url: process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "",
    key: process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] ?? "",
  };
  const headers = { "Cache-Control": "private, no-store" };
  if (!validConfig(config))
    return Response.json(
      { error: "The public connection has not been configured." },
      { status: 503, headers },
    );
  return Response.json(config, { headers });
}
