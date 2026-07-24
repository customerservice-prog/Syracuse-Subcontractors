// Converts the current NextAuth session into the ActingUser shape expected
// by lib/authz/policies.ts. Server actions, route handlers, and server
// components should call this instead of reading the session directly so
// every policy check receives a consistent shape.

import { auth } from "@/auth";
import type { ActingUser } from "@/lib/authz/policies";

export async function getActingUser(): Promise<ActingUser | null> {
  const session = await auth();

if (!session?.user) {
  return null;
}

return {
  id: session.user.id,
  role: session.user.role,
  contractorId: session.user.contractorId ?? null,
  workerProfileId: session.user.workerProfileId ?? null,
};
}
