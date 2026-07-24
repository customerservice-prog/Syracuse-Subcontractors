// Wires NextAuth's route handlers into the Next.js App Router.
// Business logic lives in auth.ts; this file only re-exports handlers.

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
