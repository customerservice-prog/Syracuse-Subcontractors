"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActingUser } from "@/lib/auth/get-acting-user";
import { approveContractorInterest } from "@/lib/services/contractor.service";
import {
  transitionApplicationStatus,
  InvalidApplicationTransitionError,
} from "@/lib/services/application.service";
import {
  convertJobRequestToJob,
  ForbiddenError as JobForbiddenError,
  InvalidJobRequestStateError,
} from "@/lib/services/job.service";
import {
  findCandidatesForPosition,
  sendOfferToWorker,
  ForbiddenError as DispatchForbiddenError,
  InvalidDispatchStateError,
} from "@/lib/services/dispatch.service";
import {
  approveTimeEntry,
  ForbiddenError as TimeForbiddenError,
  InvalidTimeEntryStateError,
} from "@/lib/services/time.service";
import { convertJobRequestSchema } from "@/lib/validation/job.schema";
import { findCandidatesSchema, sendOfferSchema } from "@/lib/validation/dispatch.schema";
import { approveTimeEntrySchema } from "@/lib/validation/time.schema";
import type { ApplicationStatus } from "@prisma/client";

async function requireAdmin() {
  const actingUser = await getActingUser();
  if (!actingUser || (actingUser.role !== "SUPER_ADMIN" && actingUser.role !== "DISPATCHER")) {
    redirect("/login");
  }
  return actingUser;
}

// Approves a pending ContractorInterest into an active Contractor + invite.
// Per docs/PHASE1-DESIGN.md this is restricted to SUPER_ADMIN in the policy
// layer (canApproveContractor); DISPATCHER users will receive a ForbiddenError
// surfaced as a thrown exception here, which is acceptable for this MVP admin
// screen since dispatchers are not expected to see this control long-term.
export async function approveContractorInterestAction(formData: FormData) {
  const actingUser = await requireAdmin();

  const contractorInterestId = String(formData.get("contractorInterestId") ?? "");
  const companyName = String(formData.get("companyName") ?? "");
  const inviteEmail = String(formData.get("inviteEmail") ?? "");

  await approveContractorInterest(actingUser, {
    contractorInterestId,
    companyName,
    inviteEmail,
  });

  revalidatePath("/admin");
}

// Moves an Application to a new status. The service layer enforces the
// allowed state-machine transitions and admin-only policy; invalid
// transitions are swallowed here (as a redirect back to the dashboard) rather
// than crashing the page, since this is triggered from a plain HTML form
// without client-side validation.
export async function transitionApplicationAction(formData: FormData) {
  const actingUser = await requireAdmin();

  const applicationId = String(formData.get("applicationId") ?? "");
  const toStatus = String(formData.get("toStatus") ?? "") as ApplicationStatus;

  try {
    await transitionApplicationStatus(actingUser, { applicationId, toStatus });
  } catch (error) {
    if (error instanceof InvalidApplicationTransitionError) {
      redirect(`/admin?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  revalidatePath("/admin");
}

// Converts a pending JobRequest into a schedulable Job with a Shift and N
// open ShiftPositions (N = the requested worker count). Requires an admin to
// set the worker pay rate and contractor bill rate, since JobRequest itself
// intentionally has no rate fields (rates are a dispatch-time decision, not
// something a contractor sets when requesting workers).
export async function convertJobRequestAction(formData: FormData) {
  const actingUser = await requireAdmin();

  const raw = {
    jobRequestId: String(formData.get("jobRequestId") ?? ""),
    supervisorName: formData.get("supervisorName") ? String(formData.get("supervisorName")) : undefined,
    supervisorPhone: formData.get("supervisorPhone") ? String(formData.get("supervisorPhone")) : undefined,
    workerPayRate: formData.get("workerPayRate"),
    contractorBillRate: formData.get("contractorBillRate"),
  };

  const parsed = convertJobRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Please check the job conversion form and try again.";
    redirect(`/admin?error=${encodeURIComponent(message)}`);
  }

  try {
    await convertJobRequestToJob(actingUser, parsed.data);
  } catch (error) {
    if (error instanceof JobForbiddenError || error instanceof InvalidJobRequestStateError) {
      redirect(`/admin?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  revalidatePath("/admin");
}

// Runs a fresh matching pass for one open ShiftPosition and stores the ranked
// candidate list for the admin dashboard to display. Never sends an offer by
// itself - see dispatch.service.ts.
export async function findCandidatesAction(formData: FormData) {
  const actingUser = await requireAdmin();

  const parsed = findCandidatesSchema.safeParse({
    positionId: String(formData.get("positionId") ?? ""),
  });
  if (!parsed.success) {
    redirect(`/admin?error=${encodeURIComponent("A position is required to find candidates.")}`);
  }

  await findCandidatesForPosition(actingUser, parsed.data.positionId);

  revalidatePath("/admin");
}

// Sends a single offer to one worker for one open position, one wave at a
// time - "do not blast every worker at once" per docs/PHASE1-DESIGN.md.
export async function sendOfferAction(formData: FormData) {
  const actingUser = await requireAdmin();

  const parsed = sendOfferSchema.safeParse({
    positionId: String(formData.get("positionId") ?? ""),
    workerProfileId: String(formData.get("workerProfileId") ?? ""),
  });
  if (!parsed.success) {
    redirect(`/admin?error=${encodeURIComponent("A position and worker are required to send an offer.")}`);
  }

  try {
    await sendOfferToWorker(actingUser, parsed.data);
  } catch (error) {
    if (error instanceof DispatchForbiddenError || error instanceof InvalidDispatchStateError) {
      redirect(`/admin?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  revalidatePath("/admin");
}

// Approves worked hours for a completed (checked-out) time entry. Approving
// marks the ShiftAssignment COMPLETED and records a positive reliability
// event - see lib/services/time.service.ts.
export async function approveTimeEntryAction(formData: FormData) {
  const actingUser = await requireAdmin();

  const parsed = approveTimeEntrySchema.safeParse({
    timeEntryId: String(formData.get("timeEntryId") ?? ""),
  });
  if (!parsed.success) {
    redirect(`/admin?error=${encodeURIComponent("A time entry is required to approve hours.")}`);
  }

  try {
    await approveTimeEntry(actingUser, parsed.data.timeEntryId);
  } catch (error) {
    if (error instanceof TimeForbiddenError || error instanceof InvalidTimeEntryStateError) {
      redirect(`/admin?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  revalidatePath("/admin");
}
