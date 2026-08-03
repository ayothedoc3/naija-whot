import { NextResponse } from "next/server";

// Used as the Coolify health-check path (port 3000, expects HTTP 200).
// Never statically prerendered — this must run on every request.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
    },
    { status: 200 },
  );
}
