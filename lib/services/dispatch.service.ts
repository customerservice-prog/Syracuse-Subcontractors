import { db } from "@/lib/db";
import type { ActingUser } from "@/lib/authz/policies";
import { canDispatchPosition, canRespondToOffer } from "@/lib/authz/policies";

export class ForbiddenError extends Error {}
export class InvalidDispatchStateError extends Error {}

const OFFER_WINDOW_HOURS = 2;

// Creates the actual Offer row plus its position/notification side effects.
// This is intentionally NOT policy-checked or exported - it is the shared
// mechanics used both by the admin-triggered sendOfferToWorker (which does
// check the dispatch policy) and by the automated auto-reoffer-on-decline
// path (which is a system action, not a direct user request).
async function createOfferRecord(input: {
  positionId: string;
  workerProfileId: string;
  waveNumber: number;
}) {
  const expiresAt = new Date(Date.now() + OFFER_WINDOW_HOURS * 60 * 60 * 1000);

  return db.$transaction(async (tx) => {
    const offer = await tx.offer.create({
      data: {
        positionId: input.positionId,
        workerProfileId: input.workerProfileId,
        status: "SENT",
        dispatchStrategy: "SEQUENTIAL",
        waveNumber: input.waveNumber,
        sentAt: new Date(),
        expiresAt,
        deliveryMethod: "IN_APP",
      },
    });

    await tx.shiftPosition.update({
      where: { id: input.positionId },
      data: { status: "OFFERED" },
    });

    const event = await tx.notificationEvent.create({
      data: {
        type: "JOB_OFFER",
        entityType: "Offer",
        entityId: offer.id,
        payload: { positionId: input.positionId, waveNumber: input.waveNumber },
      },
    });
    await tx.notificationRecipient.create({
      data: { eventId: event.id, workerProfileId: input.workerProfileId },
    });

    return offer;
  });
}

// Runs matching and returns ranked candidates for an admin/dispatcher to
// review before sending an offer. Never sends an offer itself - "do not
// blast every worker at once" means sending is always a separate, explicit,
// reviewable step (see docs/PHASE1-DESIGN.md).
export async function findCandidatesForPosition(actingUser: ActingUser, positionId: string) {
  const { runMatchingForPosition } = await import("@/lib/services/matching.service");
  return runMatchingForPosition(actingUser, positionId);
}

// Sends a single wave-N offer to one worker for one position. Only
// admins/dispatchers may call this directly; the wave number is computed
// from how many offers already exist for the position so manual sends and
// auto-reoffers share one continuous sequence.
export async function sendOfferToWorker(
  actingUser: ActingUser,
  input: { positionId: string; workerProfileId: string }
) {
  const policyResult = canDispatchPosition(actingUser, { positionId: input.positionId });
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }

  const position = await db.shiftPosition.findUniqueOrThrow({ where: { id: input.positionId } });
  if (position.status !== "OPEN" && position.status !== "OFFERED") {
    throw new InvalidDispatchStateError("This position is no longer open for offers.");
  }

  const existingOfferCount = await db.offer.count({ where: { positionId: input.positionId } });

  const offer = await createOfferRecord({
    positionId: input.positionId,
    workerProfileId: input.workerProfileId,
    waveNumber: existingOfferCount + 1,
  });

  await db.auditLog.create({
    data: {
      actorUserId: actingUser.id,
      actorRole: actingUser.role,
      action: "SEND_OFFER",
      entityType: "Offer",
      entityPublicId: offer.id,
      reason: `Offer sent to worker ${input.workerProfileId} for position ${input.positionId}.`,
    },
  });

  return offer;
}

// Worker accepts an offer: fills the position with a ShiftAssignment,
// supersedes any other pending offers on the same position, and records a
// positive reliability event. Pay/bill rates are snapshotted from the
// position onto the assignment per docs/PHASE1-DESIGN.md, so later rate
// changes never retroactively affect this assignment.
export async function acceptOffer(actingUser: ActingUser, offerId: string) {
  const offer = await db.offer.findUniqueOrThrow({
    where: { id: offerId },
    include: { position: true },
  });

  const policyResult = canRespondToOffer(actingUser, { workerProfileId: offer.workerProfileId });
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }
  if (offer.status !== "SENT" && offer.status !== "VIEWED") {
    throw new InvalidDispatchStateError("This offer is no longer available to accept.");
  }
  if (offer.expiresAt && offer.expiresAt < new Date()) {
    throw new InvalidDispatchStateError("This offer has expired.");
  }

  return db.$transaction(async (tx) => {
    await tx.offer.update({
      where: { id: offerId },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });

    await tx.offer.updateMany({
      where: {
        positionId: offer.positionId,
        id: { not: offerId },
        status: { in: ["QUEUED", "SENT", "VIEWED"] },
      },
      data: { status: "POSITION_FILLED", respondedAt: new Date() },
    });

    const assignment = await tx.shiftAssignment.create({
      data: {
        positionId: offer.positionId,
        workerProfileId: offer.workerProfileId,
        status: "CONFIRMED",
        workerPayRateSnapshot: offer.position.workerPayRateSnapshot,
        contractorBillRateSnapshot: offer.position.contractorBillRateSnapshot,
      },
    });

    await tx.shiftPosition.update({
      where: { id: offer.positionId },
      data: { status: "FILLED" },
    });

    await tx.reliabilityEvent.create({
      data: {
        workerProfileId: offer.workerProfileId,
        type: "OFFER_ACCEPTED",
        relatedOfferId: offer.id,
        relatedAssignmentId: assignment.id,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: actingUser.id,
        actorRole: actingUser.role,
        action: "ACCEPT_OFFER",
        entityType: "Offer",
        entityPublicId: offer.id,
      },
    });

    return assignment;
  });
}

// Worker declines an offer. Records a reliability event, reopens the
// position, and automatically re-offers to the next-ranked eligible
// candidate from the same matching run who has not already been offered
// this position - "auto-reoffer to next qualified worker on decline/expiry"
// per docs/PHASE1-DESIGN.md. If no further eligible candidates remain, the
// position simply stays OPEN for a fresh matching run.
export async function declineOffer(actingUser: ActingUser, input: { offerId: string; reason?: string }) {
  const offer = await db.offer.findUniqueOrThrow({ where: { id: input.offerId } });

  const policyResult = canRespondToOffer(actingUser, { workerProfileId: offer.workerProfileId });
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }
  if (offer.status !== "SENT" && offer.status !== "VIEWED") {
    throw new InvalidDispatchStateError("This offer is no longer available to decline.");
  }

  await db.$transaction(async (tx) => {
    await tx.offer.update({
      where: { id: input.offerId },
      data: { status: "DECLINED", respondedAt: new Date(), declineReason: input.reason },
    });
    await tx.reliabilityEvent.create({
      data: {
        workerProfileId: offer.workerProfileId,
        type: "OFFER_DECLINED",
        relatedOfferId: offer.id,
        notes: input.reason,
      },
    });
    await tx.shiftPosition.update({
      where: { id: offer.positionId },
      data: { status: "OPEN" },
    });
  });

  await autoReofferNextCandidate(offer.positionId);
}

// Sweeps offers whose response window has passed with no worker action.
// This is the automated counterpart to declineOffer: an expired offer frees
// up its position and triggers the same next-ranked-candidate auto-reoffer,
// so an unresponsive worker never silently blocks a position forever -
// "auto-reoffer to next qualified worker on decline/expiry" per
// docs/PHASE1-DESIGN.md. Safe to call repeatedly and often (e.g. from the
// scheduled /api/cron/expire-offers route, or opportunistically on admin
// dashboard load) since it only touches offers that are actually past their
// expiresAt.
export async function expireStaleOffers() {
  const staleOffers = await db.offer.findMany({
    where: {
      status: { in: ["SENT", "VIEWED"] },
      expiresAt: { lt: new Date() },
    },
  });

  for (const offer of staleOffers) {
    await db.$transaction(async (tx) => {
      await tx.offer.update({
        where: { id: offer.id },
        data: { status: "EXPIRED", expirationReason: "Offer window closed with no worker response." },
      });
      await tx.reliabilityEvent.create({
        data: {
          workerProfileId: offer.workerProfileId,
          type: "OFFER_EXPIRED",
          relatedOfferId: offer.id,
        },
      });
      await tx.shiftPosition.update({
        where: { id: offer.positionId },
        data: { status: "OPEN" },
      });
      await tx.auditLog.create({
        data: {
          action: "EXPIRE_OFFER",
          entityType: "Offer",
          entityPublicId: offer.id,
          reason: "Offer window closed with no worker response.",
        },
      });
    });

    await autoReofferNextCandidate(offer.positionId);
  }

  return { expiredCount: staleOffers.length };
}

async function autoReofferNextCandidate(positionId: string) {
  const position = await db.shiftPosition.findUnique({ where: { id: positionId } });
  if (!position || (position.status !== "OPEN" && position.status !== "OFFERED")) return;

  const latestRun = await db.matchingRun.findFirst({
    where: { positionId },
    orderBy: { generatedAt: "desc" },
    include: { candidates: true },
  });
  if (!latestRun) return;

  const priorOffers = await db.offer.findMany({
    where: { positionId },
    select: { workerProfileId: true },
  });
  const alreadyOfferedWorkerIds = new Set(priorOffers.map((o) => o.workerProfileId));

  const next = latestRun.candidates
    .filter((c) => c.eligible && !alreadyOfferedWorkerIds.has(c.workerProfileId))
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))[0];

  if (!next) return;

  await createOfferRecord({
    positionId,
    workerProfileId: next.workerProfileId,
    waveNumber: priorOffers.length + 1,
  });
}

// Read-heavy list for the admin dashboard: every OPEN/OFFERED position with
// its job/contractor context, any currently-pending offers, and (if a
// matching run has been generated) the top ranked eligible candidates not
// yet offered this position, so an admin can review and send an offer with
// one click. Distance/reliability scoring is placeholder-neutral for now,
// as noted in matching.service.ts.
export async function listOpenPositionsForAdmin() {
  const positions = await db.shiftPosition.findMany({
    where: { status: { in: ["OPEN", "OFFERED"] } },
    include: {
      shift: { include: { job: { include: { contractor: true } } } },
      offers: { where: { status: { in: ["SENT", "VIEWED", "QUEUED"] } }, orderBy: { createdAt: "desc" } },
      requiredSkills: { include: { skill: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  return Promise.all(
    positions.map(async (position) => {
      const latestRun = await db.matchingRun.findFirst({
        where: { positionId: position.id },
        orderBy: { generatedAt: "desc" },
        include: { candidates: true },
      });

      let topCandidates: Array<{
        workerProfileId: string;
        name: string;
        rank: number | null;
        totalScore: number | null;
        alreadyOffered: boolean;
      }> = [];

      if (latestRun) {
        const priorOffers = await db.offer.findMany({
          where: { positionId: position.id },
          select: { workerProfileId: true },
        });
        const offeredWorkerIds = new Set(priorOffers.map((o) => o.workerProfileId));

        const eligible = latestRun.candidates
          .filter((c) => c.eligible)
          .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
          .slice(0, 5);

        const profiles = await db.workerProfile.findMany({
          where: { id: { in: eligible.map((c) => c.workerProfileId) } },
          include: { application: true },
        });
        const profileMap = new Map(profiles.map((p) => [p.id, p]));

        topCandidates = eligible.map((c) => {
          const profile = profileMap.get(c.workerProfileId);
          return {
            workerProfileId: c.workerProfileId,
            name: profile ? `${profile.application.firstName} ${profile.application.lastName}` : "Unknown worker",
            rank: c.rank,
            totalScore: c.totalScore,
            alreadyOffered: offeredWorkerIds.has(c.workerProfileId),
          };
        });
      }

      return {
        position,
        latestRunGeneratedAt: latestRun?.generatedAt ?? null,
        topCandidates,
      };
    })
  );
}
