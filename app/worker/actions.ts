"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActingUser } from "@/lib/auth/get-acting-user";
import {
  acceptOffer,
  declineOffer,
  ForbiddenError,
  InvalidDispatchStateError,
} from "@/lib/services/dispatch.service";
import { respondToOfferSchema } from "@/lib/validation/dispatch.schema";
import {
  checkIn,
  checkOut,
  ForbiddenError as TimeForbiddenError,
  InvalidTimeEntryStateError,
} from "@/lib/services/time.service";
import { checkInSchema, checkOutSchema } from "@/lib/validation/time.schema";

async function requireWorker() {
  const actingUser = await getActingUser();
  if (!actingUser || actingUser.role !== "WORKER" || !actingUser.workerProfileId) {
    redirect("/login");
  }
  return actingUser;
}

// Worker accepts a pending offer. The service layer re-verifies the offer
// actually belongs to this worker (canRespondToOffer) - the form only ever
// submits an offerId, never a worker identity, so there is nothing here to
// spoof.
export async function acceptOfferAction(formData: FormData) {
  const actingUser = await requireWorker();

  const parsed = respondToOfferSchema.safeParse({
    offerId: String(formData.get("offerId") ?? ""),
  });
  if (!parsed.success) {
    redirect(`/worker?error=${encodeURIComponent("An offer is required to accept.")}`);
  }

  try {
    await acceptOffer(actingUser, parsed.data.offerId);
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof InvalidDispatchStateError) {
      redirect(`/worker?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  revalidatePath("/worker");
}

// Worker declines a pending offer. Being active never guarantees hours, and
// declining an offer carries no penalty beyond a recorded reliability event
// that admins may see - see docs/PHASE1-DESIGN.md.
export async function declineOfferAction(formData: FormData) {
  const actingUser = await requireWorker();

  const parsed = respondToOfferSchema.safeParse({
    offerId: String(formData.get("offerId") ?? ""),
    reason: formData.get("reason") ? String(formData.get("reason")) : undefined,
  });
  if (!parsed.success) {
    redirect(`/worker?error=${encodeURIComponent("An offer is required to decline.")}`);
  }

  try {
    await declineOffer(actingUser, parsed.data);
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof InvalidDispatchStateError) {
      redirect(`/worker?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  revalidatePath("/worker");
}

// Worker checks in to a confirmed shift assignment. Phase 1 MVP is a manual
// tap-to-check-in; GPS/geofence/QR verification is scaffolded in the
// TimeEntry schema but not yet enforced - see lib/services/time.service.ts.
export async function checkInAction(formData: FormData) {
  const actingUser = await requireWorker();

  const parsed = checkInSchema.safeParse({
    assignmentId: String(formData.get("assignmentId") ?? ""),
  });
  if (!parsed.success) {
    redirect(`/worker?error=${encodeURIComponent("A shift assignment is required to check in.")}`);
  }

  try {
    await checkIn(actingUser, parsed.data.assignmentId);
  } catch (error) {
    if (error instanceof TimeForbiddenError || error instanceof InvalidTimeEntryStateError) {
      redirect(`/worker?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  revalidatePath("/worker");
}

// Worker checks out of an active shift assignment. This moves the time entry
// to PENDING_APPROVAL - hours are never auto-approved; an admin (or
// eventually the owning contractor's staff) must approve them before the
// assignment is marked COMPLETED.
export async function checkOutAction(formData: FormData) {
  const actingUser = await requireWorker();

  const parsed = checkOutSchema.safeParse({
    assignmentId: String(formData.get("assignmentId") ?? ""),
  });
  if (!parsed.success) {
    redirect(`/worker?error=${encodeURIComponent("A shift assignment is required to check out.")}`);
  }

  try {
    await checkOut(actingUser, parsed.data.assignmentId);
  } catch (error) {
    if (error instanceof TimeForbiddenError || error instanceof InvalidTimeEntryStateError) {
      redirect(`/worker?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  revalidatePath("/worker");
}
