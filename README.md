# Syracuse Labor Dispatch Platform (temporary name)

A local, demand-first labor dispatch platform for the Syracuse / Central New York market. Contractors request skilled and general labor; vetted, admin-approved workers are matched and dispatched to shifts. Worker activation is capacity-limited and demand-driven — applicants are never promised guaranteed hours.

This is Phase 1 (foundation): database schema, auth/roles, worker application and waitlist, contractor interest/approval, and an admin dashboard shell. See docs/PHASE1-DESIGN.md for the full architecture, entity relationships, state machines, and phase plan.

## Status

Phase 1 is in progress. This repository currently contains the project foundation (schema, config, docs) being built out incrementally in small, reviewable commits. It has not yet been run, migrated, or tested in a live environment — see Setup below.

## Branding

The product name used throughout the UI is a placeholder. Update `config/brand.ts` (added in a later commit) to rebrand without touching business logic.

## Tech stack

Next.js (App Router, TypeScript), PostgreSQL via Prisma, Tailwind CSS, Auth.js (NextAuth v5) for authentication, Zod for validation. Third-party integrations (Twilio, Stripe, Google Maps, AI providers, background checks) are built behind provider interfaces with mock implementations until real credentials are added locally.

## Setup (local development)

1. Clone the repository and run `npm install`.
2. Copy `.env.example` to `.env` and fill in a local `DATABASE_URL` and a generated `NEXTAUTH_SECRET`. Leave provider keys (Twilio, Stripe, Google Maps, AI, background check) blank to keep mock providers active.
3. Run `npm run prisma:generate` and `npm run prisma:migrate` against a local PostgreSQL instance.
4. Run `npm run prisma:seed` to load fictional Syracuse-area sample data.
5. Run `npm run dev` and open `http://localhost:3000`.
6. Run `npm run lint`, `npm run typecheck`, and `npm test` before committing changes.

Note: schema formatting was normalized by hand during initial authoring; run `npm run prisma:format` after your first local edit to confirm consistent formatting.

## Security

No real secrets, credentials, customer data, or worker personal data are committed to this repository. `.env` is gitignored; only `.env.example` (placeholder values) is committed. Third-party integrations default to mock providers until you configure real credentials locally.

## Documentation

See `docs/PHASE1-DESIGN.md` for the architecture, entity relationships, state machines, authorization policy structure, file/folder plan, migration plan, testing plan, seed-data plan, and authentication rationale.
