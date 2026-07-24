// Coarse route-group gating only. This is a first line of defense, not the
// source of truth for authorization - every service method re-checks
// permissions against the database via lib/authz/policies.ts before acting.

import { NextResponse } from "next/server";
import { auth } from "@/auth";

const ADMIN_ROLES = ["SUPER_ADMIN", "DISPATCHER"];
const CONTRACTOR_ROLES = ["CONTRACTOR_OWNER", "CONTRACTOR_MANAGER", "SUPERVISOR"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;

                    const isAdminRoute = pathname.startsWith("/admin");
  const isContractorRoute = pathname.startsWith("/contractor");
  const isWorkerRoute = pathname.startsWith("/worker");

                    const hasAdminRole = Boolean(role && ADMIN_ROLES.includes(role));
  const hasContractorRole = Boolean(role && CONTRACTOR_ROLES.includes(role));
  const hasWorkerRole = Boolean(role && role === "WORKER");

                    if (isAdminRoute && !hasAdminRole) {
                      return NextResponse.redirect(new URL("/login", req.nextUrl));
                    }

                    if (isContractorRoute && !hasContractorRole && !hasAdminRole) {
                      return NextResponse.redirect(new URL("/login", req.nextUrl));
                    }

                    if (isWorkerRoute && !hasWorkerRole && !hasAdminRole) {
                      return NextResponse.redirect(new URL("/login", req.nextUrl));
                    }

                    return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/contractor/:path*", "/worker/:path*"],
};
