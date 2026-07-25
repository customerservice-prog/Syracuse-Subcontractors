import Link from "next/link";
import { brand } from "@/config/brand";

export default function ApplyThankYouPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6 py-16 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Application received</h1>
      <p className="text-sm text-slate-600">
        Thank you for applying. Your application has been added to the {brand.market} review
        queue. We activate workers as contractor demand requires it, so there is no guaranteed
        timeline - we will contact you at the email or phone number you provided if you are
        selected to move forward.
      </p>
      <p className="text-sm text-slate-600">
        You can check back later once account access is available, or contact{" "}
        {brand.supportEmail} with any questions.
      </p>
      <Link href="/" className="inline-block text-sm font-semibold text-brand hover:underline">
        Back to home
      </Link>
    </div>
  );
}
