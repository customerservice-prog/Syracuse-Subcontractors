import { z } from "zod";

// Validates the admin/dispatcher form that converts a JobRequest into a
// schedulable Job with one Shift and N open ShiftPositions. Pay/bill rates
// are captured here and snapshotted onto every position created, per
// docs/PHASE1-DESIGN.md, so later rate changes never retroactively affect
// positions or assignments already created from this conversion.
export const convertJobRequestSchema = z.object({
  jobRequestId: z.string(),
  supervisorName: z.string().max(200).optional(),
  supervisorPhone: z.string().max(20).optional(),
  parkingNotes: z.string().max(1000).optional(),
  safetyInstructions: z.string().max(2000).optional(),
  weatherNotes: z.string().max(1000).optional(),
  workerPayRate: z.coerce.number().positive("Worker pay rate must be greater than zero."),
  contractorBillRate: z.coerce.number().positive("Contractor bill rate must be greater than zero."),
});

export type ConvertJobRequestInput = z.infer<typeof convertJobRequestSchema>;
