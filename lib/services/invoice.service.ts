import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ActingUser } from "@/lib/authz/policies";
import { canGenerateInvoice, canManageInvoiceStatus } from "@/lib/authz/policies";
import type {
  GenerateInvoiceInput,
  AddInvoiceAdjustmentInput,
  TransitionInvoiceStatusInput,
} from "@/lib/validation/invoice.schema";
import type { InvoiceStatus } from "@prisma/client";

export class ForbiddenError extends Error {}
export class InvalidInvoiceStateError extends Error {}

// Invoice status state machine. Kept intentionally conservative for the
// MVP - a DRAFT can be voided or sent, and once SENT it can only move
// forward toward being paid (or disputed/voided), never silently back to
// DRAFT. PAID and VOID are terminal. See docs/PHASE1-DESIGN.md.
const ALLOWED_INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ["SENT", "VOID"],
  SENT: ["VIEWED", "PARTIALLY_PAID", "PAID", "OVERDUE", "DISPUTED", "VOID"],
  VIEWED: ["PARTIALLY_PAID", "PAID", "OVERDUE", "DISPUTED", "VOID"],
  PARTIALLY_PAID: ["PAID", "OVERDUE", "DISPUTED", "VOID"],
  OVERDUE: ["PARTIALLY_PAID", "PAID", "DISPUTED", "VOID"],
  DISPUTED: ["SENT", "VOID"],
  PAID: [],
  VOID: [],
};

// Generates a single new DRAFT invoice for a contractor from every
// COMPLETED shift assignment with APPROVED hours that has not already been
// billed on a prior invoice. Each line item snapshots the
// contractorBillRateSnapshot already stored on the assignment - never the
// worker pay rate, since contractors are never shown what workers are paid
// (see canViewWorkerPrivateDocuments). Always produces a DRAFT; a human
// always reviews and explicitly marks it SENT - invoices are never
// auto-sent. No real payment processing happens here - see
// docs/PHASE1-DESIGN.md's "scaffold Stripe cleanly, do not process real
// payments yet" requirement; PaymentRecord.provider defaults to "mock".
export async function generateInvoiceForContractor(
  actingUser: ActingUser,
  input: GenerateInvoiceInput
) {
  const policyResult = canGenerateInvoice(actingUser, { contractorId: input.contractorId });
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }

  const alreadyInvoiced = await db.invoiceLineItem.findMany({
    where: { assignmentId: { not: null }, invoice: { contractorId: input.contractorId } },
    select: { assignmentId: true },
  });
  const alreadyInvoicedIds = alreadyInvoiced.map((li) => li.assignmentId as string);

  const assignments = await db.shiftAssignment.findMany({
    where: {
      status: "COMPLETED",
      ...(alreadyInvoicedIds.length ? { id: { notIn: alreadyInvoicedIds } } : {}),
      position: { shift: { job: { contractorId: input.contractorId } } },
      timeEntry: { status: "APPROVED" },
    },
    include: {
      workerProfile: { include: { application: true } },
      position: { include: { shift: { include: { job: true } } } },
      timeEntry: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (assignments.length === 0) {
    throw new InvalidInvoiceStateError(
      "There are no newly approved hours for this contractor to invoice yet."
    );
  }

  return db.$transaction(async (tx) => {
    const invoiceCount = await tx.invoice.count();
    const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(5, "0")}`;

    const lineItemsData = assignments.map((assignment) => {
      const entry = assignment.timeEntry!;
      const hours =
        entry.checkInServerAt && entry.checkOutServerAt
          ? Math.max(
              0,
              (entry.checkOutServerAt.getTime() - entry.checkInServerAt.getTime()) / (1000 * 60 * 60) -
                entry.breakMinutes / 60
            )
          : 0;
      const application = assignment.workerProfile.application;
      const job = assignment.position.shift.job;
      const quantity = new Prisma.Decimal(hours.toFixed(2));
      const rate = assignment.contractorBillRateSnapshot;
      const amount = quantity.mul(rate);
      return {
        assignmentId: assignment.id,
        description: `${application.firstName} ${application.lastName} - ${job.address} (${assignment.position.shift.shiftDate
          .toISOString()
          .slice(0, 10)})`,
        quantity,
        rate,
        amount,
        lineType: "LABOR",
      };
    });

    const subtotal = lineItemsData.reduce(
      (sum, li) => sum.add(li.amount),
      new Prisma.Decimal(0)
    );

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        contractorId: input.contractorId,
        status: "DRAFT",
        subtotal,
        total: subtotal,
        lineItems: { createMany: { data: lineItemsData } },
      },
    });

    await tx.invoiceStatusHistory.create({
      data: { invoiceId: invoice.id, toStatus: "DRAFT" },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: actingUser.id,
        actorRole: actingUser.role,
        action: "GENERATE_INVOICE",
        entityType: "Invoice",
        entityPublicId: invoice.id,
        reason: `Generated from ${assignments.length} approved shift assignment(s).`,
      },
    });

    return tx.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      include: { lineItems: true },
    });
  });
}

// Adds a manual adjustment (fee, discount, correction) to a still-DRAFT
// invoice and recalculates its total. Adjustments are append-only for audit
// purposes - a mistaken adjustment is corrected with an offsetting
// adjustment, never edited or deleted.
export async function addInvoiceAdjustment(
  actingUser: ActingUser,
  input: AddInvoiceAdjustmentInput
) {
  const invoice = await db.invoice.findUniqueOrThrow({ where: { id: input.invoiceId } });

  const policyResult = canManageInvoiceStatus(actingUser, { contractorId: invoice.contractorId });
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }
  if (invoice.status !== "DRAFT") {
    throw new InvalidInvoiceStateError("Adjustments can only be added while an invoice is still a draft.");
  }

  return db.$transaction(async (tx) => {
    await tx.invoiceAdjustment.create({
      data: {
        invoiceId: invoice.id,
        amount: input.amount,
        reason: input.reason,
        createdBy: actingUser.id,
      },
    });

    const updated = await tx.invoice.update({
      where: { id: invoice.id },
      data: { total: invoice.total.add(input.amount) },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: actingUser.id,
        actorRole: actingUser.role,
        action: "ADD_INVOICE_ADJUSTMENT",
        entityType: "Invoice",
        entityPublicId: invoice.id,
        reason: input.reason,
      },
    });

    return updated;
  });
}

// Moves an invoice to a new status, enforcing the state machine above.
// Marking an invoice PAID here only records a mock PaymentRecord - no real
// money moves until a real payment provider is integrated.
export async function transitionInvoiceStatus(
  actingUser: ActingUser,
  input: TransitionInvoiceStatusInput
) {
  const invoice = await db.invoice.findUniqueOrThrow({ where: { id: input.invoiceId } });

  const policyResult = canManageInvoiceStatus(actingUser, { contractorId: invoice.contractorId });
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }

  const allowedNext = ALLOWED_INVOICE_TRANSITIONS[invoice.status] ?? [];
  if (!allowedNext.includes(input.toStatus)) {
    throw new InvalidInvoiceStateError(
      `An invoice cannot move from ${invoice.status} to ${input.toStatus}.`
    );
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: input.toStatus,
        finalizedAt: input.toStatus === "SENT" && !invoice.finalizedAt ? new Date() : invoice.finalizedAt,
      },
    });

    if (input.toStatus === "PAID") {
      await tx.paymentRecord.create({
        data: {
          invoiceId: invoice.id,
          provider: "mock",
          amount: invoice.total,
          status: "SUCCEEDED",
        },
      });
    }

    await tx.invoiceStatusHistory.create({
      data: { invoiceId: invoice.id, fromStatus: invoice.status, toStatus: input.toStatus },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: actingUser.id,
        actorRole: actingUser.role,
        action: "TRANSITION_INVOICE_STATUS",
        entityType: "Invoice",
        entityPublicId: invoice.id,
        beforeJson: { status: invoice.status },
        afterJson: { status: input.toStatus },
      },
    });

    return updated;
  });
}

// Groups approved-but-not-yet-invoiced completed assignments by contractor,
// for the admin dashboard's "generate invoice" section - shows which
// contractors currently have billable hours waiting.
export async function listContractorsWithUninvoicedApprovedHours() {
  const alreadyInvoiced = await db.invoiceLineItem.findMany({
    where: { assignmentId: { not: null } },
    select: { assignmentId: true },
  });
  const alreadyInvoicedIds = alreadyInvoiced.map((li) => li.assignmentId as string);

  const assignments = await db.shiftAssignment.findMany({
    where: {
      status: "COMPLETED",
      ...(alreadyInvoicedIds.length ? { id: { notIn: alreadyInvoicedIds } } : {}),
      timeEntry: { status: "APPROVED" },
    },
    include: {
      position: { include: { shift: { include: { job: { include: { contractor: true } } } } } },
    },
  });

  const byContractor = new Map<
    string,
    { contractorId: string; companyName: string; assignmentCount: number }
  >();
  for (const assignment of assignments) {
    const contractor = assignment.position.shift.job.contractor;
    const existing = byContractor.get(contractor.id);
    if (existing) {
      existing.assignmentCount += 1;
    } else {
      byContractor.set(contractor.id, {
        contractorId: contractor.id,
        companyName: contractor.companyName,
        assignmentCount: 1,
      });
    }
  }
  return Array.from(byContractor.values());
}

// Read-heavy list for the admin dashboard's invoicing section.
export async function listInvoicesForAdmin() {
  return db.invoice.findMany({
    orderBy: { createdAt: "desc" },
    include: { contractor: true, lineItems: true, adjustments: true },
    take: 50,
  });
}

// Read-heavy list for the contractor dashboard - scoped to the contractor's
// own invoices only. Callers must already have verified the acting user
// belongs to this contractorId (see app/contractor/page.tsx), matching the
// existing convention used by listJobsForAdmin/job requests on that page.
export async function listInvoicesForContractor(contractorId: string) {
  return db.invoice.findMany({
    where: { contractorId },
    orderBy: { createdAt: "desc" },
    include: { lineItems: true, adjustments: true },
  });
}
