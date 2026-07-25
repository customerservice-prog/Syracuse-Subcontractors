import { z } from "zod";

// Crews are admin-managed in the MVP - see docs/PHASE1-DESIGN.md and
// lib/authz/policies.ts (canManageCrews). Membership changes are modeled as
// new/ended CrewMembership rows, never edits, so history is preserved.

export const createCrewSchema = z.object({
  name: z.string().min(2, "Crew name must be at least 2 characters."),
});
export type CreateCrewInput = z.infer<typeof createCrewSchema>;

export const addCrewMemberSchema = z.object({
  crewId: z.string().min(1, "A crew is required."),
  workerProfileId: z.string().min(1, "A worker is required."),
  role: z.enum(["LEADER", "ASSISTANT_LEADER", "MEMBER"]).optional(),
});
export type AddCrewMemberInput = z.infer<typeof addCrewMemberSchema>;

export const removeCrewMemberSchema = z.object({
  crewMembershipId: z.string().min(1, "A crew membership is required."),
});
export type RemoveCrewMemberInput = z.infer<typeof removeCrewMemberSchema>;
