import { NextResponse } from "next/server";
import { runReminderSweep } from "@/lib/services/reminders.service";

// Scaffolded automation endpoint for the Phase 2/3 notification sweep -
// shift reminders, no-show detection, and document/certification expiring
// warnings. Mirrors app/api/cron/expire-offers/route.ts exactly: intended to
// be hit on a short interval (every few minutes) by a scheduler - Railway
// cron, an external uptime/cron service, or a platform cron job - guarded by
// the same shared CRON_SECRET used for the offer-expiration sweep (see
// .env.example). No interactive admin session is required or expected here,
// since a scheduler cannot complete a browser login. Until a real scheduler
// is configured for this route specifically, the sweep still runs
// opportunistically on admin dashboard load - see app/admin/page.tsx.
function isAuthorized(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) return false;
  const providedSecret = request.headers.get("x-cron-secret");
  return providedSecret === configuredSecret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runReminderSweep();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runReminderSweep();
  return NextResponse.json({ ok: true, ...result });
}
