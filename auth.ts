// NextAuth (Auth.js) v5 configuration.
// Session strategy is JWT-based. Credentials are checked against the User
// table's passwordHash. OAuth providers can be added later without changing
// this file's shape - see config/features.ts for provider feature flags.
//
// IMPORTANT: this file must never read real secrets from anywhere but
// environment variables. See .env.example for the required variables.

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Railway (like most PaaS hosts) terminates TLS at a proxy in front of the
  // app, so Auth.js cannot otherwise verify the incoming Host header against
  // a statically known origin. Without trustHost, session/auth requests
  // intermittently fail with an "UntrustedHost" error, which can silently
  // break login. This is the officially recommended setting for apps
  // deployed behind a reverse proxy (Railway, Docker, etc.) - see
  // https://errors.authjs.dev#untrustedhost.
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 12,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;

        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: email.toLowerCase().trim() },
          include: {
            contractorUser: true,
            workerProfile: true,
          },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        if (user.status !== "ACTIVE") {
          return null;
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);

        if (!passwordMatches) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
          contractorId: user.contractorUser?.contractorId ?? null,
          workerProfileId: user.workerProfile?.id ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.status = user.status;
        token.contractorId = user.contractorId ?? null;
        token.workerProfileId = user.workerProfileId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.status = token.status as UserStatus;
        session.user.contractorId = (token.contractorId as string | null | undefined) ?? null;
        session.user.workerProfileId = (token.workerProfileId as string | null | undefined) ?? null;
      }
      return session;
    },
  },
});
