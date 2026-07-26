import { db } from "@/lib/db";
import type { ActingUser } from "@/lib/authz/policies";
import { canApproveContractor, canModifyContractor, canViewJobRequest } from "@/lib/authz/policies";
import type {
  ContractorInterestInput,
  JobRequestInput,
  ContractorApprovalInput,
} from "@/lib/validation/contractor.schema";
import { notify, getAdminRecipients } from "@/lib/services/notification.service";

export class ForbiddenError extends Error {}

export async function submitContractorInterest(input: ContractorInterestInput) {
  return db.contractorInterest.create({ data: input });
}

export async function approveContractorInterest(
  actingUser: ActingUser,
  input: ContractorApprovalInput
) {
  const policyResult = canApproveContractor(actingUser, { contractorId: input.contractorInterestId });
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }
  return db.$transaction(async (tx) => {
    const contractor = await tx.contractor.create({
      data: {
        companyName: input.companyName,
        status: "APPROVED",
        interestId: input.contractorInterestId,
      },
    });
    const token = crypto.randomUUID();
    const invite = await tx.contractorInvite.create({
      data: {
        contractorId: contractor.id,
        token,
        email: input.inviteEmail,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: actingUser.id,
        actorRole: actingUser.role,
        action: "APPROVE_CONTRACTOR",
        entityType: "Contractor",
        entityPublicId: contractor.id,
        reason: "Contractor interest approved by admin.",
      },
    });
    return { contractor, invite };
  });
}

// Records a new job request for dispatcher review, then notifies every
// admin/dispatcher so the "new worker request"-style event from
// docs/PHASE1-DESIGN.md's notification list is real from day one - the
// email/SMS providers are mock (log-only) until real credentials are
// configured, but the event/recipient/delivery-attempt records are not.
export async function submitJobRequest(actingUser: ActingUser, input: JobRequestInput) {
  const policyResult = canViewJobRequest(actingUser, { contractorId: input.contractorId });
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }
  const jobRequest = await db.jobRequest.create({
    data: {
      contractorId: input.contractorId,
      jobType: input.jobType,
      requestedWorkerCount: input.requestedWorkerCount,
      requestedDate: input.requestedDate,
      requestedStartTime: input.requestedStartTime,
      requestedEndTime: input.requestedEndTime,
      jobsiteAddress: input.jobsiteAddress,
      notes: input.notes,
      status: "SUBMITTED",
    },
  });

  await notify({
    type: "NEW_JOB_REQUEST",
    entityType: "JobRequest",
    entityId: jobRequest.id,
    payload: { contractorId: input.contractorId, jobType: input.jobType },
    recipients: await getAdminRecipients(),
  });

  return jobRequest;
}

export async function updateContractorRecord(
  actingUser: ActingUser,
  input: {
    contractorId: string;
    companyName?: string;
    status?: "LEAD" | "PENDING_REVIEW" | "APPROVED" | "SUSPENDED" | "REJECTED";
  }
) {
  const policyResult = canModifyContractor(actingUser, { contractorId: input.contractorId });
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }
  return db.contractor.update({
    where: { id: input.contractorId },
    data: { companyName: input.companyName, status: input.status },
  });
}
