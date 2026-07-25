import { NextResponse } from "next/server";
import { expireStaleOffers } from "@/lib/services/dispatch.service";

// Scaffolded automation endpoint for Phase 2 dispatch. Intended to be hit on
// a short interval (every few minutes) by a scheduler - Railway cron, an
// external uptime/cron service, or a platform cron job - so offers whose
// response window has passed are expired and the next-ranked eligible
// candidate is automatically re-offered, per the "auto-reoffer to next
// qualified worker on decline/expiry" requirement in docs/PHASE1-DESIGN.md.
//
// No interactive admin session is required or expected here, since a
// scheduler cannot complete a browser login. Instead this route is guarded
// by a shared secret set in CRON_SECRET (see .env.example). Until a real
// scheduler is configured, this route simply is not called and offers are
// still swept opportunistically on admin dashboard load - see
// app/admin/page.tsx.
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

  const result = await expireStaleOffers();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await expireStaleOffers();
  return NextResponse.json({ ok: true, ...result });
}
