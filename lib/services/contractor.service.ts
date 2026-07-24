import { db } from "@/lib/db";
import type { ActingUser } from "@/lib/authz/policies";
import { canApproveContractor, canModifyContractor, canViewJobRequest } from "@/lib/authz/policies";
import type {
  ContractorInterestInput,
  JobRequestInput,
  ContractorApprovalInput,
} from "@/lib/validation/contractor.schema";

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

export async function submitJobRequest(actingUser: ActingUser, input: JobRequestInput) {
  const policyResult = canViewJobRequest(actingUser, { contractorId: input.contractorId });
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }
  return db.jobRequest.create({
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
