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
