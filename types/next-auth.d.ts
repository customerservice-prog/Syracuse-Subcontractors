// Module augmentation so session/JWT objects carry the fields the
// authorization policy layer (lib/authz/policies.ts) expects.

import type { UserRole, UserStatus } from "@prisma/client";

declare module "next-auth" {
interface User {
  id: string;
  role: UserRole;
  status: UserStatus;
  contractorId?: string | null;
  workerProfileId?: string | null;
}

interface Session {
  user: {
    id: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    contractorId?: string | null;
    workerProfileId?: string | null;
  };
}
}

declare module "next-auth/jwt" {
interface JWT {
  id: string;
  role: UserRole;
  status: UserStatus;
  contractorId?: string | null;
  workerProfileId?: string | null;
}
}
