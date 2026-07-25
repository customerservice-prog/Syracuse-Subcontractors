"use server";

import { redirect } from "next/navigation";
import { submitContractorInterest } from "@/lib/services/contractor.service";
import { contractorInterestSchema } from "@/lib/validation/contractor.schema";

// Public server action backing the contractor interest form. This never
// creates an active Contractor account - it only records a ContractorInterest
// row for admin review. Active contractor accounts and invites are only
// created via approveContractorInterest, run by an admin.
export async function contractorInterestAction(formData: FormData) {
  const raw = {
    companyName: String(formData.get("companyName") ?? ""),
    contactName: String(formData.get("contactName") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
    notes: formData.get("notes") ? String(formData.get("notes")) : undefined,
  };

  const parsed = contractorInterestSchema.safeParse(raw);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Please check the form and try again.";
    redirect(`/contractor-interest?error=${encodeURIComponent(message)}`);
  }

  await submitContractorInterest(parsed.data);

  redirect("/contractor-interest/thank-you");
}
