// Development-only seed data for the Syracuse Labor Dispatch Platform.
// Every company, person, phone number, and email address below is fictional
// and non-deliverable. This script must never be used to load real
// customer or worker data - see docs/PHASE1-DESIGN.md for the seed plan.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Fake dev-only password shared by every seeded login. Never used outside
// local development - production accounts are created via signup/invite
// flows, never by this script.
const DEV_PASSWORD_HASH = bcrypt.hashSync("DevOnly!Passw0rd", 10);

async function upsertSkill(name: string, category: string) {
  return prisma.skill.upsert({
    where: { name },
    update: {},
    create: { name, category },
  });
}

async function upsertCert(name: string) {
  return prisma.certificationType.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

async function main() {
  console.log("Seeding Syracuse Labor Dispatch Platform (development data)...");

await prisma.market.upsert({
  where: { name: "Syracuse Metro" },
  update: {},
  create: {
    name: "Syracuse Metro",
    serviceAreas: {
      create: [
        { label: "Downtown Syracuse", postalCodes: ["13202", "13203", "13204"] },
        { label: "North Syracuse / Salina", postalCodes: ["13206", "13208", "13212"] },
        { label: "Eastwood / DeWitt", postalCodes: ["13214", "13224"] },
        ],
    },
  },
});

const generalLabor = await upsertSkill("General Labor", "general");
  const warehousePicking = await upsertSkill("Warehouse Picking", "warehouse");
  const forkliftOperation = await upsertSkill("Forklift Operation", "warehouse");
  const eventSetup = await upsertSkill("Event Setup & Teardown", "events");
  const movingLoading = await upsertSkill("Moving & Loading", "moving");
  const carpentryHelper = await upsertSkill("Carpentry Helper", "trades");
  const electricalHelper = await upsertSkill("Electrical Helper", "trades");

const osha10 = await upsertCert("OSHA 10");
  const forkliftCert = await upsertCert("Forklift Certification");

const existingCapacity = await prisma.capacitySetting.findFirst({
  where: { skillCategory: "general" },
});
  if (!existingCapacity) {
    await prisma.capacitySetting.createMany({
      data: [
        { skillCategory: "general", activeWorkerTarget: 25, hardMaximum: 40, minimumReserve: 5 },
        { skillCategory: "warehouse", activeWorkerTarget: 15, hardMaximum: 25, minimumReserve: 3 },
        { skillCategory: "trades", activeWorkerTarget: 10, hardMaximum: 20, minimumReserve: 2, paused: true },
        ],
    });
  }

// ---------- Contractors ----------
const saltCityOwnerUser = await prisma.user.upsert({
  where: { email: "owner@saltcityevents-dev.test" },
  update: {},
  create: {
    email: "owner@saltcityevents-dev.test",
    passwordHash: DEV_PASSWORD_HASH,
    role: "CONTRACTOR_OWNER",
    status: "ACTIVE",
  },
});

const platformAdminUser = await prisma.user.upsert({
  where: { email: "admin@syracuselabor-dev.test" },
  update: {},
  create: {
    email: "admin@syracuselabor-dev.test",
    passwordHash: DEV_PASSWORD_HASH,
    role: "SUPER_ADMIN",
    status: "ACTIVE",
  },
});

const saltCity = await prisma.contractor.upsert({
  where: { id: "seed-contractor-salt-city" },
  update: {},
  create: {
    id: "seed-contractor-salt-city",
    companyName: "Salt City Events LLC",
    status: "APPROVED",
  },
});

await prisma.contractorUser.upsert({
  where: { userId: saltCityOwnerUser.id },
  update: {},
  create: {
    userId: saltCityOwnerUser.id,
    contractorId: saltCity.id,
    role: "CONTRACTOR_OWNER",
  },
});

const onondagaOwnerUser = await prisma.user.upsert({
  where: { email: "owner@onondagabuilders-dev.test" },
  update: {},
  create: {
    email: "owner@onondagabuilders-dev.test",
    passwordHash: DEV_PASSWORD_HASH,
    role: "CONTRACTOR_OWNER",
    status: "ACTIVE",
  },
});

const onondaga = await prisma.contractor.upsert({
  where: { id: "seed-contractor-onondaga" },
  update: {},
  create: {
    id: "seed-contractor-onondaga",
    companyName: "Onondaga Builders Co",
    status: "APPROVED",
  },
});

await prisma.contractorUser.upsert({
  where: { userId: onondagaOwnerUser.id },
  update: {},
  create: {
    userId: onondagaOwnerUser.id,
    contractorId: onondaga.id,
    role: "CONTRACTOR_OWNER",
  },
});

const fingerLakesInterest = await prisma.contractorInterest.upsert({
  where: { id: "seed-interest-finger-lakes" },
  update: {},
  create: {
    id: "seed-interest-finger-lakes",
    companyName: "Finger Lakes Logistics",
    contactName: "R. Whitcombe",
    contactEmail: "contact@fingerlakeslogistics-dev.test",
    contactPhone: "315-555-0142",
    notes: "Submitted via public contractor interest form. Awaiting admin review.",
  },
});

await prisma.contractor.upsert({
  where: { id: "seed-contractor-finger-lakes" },
  update: {},
  create: {
    id: "seed-contractor-finger-lakes",
    companyName: "Finger Lakes Logistics",
    status: "PENDING_REVIEW",
    interestId: fingerLakesInterest.id,
  },
});

// ---------- Applicants & workers ----------
async function createApplicantWithWorker(input: {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address?: string;
  workRadiusMiles?: number;
  applicationStatus: string;
  workerStatus?: string;
  skills?: { skillId: string; level: string; yearsExperience?: number }[];
  certTypeIds?: string[];
  waitlistCategory?: string;
}) {
  const application = await prisma.application.upsert({
    where: { id: input.id },
    update: {},
    create: {
      id: input.id,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email,
      address: input.address,
      workRadiusMiles: input.workRadiusMiles,
      status: input.applicationStatus as never,
    },
  });

  if (!input.workerStatus) {
    return { application, workerProfile: null };
  }

  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {},
    create: {
      email: input.email,
      passwordHash: DEV_PASSWORD_HASH,
      role: "WORKER",
      status: "ACTIVE",
    },
  });

  const workerProfile = await prisma.workerProfile.upsert({
    where: { applicationId: application.id },
    update: {},
    create: {
      userId: user.id,
      applicationId: application.id,
      status: input.workerStatus as never,
      address: input.address,
      workRadiusMiles: input.workRadiusMiles,
    },
  });

  if (input.skills) {
    for (const s of input.skills) {
      await prisma.workerSkill.upsert({
        where: { id: `${workerProfile.id}-${s.skillId}` },
        update: {},
        create: {
          id: `${workerProfile.id}-${s.skillId}`,
          workerProfileId: workerProfile.id,
          skillId: s.skillId,
          level: s.level as never,
          yearsExperience: s.yearsExperience,
        },
      });
    }
  }

  if (input.certTypeIds) {
    for (const certId of input.certTypeIds) {
      await prisma.workerCertification.upsert({
        where: { id: `${workerProfile.id}-${certId}` },
        update: {},
        create: {
          id: `${workerProfile.id}-${certId}`,
          workerProfileId: workerProfile.id,
          certificationTypeId: certId,
          verificationStatus: "VERIFIED",
        },
      });
    }
  }

  await prisma.workerAvailabilityRule.upsert({
    where: { id: `${workerProfile.id}-mon-fri` },
    update: {},
    create: {
      id: `${workerProfile.id}-mon-fri`,
      workerProfileId: workerProfile.id,
      dayOfWeek: 1,
      startTime: "07:00",
      endTime: "15:00",
    },
  });

  if (input.waitlistCategory) {
    await prisma.waitlistEntry.upsert({
      where: { workerProfileId: workerProfile.id },
      update: {},
      create: {
        workerProfileId: workerProfile.id,
        skillCategory: input.waitlistCategory,
      },
    });
  }

  return { application, workerProfile };
}

const marcus = await createApplicantWithWorker({
  id: "seed-app-marcus-reed",
  firstName: "Marcus",
  lastName: "Reed",
  phone: "315-555-0111",
  email: "marcus.reed@example-dev.test",
  address: "412 Butternut St, Syracuse, NY 13208",
  workRadiusMiles: 15,
  applicationStatus: "ACTIVATED",
  workerStatus: "ACTIVE",
  skills: [
    { skillId: generalLabor.id, level: "EXPERIENCED_LABORER", yearsExperience: 4 },
    { skillId: movingLoading.id, level: "EXPERIENCED_LABORER", yearsExperience: 3 },
    ],
});

const danielle = await createApplicantWithWorker({
  id: "seed-app-danielle-okafor",
  firstName: "Danielle",
  lastName: "Okafor",
  phone: "315-555-0122",
  email: "danielle.okafor@example-dev.test",
  address: "88 Hiawatha Blvd, Syracuse, NY 13204",
  workRadiusMiles: 20,
  applicationStatus: "ACTIVATED",
  workerStatus: "ACTIVE",
  skills: [
    { skillId: warehousePicking.id, level: "SKILLED_HELPER", yearsExperience: 5 },
    { skillId: forkliftOperation.id, level: "SKILLED_HELPER", yearsExperience: 3 },
    ],
  certTypeIds: [forkliftCert.id],
});

const tyler = await createApplicantWithWorker({
  id: "seed-app-tyler-brooks",
  firstName: "Tyler",
  lastName: "Brooks",
  phone: "315-555-0133",
  email: "tyler.brooks@example-dev.test",
  address: "215 Teall Ave, Syracuse, NY 13206",
  workRadiusMiles: 25,
  applicationStatus: "ACTIVATED",
  workerStatus: "ACTIVE",
  skills: [
    { skillId: carpentryHelper.id, level: "SKILLED_TRADESPERSON", yearsExperience: 6 },
    { skillId: electricalHelper.id, level: "SKILLED_HELPER", yearsExperience: 2 },
    ],
  certTypeIds: [osha10.id],
});

const priya = await createApplicantWithWorker({
  id: "seed-app-priya-chandran",
  firstName: "Priya",
  lastName: "Chandran",
  phone: "315-555-0144",
  email: "priya.chandran@example-dev.test",
  address: "60 Presidential Plaza, Syracuse, NY 13202",
  workRadiusMiles: 15,
  applicationStatus: "ACTIVATED",
  workerStatus: "ACTIVE",
  skills: [
    { skillId: generalLabor.id, level: "GENERAL_LABORER", yearsExperience: 1 },
    { skillId: eventSetup.id, level: "EXPERIENCED_LABORER", yearsExperience: 2 },
    ],
});

const elena = await createApplicantWithWorker({
  id: "seed-app-elena-vasiliev",
  firstName: "Elena",
  lastName: "Vasiliev",
  phone: "315-555-0155",
  email: "elena.vasiliev@example-dev.test",
  address: "1500 W Genesee St, Syracuse, NY 13204",
  workRadiusMiles: 20,
  applicationStatus: "ACTIVATED",
  workerStatus: "ACTIVE",
  skills: [{ skillId: warehousePicking.id, level: "EXPERIENCED_LABORER", yearsExperience: 2 }],
});

const malik = await createApplicantWithWorker({
  id: "seed-app-malik-owusu",
  firstName: "Malik",
  lastName: "Owusu",
  phone: "315-555-0166",
  email: "malik.owusu@example-dev.test",
  address: "701 W Fayette St, Syracuse, NY 13204",
  workRadiusMiles: 18,
  applicationStatus: "ACTIVATED",
  workerStatus: "ACTIVE",
  skills: [{ skillId: generalLabor.id, level: "GENERAL_LABORER", yearsExperience: 1 }],
});

await createApplicantWithWorker({
  id: "seed-app-jordan-vasquez",
  firstName: "Jordan",
  lastName: "Vasquez",
  phone: "315-555-0177",
  email: "jordan.vasquez@example-dev.test",
  address: "310 Midler Ave, Syracuse, NY 13206",
  workRadiusMiles: 10,
  applicationStatus: "WAITLISTED",
  workerStatus: "WAITLISTED",
  skills: [{ skillId: generalLabor.id, level: "GENERAL_LABORER" }],
  waitlistCategory: "general",
});

await createApplicantWithWorker({
  id: "seed-app-casey-nguyen",
  firstName: "Casey",
  lastName: "Nguyen",
  phone: "315-555-0188",
  email: "casey.nguyen@example-dev.test",
  address: "230 Water St, Syracuse, NY 13202",
  workRadiusMiles: 12,
  applicationStatus: "SUBMITTED",
});

await createApplicantWithWorker({
  id: "seed-app-sam-whitfield",
  firstName: "Sam",
  lastName: "Whitfield",
  phone: "315-555-0199",
  email: "sam.whitfield@example-dev.test",
  address: "44 Burnet Ave, Syracuse, NY 13203",
  workRadiusMiles: 12,
  applicationStatus: "REJECTED",
});

// ---------- Crew ----------
const crew = await prisma.crew.upsert({
  where: { id: "seed-crew-setup" },
  update: {},
  create: {
    id: "seed-crew-setup",
    name: "Syracuse Setup Crew",
    leaderWorkerProfileId: tyler.workerProfile?.id,
    status: "active",
  },
});

if (tyler.workerProfile) {
  await prisma.crewMembership.upsert({
    where: { id: "seed-crewmember-tyler" },
    update: {},
    create: {
      id: "seed-crewmember-tyler",
      workerProfileId: tyler.workerProfile.id,
      crewId: crew.id,
      role: "LEADER",
      isPrimaryCrew: true,
    },
  });
}

if (priya.workerProfile) {
  await prisma.crewMembership.upsert({
    where: { id: "seed-crewmember-priya" },
    update: {},
    create: {
      id: "seed-crewmember-priya",
      workerProfileId: priya.workerProfile.id,
      crewId: crew.id,
      role: "MEMBER",
      isPrimaryCrew: true,
    },
  });
}

// ---------- Job A: completed event-setup job, invoiced and paid ----------
const jobRequestA = await prisma.jobRequest.upsert({
  where: { id: "seed-jobrequest-a" },
  update: {},
  create: {
    id: "seed-jobrequest-a",
    contractorId: saltCity.id,
    status: "CONVERTED_TO_JOB",
    jobType: "Event Setup & Teardown",
    requestedWorkerCount: 2,
    requestedDate: new Date("2026-06-15"),
    requestedStartTime: "08:00",
    requestedEndTime: "16:00",
    jobsiteAddress: "300 S State St, Syracuse, NY 13202",
    notes: "Corporate gala - stage, tables, and lighting setup.",
  },
});

const jobA = await prisma.job.upsert({
  where: { id: "seed-job-a" },
  update: {},
  create: {
    id: "seed-job-a",
    jobRequestId: jobRequestA.id,
    contractorId: saltCity.id,
    status: "COMPLETED",
    address: "300 S State St, Syracuse, NY 13202",
    supervisorName: "Dana Whitfield",
    supervisorPhone: "315-555-0200",
    generalPpeRequired: [],
  },
});

const shiftA = await prisma.shift.upsert({
  where: { id: "seed-shift-a" },
  update: {},
  create: {
    id: "seed-shift-a",
    jobId: jobA.id,
    shiftDate: new Date("2026-06-15"),
    startTime: "08:00",
    endTime: "16:00",
  },
});

// ---------- Shared helper for filled shift positions ----------
async function createFilledPosition(input: {
  id: string;
  shiftId: string;
  workerProfileId: string;
  payRate: number;
  billRate: number;
  requiredSkillId?: string;
  minimumLevel?: string;
  assignmentStatus?: string;
  positionStatus?: string;
}) {
  const position = await prisma.shiftPosition.upsert({
    where: { id: input.id },
    update: {},
    create: {
      id: input.id,
      shiftId: input.shiftId,
      status: (input.positionStatus ?? "FILLED") as never,
      requiredToolsOwned: [],
      workerPayRateSnapshot: input.payRate,
      contractorBillRateSnapshot: input.billRate,
    },
  });

  if (input.requiredSkillId) {
    await prisma.positionRequiredSkill.upsert({
      where: { id: `${input.id}-skill` },
      update: {},
      create: {
        id: `${input.id}-skill`,
        positionId: position.id,
        skillId: input.requiredSkillId,
        minimumLevel: (input.minimumLevel ?? "GENERAL_LABORER") as never,
      },
    });
  }

  const assignment = await prisma.shiftAssignment.upsert({
    where: { id: `${input.id}-assignment` },
    update: {},
    create: {
      id: `${input.id}-assignment`,
      positionId: position.id,
      workerProfileId: input.workerProfileId,
      status: (input.assignmentStatus ?? "COMPLETED") as never,
      workerPayRateSnapshot: input.payRate,
      contractorBillRateSnapshot: input.billRate,
    },
  });

  return { position, assignment };
}

const posA1 = await createFilledPosition({
  id: "seed-position-a1",
  shiftId: shiftA.id,
  workerProfileId: marcus.workerProfile!.id,
  payRate: 18,
  billRate: 32,
  requiredSkillId: eventSetup.id,
  minimumLevel: "GENERAL_LABORER",
});

const posA2 = await createFilledPosition({
  id: "seed-position-a2",
  shiftId: shiftA.id,
  workerProfileId: priya.workerProfile!.id,
  payRate: 18,
  billRate: 32,
  requiredSkillId: eventSetup.id,
  minimumLevel: "GENERAL_LABORER",
});

for (const assignment of [posA1.assignment, posA2.assignment]) {
  await prisma.timeEntry.upsert({
    where: { assignmentId: assignment.id },
    update: {},
    create: {
      assignmentId: assignment.id,
      status: "APPROVED",
      scheduledStart: new Date("2026-06-15T08:00:00-04:00"),
      scheduledEnd: new Date("2026-06-15T16:00:00-04:00"),
      checkInDeviceAt: new Date("2026-06-15T07:58:00-04:00"),
      checkInServerAt: new Date("2026-06-15T07:58:05-04:00"),
      checkOutDeviceAt: new Date("2026-06-15T16:02:00-04:00"),
      checkOutServerAt: new Date("2026-06-15T16:02:04-04:00"),
      geofenceResult: "within_radius",
    },
  });
}

const invoiceA = await prisma.invoice.upsert({
  where: { invoiceNumber: "INV-1001" },
  update: {},
  create: {
    invoiceNumber: "INV-1001",
    contractorId: saltCity.id,
    status: "PAID",
    subtotal: 512,
    total: 512,
    finalizedAt: new Date("2026-06-16"),
  },
});

await prisma.invoiceLineItem.upsert({
  where: { id: "seed-lineitem-a1" },
  update: {},
  create: {
    id: "seed-lineitem-a1",
    invoiceId: invoiceA.id,
    assignmentId: posA1.assignment.id,
    description: "Event setup labor - Marcus Reed (8 hrs)",
    quantity: 8,
    rate: 32,
    amount: 256,
    lineType: "regular",
  },
});

await prisma.invoiceLineItem.upsert({
  where: { id: "seed-lineitem-a2" },
  update: {},
  create: {
    id: "seed-lineitem-a2",
    invoiceId: invoiceA.id,
    assignmentId: posA2.assignment.id,
    description: "Event setup labor - Priya Chandran (8 hrs)",
    quantity: 8,
    rate: 32,
    amount: 256,
    lineType: "regular",
  },
});

await prisma.paymentRecord.upsert({
  where: { id: "seed-payment-a" },
  update: {},
  create: {
    id: "seed-payment-a",
    invoiceId: invoiceA.id,
    provider: "mock",
    amount: 512,
    status: "succeeded",
  },
});

await prisma.invoiceStatusHistory.upsert({
  where: { id: "seed-invoicehistory-a" },
  update: {},
  create: {
    id: "seed-invoicehistory-a",
    invoiceId: invoiceA.id,
    fromStatus: "SENT",
    toStatus: "PAID",
  },
});

// ---------- Job B: partially filled general-labor job ----------
const jobRequestB = await prisma.jobRequest.upsert({
  where: { id: "seed-jobrequest-b" },
  update: {},
  create: {
    id: "seed-jobrequest-b",
    contractorId: onondaga.id,
    status: "CONVERTED_TO_JOB",
    jobType: "General Labor",
    requestedWorkerCount: 4,
    requestedDate: new Date("2026-08-05"),
    requestedStartTime: "07:00",
    requestedEndTime: "15:00",
    jobsiteAddress: "1200 Erie Blvd W, Syracuse, NY 13204",
    notes: "Warehouse reorganization ahead of Q3 inventory count.",
  },
});

const jobB = await prisma.job.upsert({
  where: { id: "seed-job-b" },
  update: {},
  create: {
    id: "seed-job-b",
    jobRequestId: jobRequestB.id,
    contractorId: onondaga.id,
    status: "PARTIALLY_FILLED",
    address: "1200 Erie Blvd W, Syracuse, NY 13204",
    supervisorName: "Greg Palmieri",
    supervisorPhone: "315-555-0210",
    generalPpeRequired: ["steel_toe_boots"],
  },
});

const shiftB = await prisma.shift.upsert({
  where: { id: "seed-shift-b" },
  update: {},
  create: {
    id: "seed-shift-b",
    jobId: jobB.id,
    shiftDate: new Date("2026-08-05"),
    startTime: "07:00",
    endTime: "15:00",
  },
});

const posB1 = await createFilledPosition({
  id: "seed-position-b1",
  shiftId: shiftB.id,
  workerProfileId: danielle.workerProfile!.id,
  payRate: 19,
  billRate: 34,
  requiredSkillId: warehousePicking.id,
  minimumLevel: "SKILLED_HELPER",
  assignmentStatus: "CONFIRMED",
});

const posB2 = await createFilledPosition({
  id: "seed-position-b2",
  shiftId: shiftB.id,
  workerProfileId: malik.workerProfile!.id,
  payRate: 17,
  billRate: 30,
  requiredSkillId: generalLabor.id,
  minimumLevel: "GENERAL_LABORER",
  assignmentStatus: "CONFIRMED",
});

const posB3 = await prisma.shiftPosition.upsert({
  where: { id: "seed-position-b3" },
  update: {},
  create: {
    id: "seed-position-b3",
    shiftId: shiftB.id,
    status: "OFFERED",
    requiredToolsOwned: [],
    workerPayRateSnapshot: 17,
    contractorBillRateSnapshot: 30,
  },
});

const posB4 = await prisma.shiftPosition.upsert({
  where: { id: "seed-position-b4" },
  update: {},
  create: {
    id: "seed-position-b4",
    shiftId: shiftB.id,
    status: "OPEN",
    requiredToolsOwned: [],
    workerPayRateSnapshot: 17,
    contractorBillRateSnapshot: 30,
  },
});

const matchingRunB3 = await prisma.matchingRun.upsert({
  where: { id: "seed-matchingrun-b3" },
  update: {},
  create: {
    id: "seed-matchingrun-b3",
    positionId: posB3.id,
    configVersion: "v1",
  },
});

await prisma.matchingCandidate.upsert({
  where: { id: "seed-candidate-b3-elena" },
  update: {},
  create: {
    id: "seed-candidate-b3-elena",
    matchingRunId: matchingRunB3.id,
    workerProfileId: elena.workerProfile!.id,
    eligible: true,
    exclusionReasons: [],
    totalScore: 0.82,
    distanceScore: 0.7,
    reliabilityScore: 0.9,
    skillScore: 0.85,
    attendanceScore: 0.95,
    priorContractorScore: 0.6,
    rank: 1,
  },
});

await prisma.offer.upsert({
  where: { id: "seed-offer-b3-elena" },
  update: {},
  create: {
    id: "seed-offer-b3-elena",
    positionId: posB3.id,
    workerProfileId: elena.workerProfile!.id,
    status: "SENT",
    dispatchStrategy: "SEQUENTIAL",
    waveNumber: 1,
    sentAt: new Date("2026-07-30T09:00:00-04:00"),
    expiresAt: new Date("2026-07-30T11:00:00-04:00"),
    deliveryMethod: "sms",
    deliveryStatus: "delivered",
  },
});

// ---------- Job C: worker no-show, same-day replacement ----------
const jobRequestC = await prisma.jobRequest.upsert({
  where: { id: "seed-jobrequest-c" },
  update: {},
  create: {
    id: "seed-jobrequest-c",
    contractorId: saltCity.id,
    status: "CONVERTED_TO_JOB",
    jobType: "Moving & Loading",
    requestedWorkerCount: 1,
    requestedDate: new Date("2026-07-10"),
    requestedStartTime: "09:00",
    requestedEndTime: "13:00",
    jobsiteAddress: "500 S Salina St, Syracuse, NY 13202",
    notes: "Office relocation - furniture loading only.",
  },
});

const jobC = await prisma.job.upsert({
  where: { id: "seed-job-c" },
  update: {},
  create: {
    id: "seed-job-c",
    jobRequestId: jobRequestC.id,
    contractorId: saltCity.id,
    status: "COMPLETED",
    address: "500 S Salina St, Syracuse, NY 13202",
    generalPpeRequired: [],
  },
});

const shiftC = await prisma.shift.upsert({
  where: { id: "seed-shift-c" },
  update: {},
  create: {
    id: "seed-shift-c",
    jobId: jobC.id,
    shiftDate: new Date("2026-07-10"),
    startTime: "09:00",
    endTime: "13:00",
  },
});

const posC1 = await prisma.shiftPosition.upsert({
  where: { id: "seed-position-c1" },
  update: {},
  create: {
    id: "seed-position-c1",
    shiftId: shiftC.id,
    status: "FILLED",
    requiredToolsOwned: [],
    workerPayRateSnapshot: 17,
    contractorBillRateSnapshot: 30,
  },
});

const noShowAssignment = await prisma.shiftAssignment.upsert({
  where: { id: "seed-assignment-c-original" },
  update: {},
  create: {
    id: "seed-assignment-c-original",
    positionId: posC1.id,
    workerProfileId: elena.workerProfile!.id,
    status: "NO_SHOW",
    isCurrent: false,
    workerPayRateSnapshot: 17,
    contractorBillRateSnapshot: 30,
    endedAt: new Date("2026-07-10T09:30:00-04:00"),
  },
});

const replacementAssignment = await prisma.shiftAssignment.upsert({
  where: { id: "seed-assignment-c-replacement" },
  update: {},
  create: {
    id: "seed-assignment-c-replacement",
    positionId: posC1.id,
    workerProfileId: marcus.workerProfile!.id,
    status: "COMPLETED",
    isCurrent: true,
    replacesAssignmentId: noShowAssignment.id,
    replacementReason: "Original worker did not arrive or respond by 30 minutes past shift start.",
    workerPayRateSnapshot: 17,
    contractorBillRateSnapshot: 30,
  },
});

await prisma.reliabilityEvent.upsert({
  where: { id: "seed-reliability-elena-noshow" },
  update: {},
  create: {
    id: "seed-reliability-elena-noshow",
    workerProfileId: elena.workerProfile!.id,
    type: "NO_SHOW",
    relatedAssignmentId: noShowAssignment.id,
    notes: "Did not arrive or call for scheduled shift; same-day replacement was dispatched.",
  },
});

await prisma.timeEntry.upsert({
  where: { assignmentId: replacementAssignment.id },
  update: {},
  create: {
    assignmentId: replacementAssignment.id,
    status: "APPROVED",
    scheduledStart: new Date("2026-07-10T09:30:00-04:00"),
    scheduledEnd: new Date("2026-07-10T13:00:00-04:00"),
    checkInDeviceAt: new Date("2026-07-10T09:32:00-04:00"),
    checkInServerAt: new Date("2026-07-10T09:32:05-04:00"),
    checkOutDeviceAt: new Date("2026-07-10T13:01:00-04:00"),
    checkOutServerAt: new Date("2026-07-10T13:01:03-04:00"),
    geofenceResult: "within_radius",
  },
});

// ---------- Job D: completed job with a disputed timesheet ----------
const jobRequestD = await prisma.jobRequest.upsert({
  where: { id: "seed-jobrequest-d" },
  update: {},
  create: {
    id: "seed-jobrequest-d",
    contractorId: onondaga.id,
    status: "CONVERTED_TO_JOB",
    jobType: "General Labor",
    requestedWorkerCount: 1,
    requestedDate: new Date("2026-07-05"),
    requestedStartTime: "08:00",
    requestedEndTime: "16:00",
    jobsiteAddress: "45 Wolf St, Syracuse, NY 13208",
    notes: "Yard cleanup and material staging.",
  },
});

const jobD = await prisma.job.upsert({
  where: { id: "seed-job-d" },
  update: {},
  create: {
    id: "seed-job-d",
    jobRequestId: jobRequestD.id,
    contractorId: onondaga.id,
    status: "DISPUTED",
    address: "45 Wolf St, Syracuse, NY 13208",
    generalPpeRequired: [],
  },
});

const shiftD = await prisma.shift.upsert({
  where: { id: "seed-shift-d" },
  update: {},
  create: {
    id: "seed-shift-d",
    jobId: jobD.id,
    shiftDate: new Date("2026-07-05"),
    startTime: "08:00",
    endTime: "16:00",
  },
});

const posD1 = await createFilledPosition({
  id: "seed-position-d1",
  shiftId: shiftD.id,
  workerProfileId: malik.workerProfile!.id,
  payRate: 17,
  billRate: 30,
  requiredSkillId: generalLabor.id,
  minimumLevel: "GENERAL_LABORER",
  positionStatus: "DISPUTED",
});

const disputedTimeEntry = await prisma.timeEntry.upsert({
  where: { assignmentId: posD1.assignment.id },
  update: {},
  create: {
    assignmentId: posD1.assignment.id,
    status: "DISPUTED",
    scheduledStart: new Date("2026-07-05T08:00:00-04:00"),
    scheduledEnd: new Date("2026-07-05T16:00:00-04:00"),
    checkInDeviceAt: new Date("2026-07-05T07:59:00-04:00"),
    checkInServerAt: new Date("2026-07-05T07:59:04-04:00"),
    checkOutDeviceAt: new Date("2026-07-05T16:03:00-04:00"),
    checkOutServerAt: new Date("2026-07-05T16:03:02-04:00"),
    geofenceResult: "within_radius",
    disputeStatus: "contractor_disputed_hours",
  },
});

await prisma.timeAdjustment.upsert({
  where: { id: "seed-adjustment-d1" },
  update: {},
  create: {
    id: "seed-adjustment-d1",
    timeEntryId: disputedTimeEntry.id,
    field: "checkOutServerAt",
    previousValue: "2026-07-05T16:03:02-04:00",
    newValue: "2026-07-05T14:00:00-04:00",
    reason: "Contractor states worker left the jobsite approximately two hours before the recorded check-out time.",
    requestedBy: onondagaOwnerUser.id,
  },
});

const invoiceD = await prisma.invoice.upsert({
  where: { invoiceNumber: "INV-1002" },
  update: {},
  create: {
    invoiceNumber: "INV-1002",
    contractorId: onondaga.id,
    status: "DISPUTED",
    subtotal: 240,
    total: 240,
  },
});

await prisma.invoiceLineItem.upsert({
  where: { id: "seed-lineitem-d1" },
  update: {},
  create: {
    id: "seed-lineitem-d1",
    invoiceId: invoiceD.id,
    assignmentId: posD1.assignment.id,
    description: "General labor - Malik Owusu (8 hrs, disputed)",
    quantity: 8,
    rate: 30,
    amount: 240,
    lineType: "regular",
  },
});

// ---------- Notifications ----------
const offerEvent = await prisma.notificationEvent.upsert({
  where: { id: "seed-notification-offer-sent" },
  update: {},
  create: {
    id: "seed-notification-offer-sent",
    type: "job_offer_sent",
    entityType: "Offer",
    entityId: "seed-offer-b3-elena",
    payload: { positionId: posB3.id },
  },
});

await prisma.notificationRecipient.upsert({
  where: { id: "seed-notificationrecipient-offer" },
  update: {},
  create: {
    id: "seed-notificationrecipient-offer",
    eventId: offerEvent.id,
    workerProfileId: elena.workerProfile!.id,
  },
});

const invoiceEvent = await prisma.notificationEvent.upsert({
  where: { id: "seed-notification-invoice-created" },
  update: {},
  create: {
    id: "seed-notification-invoice-created",
    type: "invoice_created",
    entityType: "Invoice",
    entityId: invoiceA.id,
    payload: { invoiceNumber: "INV-1001" },
  },
});

await prisma.notificationRecipient.upsert({
  where: { id: "seed-notificationrecipient-invoice" },
  update: {},
  create: {
    id: "seed-notificationrecipient-invoice",
    eventId: invoiceEvent.id,
    userId: saltCityOwnerUser.id,
  },
});

// ---------- Audit log ----------
await prisma.auditLog.upsert({
  where: { id: "seed-audit-contractor-approved" },
  update: {},
  create: {
    id: "seed-audit-contractor-approved",
    actorRole: "SUPER_ADMIN",
    action: "contractor.approved",
    entityType: "Contractor",
    entityPublicId: saltCity.id,
    afterJson: { status: "APPROVED" },
    reason: "Reviewed business details and approved contractor account.",
  },
});

await prisma.auditLog.upsert({
  where: { id: "seed-audit-worker-activated" },
  update: {},
  create: {
    id: "seed-audit-worker-activated",
    actorRole: "DISPATCHER",
    action: "worker.activated",
    entityType: "WorkerProfile",
    entityPublicId: marcus.workerProfile!.id,
    beforeJson: { status: "APPROVED" },
    afterJson: { status: "ACTIVE" },
    reason: "Activated from waitlist due to increased general labor demand.",
  },
});

await prisma.auditLog.upsert({
  where: { id: "seed-audit-invoice-paid" },
  update: {},
  create: {
    id: "seed-audit-invoice-paid",
    actorRole: "DISPATCHER",
    action: "invoice.status_changed",
    entityType: "Invoice",
    entityPublicId: invoiceA.id,
    beforeJson: { status: "SENT" },
    afterJson: { status: "PAID" },
  },
});

console.log("Seed complete.");
}

main()
.catch((err) => {
  console.error(err);
  process.exitCode = 1;
})
.finally(async () => {
  await prisma.$disconnect();
});
