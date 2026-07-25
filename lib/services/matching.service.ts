import { db } from "@/lib/db";
import type { ActingUser } from "@/lib/authz/policies";
import { canDispatchPosition } from "@/lib/authz/policies";
import type { SkillLevel } from "@prisma/client";

export class ForbiddenError extends Error {}

const CONFIG_VERSION = "v1";

const SKILL_LEVEL_ORDER: SkillLevel[] = [
  "GENERAL_LABORER",
  "EXPERIENCED_LABORER",
  "SKILLED_HELPER",
  "SKILLED_TRADESPERSON",
  "LICENSED_TRADE",
];

function skillLevelRank(level: SkillLevel): number {
  return SKILL_LEVEL_ORDER.indexOf(level);
}

// Basic Phase 2 matching for one open ShiftPosition. Finds ACTIVE workers,
// checks hard eligibility (required skills at/above minimum level, required
// certifications verified, no active offer pause), then scores eligible
// candidates and stores a MatchingRun + MatchingCandidate audit trail so
// every rank can be explained later ("show reason for each worker's rank"
// per docs/PHASE1-DESIGN.md).
//
// Distance, reliability, attendance, and prior-contractor-experience scoring
// are intentionally neutral placeholders (0.5) until GPS/reliability history
// exist - see the provider-interface notes in docs/PHASE1-DESIGN.md for how
// those plug in later without changing this function's shape.
export async function runMatchingForPosition(actingUser: ActingUser, positionId: string) {
  const policyResult = canDispatchPosition(actingUser, { positionId });
  if (!policyResult.allowed) {
    throw new ForbiddenError(policyResult.reason);
  }

  const position = await db.shiftPosition.findUniqueOrThrow({
    where: { id: positionId },
    include: {
      requiredSkills: true,
      requiredCertifications: true,
    },
  });

  const activeWorkers = await db.workerProfile.findMany({
    where: { status: "ACTIVE" },
    include: {
      skills: true,
      certifications: true,
      offerPauses: true,
    },
  });

  const now = new Date();

  const scored = activeWorkers.map((worker) => {
    const exclusionReasons: string[] = [];

    const isPaused = worker.offerPauses.some(
      (pause) => pause.startAt <= now && (!pause.endAt || pause.endAt >= now)
    );
    if (isPaused) exclusionReasons.push("Worker has paused offers.");

    const meetsSkills = position.requiredSkills.every((req) =>
      worker.skills.some(
        (s) => s.skillId === req.skillId && skillLevelRank(s.level) >= skillLevelRank(req.minimumLevel)
      )
    );
    if (!meetsSkills) exclusionReasons.push("Worker does not meet a required skill or skill level.");

    const meetsCerts = position.requiredCertifications.every((req) =>
      worker.certifications.some(
        (c) => c.certificationTypeId === req.certificationTypeId && c.verificationStatus === "VERIFIED"
      )
    );
    if (!meetsCerts) exclusionReasons.push("Worker is missing a required verified certification.");

    const eligible = exclusionReasons.length === 0;

    const skillScore = meetsSkills ? 1 : 0;
    const distanceScore = 0.5;
    const reliabilityScore = 0.5;
    const attendanceScore = 0.5;
    const priorContractorScore = 0.5;
    const totalScore = eligible
      ? skillScore * 0.4 +
        distanceScore * 0.2 +
        reliabilityScore * 0.2 +
        attendanceScore * 0.1 +
        priorContractorScore * 0.1
      : 0;

    return {
      workerProfileId: worker.id,
      eligible,
      exclusionReasons,
      totalScore,
      distanceScore,
      reliabilityScore,
      skillScore,
      attendanceScore,
      priorContractorScore,
    };
  });

  const rankedEligible = scored
    .filter((c) => c.eligible)
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((c, index) => ({ ...c, rank: index + 1 }));

  const ineligible = scored.filter((c) => !c.eligible).map((c) => ({ ...c, rank: null as number | null }));

  return db.matchingRun.create({
    data: {
      positionId,
      configVersion: CONFIG_VERSION,
      candidates: {
        create: [...rankedEligible, ...ineligible].map((c) => ({
          workerProfileId: c.workerProfileId,
          eligible: c.eligible,
          exclusionReasons: c.exclusionReasons,
          totalScore: c.totalScore,
          distanceScore: c.distanceScore,
          reliabilityScore: c.reliabilityScore,
          skillScore: c.skillScore,
          attendanceScore: c.attendanceScore,
          priorContractorScore: c.priorContractorScore,
          rank: c.rank,
        })),
      },
    },
    include: { candidates: true },
  });
}
