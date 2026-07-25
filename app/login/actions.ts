"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { db } from "@/lib/db";

// Server action backing the credentials login form. On failure it redirects
// back to /login with an error code in the query string rather than throwing
// an unhandled error, since signIn() does not return a value on success (it
// redirects internally). The post-login destination depends on the user's
// role so each account type lands on the dashboard built for it, matching
// the role-to-path mapping in app/layout.tsx and the route gating in
// middleware.ts.
export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const destination = await resolvePostLoginDestination(email);

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: destination,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=${error.type}`);
    }
    throw error;
  }
}

async function resolvePostLoginDestination(email: string): Promise<string> {
  if (!email) return "/";

  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { role: true },
  });

  switch (user?.role) {
    case "SUPER_ADMIN":
    case "DISPATCHER":
      return "/admin";
    case "CONTRACTOR_OWNER":
    case "CONTRACTOR_MANAGER":
    case "SUPERVISOR":
      return "/contractor";
    case "WORKER":
      return "/worker";
    default:
      return "/";
  }
}
