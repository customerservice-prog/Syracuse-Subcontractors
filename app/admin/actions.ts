"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActingUser } from "@/lib/auth/get-acting-user";
import { approveContractorInterest } from "@/lib/services/contractor.service";
import {
  transitionApplicationStatus,
  InvalidApplicationTransitionError,
} from "@/lib/services/application.service";
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
