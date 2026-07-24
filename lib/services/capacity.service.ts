import { db } from "@/lib/db";
import type { SkillLevel } from "@prisma/client";

// Capacity is deliberately conservative: with no configured CapacitySetting,
// or a paused one, activation is never recommended. An admin must explicitly
// configure capacity before the system will suggest activating workers.
// This service never activates a worker itself - see canActivateWorker in
// lib/authz/policies.ts, which always requires an explicit admin action.

export type CapacityCheckResult = {
  withinCapacity: boolean;
  activeWorkerTarget: number | null;
  hardMaximum: number | null;
  currentActiveCount: number;
  recommendedActivationCount: number;
  reason: string;
};

export async function checkCapacity(input: {
  skillCategory: string;
  skillLevel?: SkillLevel;
  serviceAreaId?: string;
}): Promise<CapacityCheckResult> {
  const setting = await db.capacitySetting.findFirst({
    where: {
      skillCategory: input.skillCategory,
      skillLevel: input.skillLevel,
      serviceAreaId: input.serviceAreaId,
    },
    orderBy: { effectiveDate: "desc" },
  });

if (!setting || setting.paused) {
  return {
    withinCapacity: false,
    activeWorkerTarget: setting?.activeWorkerTarget ?? null,
    hardMaximum: setting?.hardMaximum ?? null,
    currentActiveCount: 0,
    recommendedActivationCount: 0,
    reason: setting?.paused
    ? "Applications for this skill category are currently paused by an admin."
      : "No capacity setting exists yet for this skill category; an admin must configure one before activation.",
  };
}

const currentActiveCount = await db.workerSkill.count({
  where: {
    skill: { category: input.skillCategory },
    level: input.skillLevel,
    workerProfile: { status: "ACTIVE" },
  },
});

const hardMaximum = setting.hardMaximum ?? Number.POSITIVE_INFINITY;
  const withinCapacity = currentActiveCount < hardMaximum;
  const recommendedActivationCount = setting.activeWorkerTarget
  ? Math.max(setting.activeWorkerTarget - currentActiveCount, 0)
    : 0;

return {
  withinCapacity,
  activeWorkerTarget: setting.activeWorkerTarget,
  hardMaximum: setting.hardMaximum,
  currentActiveCount,
  recommendedActivationCount,
  reason: withinCapacity
  ? "Within configured capacity."
    : "Hard maximum reached for this skill category; admin override required to activate further.",
};
}

export async function getDemandDashboardSummary() {
  const [openPositions, filledPositions, activeWorkers, waitlistedWorkers] = await Promise.all([
    db.shiftPosition.count({ where: { status: "OPEN" } }),
    db.shiftPosition.count({ where: { status: "FILLED" } }),
    db.workerProfile.count({ where: { status: "ACTIVE" } }),
    db.workerProfile.count({ where: { status: "WAITLISTED" } }),
    ]);

return {
  openPositions,
  filledPositions,
  activeWorkers,
  waitlistedWorkers,
  demandToAvailableRatio: activeWorkers > 0 ? openPositions / activeWorkers : null,
};
}
