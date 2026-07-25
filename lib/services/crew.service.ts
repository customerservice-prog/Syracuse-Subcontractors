import { db } from "@/lib/db";
import type { ActingUser } from "@/lib/authz/policies";
import { canManageCrews } from "@/lib/authz/policies";
import type {
  CreateCrewInput,
  AddCrewMemberInput,
  RemoveCrewMemberInput,
} from "@/lib/validation/crew.schema";

export class ForbiddenError extends Error {}

// Creates a new crew shell. Crews are admin-managed in the MVP - see
// docs/PHASE1-DESIGN.md. Membership is added separately via addCrewMember so
// that membership history (who joined/left, when, and why) is always
// preserved rather than overwritten.
export async function createCrew(actingUser: ActingUser, input: CreateCrewInput) {
  const policyResult = canManageCrews(actingUser);
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }

  const crew = await db.crew.create({
    data: { name: input.name },
  });

  await db.auditLog.create({
    data: {
      actorUserId: actingUser.id,
      actorRole: actingUser.role,
      action: "CREATE_CREW",
      entityType: "Crew",
      entityPublicId: crew.id,
    },
  });

  return crew;
}

// Adds a worker to a crew as a new CrewMembership row. Never edits or
// deletes a prior membership - see removeCrewMember for how a membership
// ends. A LEADER addition also updates Crew.leaderWorkerProfileId for quick
// display elsewhere.
export async function addCrewMember(actingUser: ActingUser, input: AddCrewMemberInput) {
  const policyResult = canManageCrews(actingUser);
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }

  const membership = await db.crewMembership.create({
    data: {
      crewId: input.crewId,
      workerProfileId: input.workerProfileId,
      role: input.role ?? "MEMBER",
    },
  });

  if (input.role === "LEADER") {
    await db.crew.update({
      where: { id: input.crewId },
      data: { leaderWorkerProfileId: input.workerProfileId },
    });
  }

  await db.auditLog.create({
    data: {
      actorUserId: actingUser.id,
      actorRole: actingUser.role,
      action: "ADD_CREW_MEMBER",
      entityType: "CrewMembership",
      entityPublicId: membership.id,
      reason: `Added to crew ${input.crewId}.`,
    },
  });

  return membership;
}

// Ends a crew membership (status -> ENDED, leftAt set) rather than deleting
// the row, preserving membership history per docs/PHASE1-DESIGN.md.
export async function removeCrewMember(actingUser: ActingUser, input: RemoveCrewMemberInput) {
  const policyResult = canManageCrews(actingUser);
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }

  const membership = await db.crewMembership.update({
    where: { id: input.crewMembershipId },
    data: { status: "ENDED", leftAt: new Date() },
  });

  await db.auditLog.create({
    data: {
      actorUserId: actingUser.id,
      actorRole: actingUser.role,
      action: "REMOVE_CREW_MEMBER",
      entityType: "CrewMembership",
      entityPublicId: membership.id,
    },
  });

  return membership;
}

// Read model for the admin dashboard: every crew with its currently-active
// members and the crew's average contractor rating (if any) - a lightweight
// "crew intelligence" view per the original requirements, without building
// out the full analytics engine yet.
export async function listCrewsForAdmin() {
  const crews = await db.crew.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        include: {
          workerProfile: { include: { application: true } },
        },
      },
      contractorRatings: true,
    },
  });

  return crews.map((crew) => {
    const avgRating =
      crew.contractorRatings.length > 0
        ? crew.contractorRatings.reduce((sum, r) => sum + r.rating, 0) / crew.contractorRatings.length
        : null;

    return {
      id: crew.id,
      name: crew.name,
      status: crew.status,
      members: crew.memberships.map((m) => ({
        membershipId: m.id,
        workerProfileId: m.workerProfileId,
        name: `${m.workerProfile.application.firstName} ${m.workerProfile.application.lastName}`,
        role: m.role,
        isPrimaryCrew: m.isPrimaryCrew,
      })),
      averageRating: avgRating,
      ratingCount: crew.contractorRatings.length,
    };
  });
}

// Lightweight list of active workers for the "add member" dropdown - avoids
// pulling in private documents/notes, per canViewWorkerPrivateDocuments.
export async function listActiveWorkersForCrewAssignment() {
  const workers = await db.workerProfile.findMany({
    where: { status: "ACTIVE" },
    include: { application: true },
    orderBy: { createdAt: "asc" },
  });

  return workers.map((w) => ({
    workerProfileId: w.id,
    name: `${w.application.firstName} ${w.application.lastName}`,
  }));
}
