import { defineConfig } from "vitest/config";
import path from "node:path";

// Minimal Vitest config for Phase 1. Only pure/unit-testable modules (authz
// policies, zod validation schemas) are covered for now - service-layer tests
// that require a real or mocked Prisma client are tracked as a Phase 2
// follow-up in docs/PHASE1-DESIGN.md's testing plan.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
