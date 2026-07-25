import { z } from "zod";
import type { InvoiceStatus } from "@prisma/client";

// Validates the admin-facing "generate invoice" action, which turns every
// APPROVED and not-yet-invoiced completed shift assignment for a contractor
// into a single new DRAFT invoice. See lib/services/invoice.service.ts.
export const generateInvoiceSchema = z.object({
  contractorId: z.string().min(1, "A contractor is required."),
});
export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;

// Validates a manual invoice adjustment (fee, discount, correction). Amount
// may be positive or negative but never zero - a zero adjustment is not a
// real adjustment and a reason is always required for the audit trail.
export const addInvoiceAdjustmentSchema = z.object({
  invoiceId: z.string().min(1, "An invoice is required."),
  amount: z.coerce.number().refine((value) => value !== 0, "Adjustment amount cannot be zero."),
  reason: z.string().min(1, "A reason is required for any invoice adjustment.").max(500),
});
export type AddInvoiceAdjustmentInput = z.infer<typeof addInvoiceAdjustmentSchema>;

const INVOICE_STATUSES: [InvoiceStatus, ...InvoiceStatus[]] = [
  "DRAFT",
  "SENT",
  "VIEWED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "VOID",
  "DISPUTED",
];

// Validates the admin-facing invoice status transition form. The service
// layer (lib/services/invoice.service.ts) enforces the actual allowed
// state-machine transitions - this only validates the shape of the input.
export const transitionInvoiceStatusSchema = z.object({
  invoiceId: z.string().min(1, "An invoice is required."),
  toStatus: z.enum(INVOICE_STATUSES),
});
export type TransitionInvoiceStatusInput = z.infer<typeof transitionInvoiceStatusSchema>;
