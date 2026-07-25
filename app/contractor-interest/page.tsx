import { brand } from "@/config/brand";
import { contractorInterestAction } from "./actions";

export default function ContractorInterestPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Request workers</h1>
        <p className="text-sm text-slate-600">
          Tell us about your company and the type of work you need staffed in {brand.market}. An
          admin reviews every new company before an account is created - this form does not create
          login access immediately.
        </p>
      </div>

      {searchParams.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      ) : null}

      <form action={contractorInterestAction} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="companyName" className="text-sm font-medium text-slate-700">Company name</label>
          <input id="companyName" name="companyName" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="contactName" className="text-sm font-medium text-slate-700">Contact name</label>
            <input id="contactName" name="contactName" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label htmlFor="contactPhone" className="text-sm font-medium text-slate-700">Contact phone</label>
            <input id="contactPhone" name="contactPhone" type="tel" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor="contactEmail" className="text-sm font-medium text-slate-700">Contact email</label>
          <input id="contactEmail" name="contactEmail" type="email" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label htmlFor="notes" className="text-sm font-medium text-slate-700">
            What kind of work do you need staffed? (optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            placeholder="Job types, typical crew size, timing, jobsite areas, etc."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 sm:w-auto"
        >
          Submit request
        </button>
      </form>
    </div>
  );
}
