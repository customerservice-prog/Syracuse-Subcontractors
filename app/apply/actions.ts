"use server";

import { redirect } from "next/navigation";
import { submitApplication } from "@/lib/services/application.service";
import { applicationSchema } from "@/lib/validation/application.schema";

// Public server action backing the worker application form. This never
// creates a WorkerProfile or activates anyone - it only records an
// Application in SUBMITTED status for admin review, per the demand-first
// activation design in docs/PHASE1-DESIGN.md.
export async function applyAction(formData: FormData) {
  const workRadiusRaw = formData.get("workRadiusMiles");

  const raw = {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    address: formData.get("address") ? String(formData.get("address")) : undefined,
    transportation: formData.get("transportation") ? String(formData.get("transportation")) : undefined,
    workRadiusMiles: workRadiusRaw ? Number(workRadiusRaw) : undefined,
    referralCode: formData.get("referralCode") ? String(formData.get("referralCode")) : undefined,
    skillCategoryIds: formData.getAll("skillCategoryIds").map(String),
  };

  const parsed = applicationSchema.safeParse(raw);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Please check the form and try again.";
    redirect(`/apply?error=${encodeURIComponent(message)}`);
  }

  await submitApplication(parsed.data);

  redirect("/apply/thank-you");
}
