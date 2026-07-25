"use server";

import { signOut } from "@/auth";

// Shared sign-out server action used by the root layout's nav so every
// authenticated screen (admin, contractor, worker) gets a consistent way to
// end the session and return to the public marketing home page.
export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
