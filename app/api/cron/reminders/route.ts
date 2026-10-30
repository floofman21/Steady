import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { runReminders } from "@/lib/jobs";

// Called hourly by netlify/functions/steady-jobs.mts; the job itself decides whether it's due
// in each org's time zone. ?force=1 runs it now; ?dryRun=1 reports recipients without sending.
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const reports = await runReminders({ force: url.searchParams.get("force") === "1", dryRun: url.searchParams.get("dryRun") === "1" });
  return NextResponse.json({ reports });
}
