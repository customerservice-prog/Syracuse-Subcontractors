import { db } from "@/lib/db";
import { notify, getAdminRecipients } from "@/lib/services/notification.service";

// Scheduled sweep for time-based notification events that no single user
// action triggers: upcoming shift reminders, no-show detection, and
// certification/document expiration warnings. Mirrors the pattern already
// established by dispatch.service.ts's expireStaleOffers - safe to call
// repeatedly and often (e.g. from a scheduler hitting
// /api/cron/send-reminders, or opportunistically on admin dashboard load)
// since each sub-sweep only touches records that have newly entered its
// trigger window. Dedup is done by checking for an existing
// NotificationEvent against the same entityId rather than adding a separate
// "reminderSentAt" column, so each event is only ever sent once. This is the
// "shift reminder", "worker no-show", and "document expiring" notification
// types called out in docs/PHASE1-DESIGN.md.

const SHIFT_REMINDER_WINDOW_HOURS = 2;
const NO_SHOW_GRACE_MINUTES = 60;
const DOCUMENT_EXPIRING_WINDOW_DAYS = 30;

// Shift date is stored as a bare DateTime and start/end time as separate
// "HH:MM" strings (see prisma/schema.prisma and app/worker/page.tsx's
// rendering of the same fields) - this combines them into one real Date so
// reminder/no-show windows can be computed.
function combineShiftStart(shiftDate: Date, startTime: string): Date {
  const [hours, minutes] = startTime.split(":").map((part) => parseInt(part, 10));
  const combined = new Date(shiftDate);
  combined.setUTCHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return combined;
}

async function alreadyNotified(type: string, entityId: string): Promise<boolean> {
  const existing = await db.notificationEvent.findFirst({
    where: { type, entityId },
    select: { id: true },
  });
  return !!existing;
}

// Notifies each worker whose upcoming, not-yet-started shift begins within
// the reminder window. One-time per assignment - once a SHIFT_REMINDER event
// exists for an assignment it is never sent again.
async function sweepShiftReminders() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + SHIFT_REMINDER_WINDOW_HOURS * 60 * 60 * 1000);

  const candidates = await db.shiftAssignment.findMany({
    where: {
      isCurrent: true,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    include: { position: { include: { shift: true } } },
  });

  let remindedCount = 0;
  for (const assignment of candidates) {
    const shiftStart = combineShiftStart(assignment.position.shift.shiftDate, assignment.position.shift.startTime);
    if (shiftStart < now || shiftStart > windowEnd) continue;
    if (await alreadyNotified("SHIFT_REMINDER", assignment.id)) continue;

    await notify({
      type: "SHIFT_REMINDER",
      entityType: "ShiftAssignment",
      entityId: assignment.id,
      payload: { positionId: assignment.positionId, shiftStart: shiftStart.toISOString() },
      recipients: [{ workerProfileId: assignment.workerProfileId }],
    });
    remindedCount++;
  }
  return remindedCount;
}

// Flags an assignment as a no-show once its shift start time plus a grace
// period has passed with the worker never having checked in (no TimeEntry at
// all). Notifies admins/dispatchers and records a negative reliability event
// - no-shows are an explicit reliability input per docs/PHASE1-DESIGN.md.
async function sweepNoShows() {
  const now = new Date();

  const candidates = await db.shiftAssignment.findMany({
    where: {
      isCurrent: true,
      status: { in: ["PENDING", "CONFIRMED"] },
      timeEntry: null,
    },
    include: { position: { include: { shift: true } } },
  });

  let noShowCount = 0;
  for (const assignment of candidates) {
    const shiftStart = combineShiftStart(assignment.position.shift.shiftDate, assignment.position.shift.startTime);
    const graceDeadline = new Date(shiftStart.getTime() + NO_SHOW_GRACE_MINUTES * 60 * 1000);
    if (graceDeadline > now) continue;

    await db.$transaction(async (tx) => {
      await tx.shiftAssignment.update({
        where: { id: assignment.id },
        data: { status: "NO_SHOW" },
      });
      await tx.reliabilityEvent.create({
        data: {
          workerProfileId: assignment.workerProfileId,
          type: "NO_SHOW",
          relatedAssignmentId: assignment.id,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "MARK_NO_SHOW",
          entityType: "ShiftAssignment",
          entityPublicId: assignment.id,
          reason: "Shift start time passed with no check-in recorded.",
        },
      });
    });

    await notify({
      type: "NO_SHOW",
      entityType: "ShiftAssignment",
      entityId: assignment.id,
      payload: { positionId: assignment.positionId, workerProfileId: assignment.workerProfileId },
      recipients: await getAdminRecipients(),
    });
    noShowCount++;
  }
  return noShowCount;
}

// Notifies both the worker and admins/dispatchers once when a verified
// certification enters its expiration window, so a lapsing certification
// doesn't silently leave a worker ineligible for positions that require it.
// One-time per certification - see alreadyNotified above.
async function sweepDocumentExpirations() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + DOCUMENT_EXPIRING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await db.workerCertification.findMany({
    where: {
      verificationStatus: "VERIFIED",
      expirationDate: { gte: now, lte: windowEnd },
    },
  });

  let expiringCount = 0;
  for (const certification of candidates) {
    if (await alreadyNotified("DOCUMENT_EXPIRING", certification.id)) continue;

    await notify({
      type: "DOCUMENT_EXPIRING",
      entityType: "WorkerCertification",
      entityId: certification.id,
      payload: {
        workerProfileId: certification.workerProfileId,
        expirationDate: certification.expirationDate?.toISOString(),
      },
      recipients: [...(await getAdminRecipients()), { workerProfileId: certification.workerProfileId }],
    });
    expiringCount++;
  }
  return expiringCount;
}

// Entry point for the scheduled sweep - runs all three sub-sweeps and
// returns counts for observability (used by the cron route's JSON response
// and the admin dashboard's opportunistic call).
export async function runReminderSweep() {
  const [remindedCount, noShowCount, expiringCount] = await Promise.all([
    sweepShiftReminders(),
    sweepNoShows(),
    sweepDocumentExpirations(),
  ]);
  return { remindedCount, noShowCount, expiringCount };
}
