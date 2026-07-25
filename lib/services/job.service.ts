import { db } from "@/lib/db";
import type { ActingUser } from "@/lib/authz/policies";
import { canConvertJobRequestToJob } from "@/lib/authz/policies";
import type { ConvertJobRequestInput } from "@/lib/validation/job.schema";

export class ForbiddenError extends Error {}
export class InvalidJobRequestStateError extends Error {}

// Converts a JobRequest into a schedulable Job with one Shift and N open
// ShiftPositions (N = requestedWorkerCount). Pay/bill rates are snapshotted
// onto every position at creation time, per docs/PHASE1-DESIGN.md, so later
// rate changes never retroactively affect positions or assignments already
// created here. Matching/dispatch against these open positions is a
// follow-up phase - this only prepares the schedulable record.
export async function convertJobRequestToJob(
  actingUser: ActingUser,
  input: ConvertJobRequestInput
) {
  const jobRequest = await db.jobRequest.findUniqueOrThrow({
    where: { id: input.jobRequestId },
  });

  const policyResult = canConvertJobRequestToJob(actingUser, {
    contractorId: jobRequest.contractorId,
  });
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }

  if (jobRequest.status === "CONVERTED_TO_JOB") {
    throw new InvalidJobRequestStateError(
      "This job request has already been converted to a job."
    );
  }

  return db.$transaction(async (tx) => {
    const job = await tx.job.create({
      data: {
        jobRequestId: jobRequest.id,
        contractorId: jobRequest.contractorId,
        status: "DISPATCHING",
        address: jobRequest.jobsiteAddress,
        supervisorName: input.supervisorName,
        supervisorPhone: input.supervisorPhone,
        parkingNotes: input.parkingNotes,
        safetyInstructions: input.safetyInstructions,
        weatherNotes: input.weatherNotes,
        generalPpeRequired: [],
      },
    });

    const shift = await tx.shift.create({
      data: {
        jobId: job.id,
        shiftDate: jobRequest.requestedDate,
        startTime: jobRequest.requestedStartTime,
        endTime: jobRequest.requestedEndTime,
      },
    });

    await tx.shiftPosition.createMany({
      data: Array.from({ length: jobRequest.requestedWorkerCount }, () => ({
        shiftId: shift.id,
        status: "OPEN" as const,
        requiredToolsOwned: [],
        workerPayRateSnapshot: input.workerPayRate,
        contractorBillRateSnapshot: input.contractorBillRate,
      })),
    });

    await tx.jobRequest.update({
      where: { id: jobRequest.id },
      data: { status: "CONVERTED_TO_JOB" },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: actingUser.id,
        actorRole: actingUser.role,
        action: "CONVERT_JOB_REQUEST_TO_JOB",
        entityType: "Job",
        entityPublicId: job.id,
        reason: `Converted from job request ${jobRequest.id}.`,
      },
    });

    return tx.job.findUniqueOrThrow({
      where: { id: job.id },
      include: { shifts: { include: { positions: true } } },
    });
  });
}

// Read-heavy list for the admin dashboard's "active jobs" section - shows
// fill progress (open vs. filled positions) without exposing private worker
// data, matching the same admin-summary pattern used elsewhere.
export async function listJobsForAdmin() {
  return db.job.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      contractor: true,
      shifts: { include: { positions: true } },
    },
    take: 50,
  });
}
