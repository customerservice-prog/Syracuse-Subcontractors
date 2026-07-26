import { db } from "@/lib/db";
import type { ActingUser } from "@/lib/authz/policies";
import { canCheckInOutAssignment, canApproveTimeEntry } from "@/lib/authz/policies";
import { notify, getAdminRecipients } from "@/lib/services/notification.service";

export class ForbiddenError extends Error {}
export class InvalidTimeEntryStateError extends Error {}

// Worker check-in for a confirmed shift assignment. Phase 1 MVP is manual
// check-in only (a single tap on the worker dashboard) - the TimeEntry model
// already has GPS/geofence/QR columns (checkInLat, checkInLng,
// geofenceRadiusMeters, geofenceResult, qrValidationResult) so real
// GPS-verified or QR-code check-in can be layered on later without a schema
// change, per docs/PHASE1-DESIGN.md. Device and server timestamps are both
// recorded from day one so a future device-vs-server clock mismatch can be
// audited.
export async function checkIn(actingUser: ActingUser, assignmentId: string) {
  const assignment = await db.shiftAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: { timeEntry: true },
  });

  const policyResult = canCheckInOutAssignment(actingUser, { workerProfileId: assignment.workerProfileId });
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }
  if (assignment.status !== "CONFIRMED" && assignment.status !== "PENDING") {
    throw new InvalidTimeEntryStateError("This assignment is not in a state that allows check-in.");
  }
  if (assignment.timeEntry) {
    throw new InvalidTimeEntryStateError("A time entry already exists for this assignment.");
  }

  return db.$transaction(async (tx) => {
    const now = new Date();
    const timeEntry = await tx.timeEntry.create({
      data: {
        assignmentId,
        status: "CHECKED_IN",
        checkInDeviceAt: now,
        checkInServerAt: now,
      },
    });

    await tx.shiftAssignment.update({
      where: { id: assignmentId },
      data: { status: "ACTIVE" },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: actingUser.id,
        actorRole: actingUser.role,
        action: "CHECK_IN",
        entityType: "TimeEntry",
        entityPublicId: timeEntry.id,
      },
    });

    return timeEntry;
  });
}

// Worker check-out from an active shift assignment. Moves the time entry to
// PENDING_APPROVAL - hours are never auto-approved; an admin or the owning
// contractor's staff must approve them (see approveTimeEntry below), per the
// "approve hours" requirement in docs/PHASE1-DESIGN.md. Admins/dispatchers
// are notified so the "hours awaiting approval" event from the notification
// list is real from day one.
export async function checkOut(actingUser: ActingUser, assignmentId: string) {
  const assignment = await db.shiftAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: { timeEntry: true },
  });

  const policyResult = canCheckInOutAssignment(actingUser, { workerProfileId: assignment.workerProfileId });
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }
  if (!assignment.timeEntry || assignment.timeEntry.status !== "CHECKED_IN") {
    throw new InvalidTimeEntryStateError("This assignment does not have an active check-in to check out of.");
  }

  const timeEntry = await db.$transaction(async (tx) => {
    const now = new Date();
    const updated = await tx.timeEntry.update({
      where: { id: assignment.timeEntry!.id },
      data: {
        status: "PENDING_APPROVAL",
        checkOutDeviceAt: now,
        checkOutServerAt: now,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: actingUser.id,
        actorRole: actingUser.role,
        action: "CHECK_OUT",
        entityType: "TimeEntry",
        entityPublicId: updated.id,
      },
    });

    return updated;
  });

  await notify({
    type: "HOURS_AWAITING_APPROVAL",
    entityType: "TimeEntry",
    entityId: timeEntry.id,
    payload: { assignmentId },
    recipients: await getAdminRecipients(),
  });

  return timeEntry;
}

// Admin/dispatcher (or eventually the owning contractor's staff) approves
// worked hours for a completed time entry. Approving marks the
// ShiftAssignment COMPLETED and records a positive reliability event -
// "completed shifts" is one of the reliability inputs listed in
// docs/PHASE1-DESIGN.md. Manual time adjustment (with reason + approval
// history) is scaffolded in the schema via TimeAdjustment but not yet
// exposed in the UI.
export async function approveTimeEntry(actingUser: ActingUser, timeEntryId: string) {
  const timeEntry = await db.timeEntry.findUniqueOrThrow({
    where: { id: timeEntryId },
    include: {
      assignment: { include: { position: { include: { shift: { include: { job: true } } } } } },
    },
  });

  const contractorId = timeEntry.assignment.position.shift.job.contractorId;
  const policyResult = canApproveTimeEntry(actingUser, { contractorId });
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }
  if (timeEntry.status !== "PENDING_APPROVAL") {
    throw new InvalidTimeEntryStateError("This time entry is not awaiting approval.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.timeEntry.update({
      where: { id: timeEntryId },
      data: { status: "APPROVED" },
    });

    await tx.shiftAssignment.update({
      where: { id: timeEntry.assignmentId },
      data: { status: "COMPLETED", endedAt: new Date() },
    });

    await tx.reliabilityEvent.create({
      data: {
        workerProfileId: timeEntry.assignment.workerProfileId,
        type: "SHIFT_COMPLETED",
        relatedAssignmentId: timeEntry.assignmentId,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: actingUser.id,
        actorRole: actingUser.role,
        action: "APPROVE_HOURS",
        entityType: "TimeEntry",
        entityPublicId: updated.id,
      },
    });

    return updated;
  });
}

// Read-heavy list for the admin dashboard: every time entry awaiting hour
// approval, with worker/job context and computed worked hours (checkout
// minus check-in), so an admin can approve with one click.
export async function listTimeEntriesAwaitingApproval() {
  const timeEntries = await db.timeEntry.findMany({
    where: { status: "PENDING_APPROVAL" },
    include: {
      assignment: {
        include: {
          workerProfile: { include: { application: true } },
          position: { include: { shift: { include: { job: { include: { contractor: true } } } } } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return timeEntries.map((entry) => {
    const hoursWorked =
      entry.checkInServerAt && entry.checkOutServerAt
        ? (entry.checkOutServerAt.getTime() - entry.checkInServerAt.getTime()) / (1000 * 60 * 60)
        : null;
    return { timeEntry: entry, hoursWorked };
  });
}
