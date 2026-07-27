import { z } from "zod";

// Validates the worker-facing check-in form. lat/lng/accuracy are optional
// and populated client-side from the browser Geolocation API when
// available (see app/worker/check-in-out-button.tsx) - the TimeEntry model
// already had these columns scaffolded, and the service layer treats a
// missing location as LOCATION_UNAVAILABLE rather than blocking check-in,
// since Phase 1 MVP is manual check-in with GPS verification layered on top
// rather than required.
export const checkInSchema = z.object({
  assignmentId: z.string().min(1, "A shift assignment is required."),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  accuracy: z.coerce.number().min(0).optional(),
});
export type CheckInInput = z.infer<typeof checkInSchema>;

// Validates the worker-facing check-out form. Same optional GPS fields as
// check-in, recorded for audit purposes on check-out.
export const checkOutSchema = z.object({
  assignmentId: z.string().min(1, "A shift assignment is required."),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});
export type CheckOutInput = z.infer<typeof checkOutSchema>;

// Validates the admin-facing hour approval form.
export const approveTimeEntrySchema = z.object({
  timeEntryId: z.string().min(1, "A time entry is required."),
});
export type ApproveTimeEntryInput = z.infer<typeof approveTimeEntrySchema>;
