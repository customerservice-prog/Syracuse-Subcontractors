import { db } from "@/lib/db";
import type { ActingUser } from "@/lib/authz/policies";
import {
  canViewWorkerProfile,
  canViewWorkerPrivateDocuments,
  canActivateWorker,
} from "@/lib/authz/policies";
import { checkCapacity } from "@/lib/services/capacity.service";

export class ForbiddenError extends Error {}

export async function getWorkerProfile(actingUser: ActingUser, workerProfileId: string) {
  const policyResult = canViewWorkerProfile(actingUser, { workerProfileId });
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }
  return db.workerProfile.findUnique({
    where: { id: workerProfileId },
    include: { skills: { include: { skill: true } }, certifications: true },
  });
}
export async function getWorkerContractorFacingSummary(workerProfileId: string) {
  const workerProfile = await db.workerProfile.findUnique({
    where: { id: workerProfileId },
    include: { skills: { include: { skill: true } } },
  });
  if (!workerProfile) return null;
  return {
    id: workerProfile.id,
    status: workerProfile.status,
    skills: workerProfile.skills.map((s) => ({ name: s.skill.name, level: s.level })),
  };
}
export async function getWorkerPrivateDocuments(actingUser: ActingUser, workerProfileId: string) {
  const policyResult = canViewWorkerPrivateDocuments(actingUser, { workerProfileId });
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }
  return db.workerCertification.findMany({ where: { workerProfileId } });
}
export async function activateWorker(
  actingUser: ActingUser,
  input: { workerProfileId: string; skillCategory: string; overrideCapacity?: boolean }
  ) {
  const policyResult = canActivateWorker(actingUser, { workerProfileId: input.workerProfileId });
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }
  if (!input.overrideCapacity) {
    const capacity = await checkCapacity({ skillCategory: input.skillCategory });
    if (!capacity.withinCapacity) {
      throw new Error(`Activation blocked by capacity settings: ${capacity.reason}`);
    }
  }
  return db.$transaction(async (tx) => {
    const workerProfile = await tx.workerProfile.update({
      where: { id: input.workerProfileId },
      data: { status: "ACTIVE" },
    });
    await tx.application.update({
      where: { id: workerProfile.applicationId },
      data: { status: "ACTIVATED" },
    });
    await tx.applicationStatusHistory.create({
      data: {
        applicationId: workerProfile.applicationId,
        toStatus: "ACTIVATED",
        reason: "Worker activated by admin based on demand/capacity.",
        actorUserId: actingUser.id,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: actingUser.id,
        actorRole: actingUser.role,
        action: "ACTIVATE_WORKER",
        entityType: "WorkerProfile",
  entityPublicId: workerProfile.id,
        reason: "Admin-approved activation.",
      },
    });
    return workerProfile;
  });
}
export async function suspendWorker(
  actingUser: ActingUser,
  input: { workerProfileId: string; reason: string }
  ) {
  const policyResult = canActivateWorker(actingUser, { workerProfileId: input.workerProfileId });
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }
  return db.$transaction(async (tx) => {
    const workerProfile = await tx.workerProfile.update({
      where: { id: input.workerProfileId },
      data: { status: "SUSPENDED" },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: actingUser.id,
        actorRole: actingUser.role,
        action: "SUSPEND_WORKER",
        entityType: "WorkerProfile",
        entityPublicId: workerProfile.id,
        reason: input.reason,
      },
    });
    return workerProfile;
  });
}
