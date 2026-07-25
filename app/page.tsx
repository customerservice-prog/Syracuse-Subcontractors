import Link from "next/link";
import { brand } from "@/config/brand";

export default function HomePage() {
  return (
    <div className="space-y-16">
      <section className="grid gap-8 py-8 md:grid-cols-2 md:items-center">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">{brand.market}</p>
          <h1 className="text-3xl font-bold sm:text-4xl">{brand.tagline}</h1>
          <p className="text-slate-600">
            {brand.name} connects vetted local workers with contractors who need reliable crews on
            short notice. Every job is matched, tracked, and reported from request to invoice.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/contractor-interest" className="rounded-md bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700">
              Request workers
            </Link>
            <Link href="/apply" className="rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100">
              Apply to work
            </Link>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">How dispatch works</h2>
          <ol className="mt-4 space-y-3 text-sm text-slate-600">
            <li><span className="font-semibold text-slate-900">1. Request.</span> Contractors submit job details: date, site, skills, headcount.</li>
            <li><span className="font-semibold text-slate-900">2. Match.</span> We rank qualified, available workers and send ranked offers.</li>
            <li><span className="font-semibold text-slate-900">3. Confirm.</span> Workers accept, check in on site, and the contractor sees live fill status.</li>
            <li><span className="font-semibold text-slate-900">4. Close out.</span> Hours are approved and invoiced with full detail.</li>
          </ol>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900">Verified workers</h3>
          <p className="mt-2 text-sm text-slate-600">Skills, certifications, and reliability history are reviewed before a worker is activated.</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900">Transparent status</h3>
          <p className="mt-2 text-sm text-slate-600">Contractors see fill progress and assignment status in real time, not just a confirmation email.</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900">Demand-based crews</h3>
          <p className="mt-2 text-sm text-slate-600">We activate workers based on actual job demand in {brand.market}, not open-ended sign-ups.</p>
        </div>
      </section>

      <section className="rounded-lg border border-dashed border-slate-300 bg-slate-100 p-6 text-sm text-slate-600">
        <p>
          {brand.shortName} is a dispatch platform, not a guarantee of work. Applicants join a
          waitlist and are activated as contractor demand requires it.
        </p>
      </section>
    </div>
  );
}
