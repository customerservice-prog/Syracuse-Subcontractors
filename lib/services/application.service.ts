import { db } from "@/lib/db";
import type { ApplicationStatus } from "@prisma/client";
import type { ActingUser } from "@/lib/authz/policies";
import { canManageApplicationLifecycle } from "@/lib/authz/policies";
import type { ApplicationInput } from "@/lib/validation/application.schema";

// Allowed application status transitions, enforced server-side, mirroring the
// state machine in docs/PHASE1-DESIGN.md. Note: the Prisma schema requires a
// WaitlistEntry to reference an existing WorkerProfile, so in this Phase 1
// implementation a WorkerProfile is created at the first transition into
// WAITLISTED, APPROVED, or ACTIVATED (whichever happens first) rather than
// only at APPROVED/ACTIVATED - this is a deliberate reconciliation of that
// schema constraint, not an accidental drift from the design doc.
const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "WITHDRAWN", "ARCHIVED"],
  UNDER_REVIEW: [
    "WAITLISTED",
    "INTERVIEW_REQUESTED",
    "DOCUMENTS_REQUESTED",
    "APPROVED",
    "REJECTED",
    "WITHDRAWN",
    "ARCHIVED",
    ],
  WAITLISTED: ["UNDER_REVIEW", "APPROVED", "REJECTED", "WITHDRAWN", "ARCHIVED"],
  INTERVIEW_REQUESTED: ["UNDER_REVIEW", "APPROVED", "REJECTED", "WITHDRAWN", "ARCHIVED"],
  DOCUMENTS_REQUESTED: ["UNDER_REVIEW", "APPROVED", "REJECTED", "WITHDRAWN", "ARCHIVED"],
  APPROVED: ["ACTIVATED", "WITHDRAWN", "ARCHIVED"],
  ACTIVATED: ["ARCHIVED"],
  REJECTED: ["ARCHIVED"],
  WITHDRAWN: ["ARCHIVED"],
  ARCHIVED: [],
};

const WORKER_PROFILE_TRIGGER_STATUSES: ApplicationStatus[] = ["WAITLISTED", "APPROVED", "ACTIVATED"];

export class InvalidApplicationTransitionError extends Error {}
export class ForbiddenError extends Error {}

// Public - no authentication required. Anyone may submit an application, but
// this never creates a WorkerProfile and never promises any work or hours.
export async function submitApplication(input: ApplicationInput) {
  return db.application.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email,
      address: input.address,
      transportation: input.transportation,
      workRadiusMiles: input.workRadiusMiles,
      referralCode: input.referralCode,
      resumeUrl: input.resumeUrl,
      status: "SUBMITTED",
      skillInterests: {
        create: input.skillCategoryIds.map((skillId) => ({ skillId })),
      },
      statusHistory: {
        create: { toStatus: "SUBMITTED", reason: "Initial application submitted." },
      },
    },
    include: { skillInterests: true },
  });
}

function workerStatusForApplicationStatus(status: ApplicationStatus) {
  if (status === "ACTIVATED") return "ACTIVE" as const;
  if (status === "APPROVED") return "APPROVED" as const;
  return "WAITLISTED" as const;
}

export async function transitionApplicationStatus(
  actingUser: ActingUser,
  input: { applicationId: string; toStatus: ApplicationStatus; reason?: string }
  ) {
  const policyResult = canManageApplicationLifecycle(actingUser);
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }

const application = await db.application.findUniqueOrThrow({
  where: { id: input.applicationId },
});

const allowedNext = ALLOWED_TRANSITIONS[application.status] ?? [];
  if (!allowedNext.includes(input.toStatus)) {
    throw new InvalidApplicationTransitionError(
      `Cannot transition application from ${application.status} to ${input.toStatus}.`
      );
  }

return db.$transaction(async (tx) => {
  const updated = await tx.application.update({
    where: { id: application.id },
    data: { status: input.toStatus },
  });

                       await tx.applicationStatusHistory.create({
                         data: {
                           applicationId: application.id,
                           fromStatus: application.status,
                           toStatus: input.toStatus,
                           reason: input.reason,
                           actorUserId: actingUser.id,
                         },
                       });

                       const existingWorkerProfile = await tx.workerProfile.findUnique({
                         where: { applicationId: application.id },
                       });

                       if (WORKER_PROFILE_TRIGGER_STATUSES.includes(input.toStatus)) {
                         const targetWorkerStatus = workerStatusForApplicationStatus(input.toStatus);
                         if (!existingWorkerProfile) {
                           await tx.user.create({
                             data: {
                               email: application.email,
                               role: "WORKER",
                               status: "PENDING_VERIFICATION",
                               workerProfile: {
                                 create: {
                                   applicationId: application.id,
                                   status: targetWorkerStatus,
                                   address: application.address,
                                   transportation: application.transportation,
                                   workRadiusMiles: application.workRadiusMiles,
                                 },
                               },
                             },
                           });
                         } else {
                           await tx.workerProfile.update({
                             where: { id: existingWorkerProfile.id },
                             data: { status: targetWorkerStatus },
                           });
                         }
                       }

                       return updated;
});
}

// Creates or updates a category-specific waitlist entry. Requires the
// application to already have a WorkerProfile (see the schema note above),
// which will exist once the application has reached WAITLISTED or later.
export async function addToWaitlist(applicationId: string, skillCategory: string, position?: number) {
  const workerProfile = await db.workerProfile.findUnique({ where: { applicationId } });
  if (!workerProfile) {
    throw new Error(
      "Application must reach WAITLISTED, APPROVED, or ACTIVATED status before a waitlist entry can be created."
      );
  }
  return db.waitlistEntry.upsert({
    where: { workerProfileId: workerProfile.id },
    create: { workerProfileId: workerProfile.id, skillCategory, position },
    update: { skillCategory, position },
  });
}

export async function getApplicationById(applicationId: string) {
  return db.application.findUnique({
    where: { id: applicationId },
    include: { skillInterests: { include: { skill: true } }, statusHistory: true },
  });
}
