import Link from "next/link";
import { brand } from "@/config/brand";

export default function ContractorInterestThankYouPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6 py-16 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Request received</h1>
      <p className="text-sm text-slate-600">
        Thank you for your interest in {brand.name}. An admin will review your company details
        and follow up by email or phone to confirm account access before any workers are
        dispatched.
      </p>
      <p className="text-sm text-slate-600">
        Questions in the meantime? Reach us at {brand.supportEmail}.
      </p>
      <Link href="/" className="inline-block text-sm font-semibold text-brand hover:underline">
        Back to home
      </Link>
    </div>
  );
}
