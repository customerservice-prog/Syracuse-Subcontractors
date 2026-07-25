import { z } from "zod";

// Validates the worker-facing check-in form.
export const checkInSchema = z.object({
  assignmentId: z.string().min(1, "A shift assignment is required."),
});
export type CheckInInput = z.infer<typeof checkInSchema>;

// Validates the worker-facing check-out form.
export const checkOutSchema = z.object({
  assignmentId: z.string().min(1, "A shift assignment is required."),
});
export type CheckOutInput = z.infer<typeof checkOutSchema>;

// Validates the admin-facing hour approval form.
export const approveTimeEntrySchema = z.object({
  timeEntryId: z.string().min(1, "A time entry is required."),
});
export type ApproveTimeEntryInput = z.infer<typeof approveTimeEntrySchema>;
