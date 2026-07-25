import { z } from "zod";

// Validates the admin/dispatcher form that requests a fresh matching run for
// one open ShiftPosition.
export const findCandidatesSchema = z.object({
  positionId: z.string().min(1, "A position is required."),
});
export type FindCandidatesInput = z.infer<typeof findCandidatesSchema>;

// Validates the admin/dispatcher form that sends an offer to one worker for
// one open position.
export const sendOfferSchema = z.object({
  positionId: z.string().min(1, "A position is required."),
  workerProfileId: z.string().min(1, "A worker is required."),
});
export type SendOfferInput = z.infer<typeof sendOfferSchema>;

// Validates the worker-facing accept/decline offer forms.
export const respondToOfferSchema = z.object({
  offerId: z.string().min(1, "An offer is required."),
  reason: z.string().max(500).optional(),
});
export type RespondToOfferInput = z.infer<typeof respondToOfferSchema>;
