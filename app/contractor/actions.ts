"use server";

import { redirect } from "next/navigation";
import { getActingUser } from "@/lib/auth/get-acting-user";
import { submitJobRequest, ForbiddenError } from "@/lib/services/contractor.service";
import { jobRequestSchema } from "@/lib/validation/contractor.schema";

// Server action backing the contractor dashboard's "new job request" form.
// This never creates a Job directly - it only records a JobRequest for
// dispatcher review/quoting. Converting a request into a Job with shifts and
// positions is an admin/dispatcher action added in a later phase, per
// docs/PHASE1-DESIGN.md.
export async function submitJobRequestAction(formData: FormData) {
  const actingUser = await getActingUser();

  if (!actingUser || !actingUser.contractorId) {
    redirect("/login");
  }

  const raw = {
    contractorId: actingUser.contractorId,
    jobType: String(formData.get("jobType") ?? ""),
    requestedWorkerCount: Number(formData.get("requestedWorkerCount") ?? 0),
    requestedDate: String(formData.get("requestedDate") ?? ""),
    requestedStartTime: String(formData.get("requestedStartTime") ?? ""),
    requestedEndTime: String(formData.get("requestedEndTime") ?? ""),
    jobsiteAddress: String(formData.get("jobsiteAddress") ?? ""),
    notes: formData.get("notes") ? String(formData.get("notes")) : undefined,
  };

  const parsed = jobRequestSchema.safeParse(raw);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Please check the form and try again.";
    redirect(`/contractor?error=${encodeURIComponent(message)}`);
  }

  try {
    await submitJobRequest(actingUser, parsed.data);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      redirect(`/contractor?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }

  redirect("/contractor?submitted=1");
}
