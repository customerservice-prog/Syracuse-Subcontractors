import { z } from "zod";

export const applicationSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().min(7).max(20),
  email: z.string().email(),
  address: z.string().max(255).optional(),
  transportation: z.string().max(100).optional(),
  workRadiusMiles: z.number().int().min(0).max(200).optional(),
  referralCode: z.string().max(50).optional(),
  resumeUrl: z.string().url().optional(),
  skillCategoryIds: z.array(z.string()).min(1, "Select at least one preferred skill category"),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

export const applicationStatusTransitionSchema = z.object({
  applicationId: z.string(),
  toStatus: z.enum([
    "SUBMITTED",
    "UNDER_REVIEW",
    "WAITLISTED",
    "INTERVIEW_REQUESTED",
    "DOCUMENTS_REQUESTED",
    "APPROVED",
    "ACTIVATED",
    "REJECTED",
    "WITHDRAWN",
    "ARCHIVED",
    ]),
  reason: z.string().max(500).optional(),
});

export type ApplicationStatusTransitionInput = z.infer<typeof applicationStatusTransitionSchema>;
