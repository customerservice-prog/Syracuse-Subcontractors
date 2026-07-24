import { z } from "zod";

export const contractorInterestSchema = z.object({
  companyName: z.string().min(1).max(200),
  contactName: z.string().min(1).max(200),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(7).max(20),
  notes: z.string().max(1000).optional(),
});

export type ContractorInterestInput = z.infer<typeof contractorInterestSchema>;

export const jobRequestSchema = z.object({
  contractorId: z.string(),
  jobType: z.string().min(1).max(100),
  requestedWorkerCount: z.number().int().min(1).max(500),
  requestedDate: z.coerce.date(),
  requestedStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM 24-hour format"),
  requestedEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM 24-hour format"),
  jobsiteAddress: z.string().min(1).max(255),
  notes: z.string().max(2000).optional(),
});

export type JobRequestInput = z.infer<typeof jobRequestSchema>;

export const contractorApprovalSchema = z.object({
  contractorInterestId: z.string(),
  companyName: z.string().min(1).max(200),
  inviteEmail: z.string().email(),
});

export type ContractorApprovalInput = z.infer<typeof contractorApprovalSchema>;
