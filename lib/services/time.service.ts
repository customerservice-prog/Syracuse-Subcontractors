import { db } from "@/lib/db";
import type { ActingUser } from "@/lib/authz/policies";
import { canCheckInOutAssignment, canApproveTimeEntry } from "@/lib/authz/policies";
import { notify, getAdminRecipients } from "@/lib/services/notification.service";

export class ForbiddenError extends Error {}
export class InvalidTimeEntryStateError extends Error {}

// MVP default geofence radius used until a per-job or per-position radius
// setting is exposed in the UI - the schema's geofenceRadiusMeters column on
// TimeEntry already supports a per-entry value, this is just the constant
// used to populate it today.
const DEFAULT_GEOFENCE_RADIUS_METERS = 300;

export type GeoInput = { lat?: number; lng?: number; accuracy?: number };

// Standard great-circle distance between two lat/lng points, in meters.
function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

// Compares a captured browser location against the job's site coordinates.
// Never blocks check-in - a missing location or missing job coordinates is
// simply recorded as a distinct result so admins can see why a check-in
// wasn't location-verified, rather than silently failing. This is the "GPS
// geofence verification" scaffold called out in docs/PHASE1-DESIGN.md,
// layered on top of the existing manual-tap check-in flow.
function evaluateGeofence(
  geo: GeoInput | undefined,
  jobLat: number | null,
  jobLng: number | null
): { result: string; radiusMeters: number } {
  const radiusMeters = DEFAULT_GEOFENCE_RADIUS_METERS;
  if (!geo || geo.lat === undefined || geo.lng === undefined) {
    return { result: "LOCATION_UNAVAILABLE", radiusMeters };
  }
  if (jobLat === null || jobLng === null) {
    return { result: "NO_JOB_LOCATION", radiusMeters };
  }
  const distanceMeters = haversineDistanceMeters(geo.lat, geo.lng, jobLat, jobLng);
  return { result: distanceMeters <= radiusMeters ? "WITHIN_RANGE" : "OUT_OF_RANGE", radiusMeters };
}

// Worker check-in for a confirmed shift assignment. Phase 1 MVP is a manual
// check-in (a single tap on the worker dashboard) with an optional
// browser-captured GPS location layered on top - a missing or denied
// location never blocks check-in, it is just recorded as
// LOCATION_UNAVAILABLE so this degrades gracefully on devices/browsers
// without geolocation support. Device and server timestamps are both
// recorded from day one so a future device-vs-server clock mismatch can be
// audited.
export async function checkIn(actingUser: ActingUser, assignmentId: string, geo?: GeoInput) {
  const assignment = await db.shiftAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: { timeEntry: true, position: { include: { shift: { include: { job: true } } } } },
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

  const job = assignment.position.shift.job;
  const geofence = evaluateGeofence(geo, job.latitude, job.longitude);

  return db.$transaction(async (tx) => {
    const now = new Date();
    const timeEntry = await tx.timeEntry.create({
      data: {
        assignmentId,
        status: "CHECKED_IN",
        checkInDeviceAt: now,
        checkInServerAt: now,
        checkInLat: geo?.lat ?? null,
        checkInLng: geo?.lng ?? null,
        checkInAccuracy: geo?.accuracy ?? null,
        geofenceRadiusMeters: geofence.radiusMeters,
        geofenceResult: geofence.result,
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
        reason: `Geofence result: ${geofence.result}.`,
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
// list is real from day one. Check-out location (if available) is recorded
// alongside the existing check-in geofence result for a fuller audit trail.
export async function checkOut(actingUser: ActingUser, assignmentId: string, geo?: GeoInput) {
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
        checkOutLat: geo?.lat ?? null,
        checkOutLng: geo?.lng ?? null,
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
