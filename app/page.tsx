import Link from "next/link";
import { brand } from "@/config/brand";

const STEPS = [
  { title: "Request", description: "Contractors submit job details: date, site, skills, headcount." },
  { title: "Match", description: "We rank qualified, available workers and send ranked offers." },
  {
    title: "Confirm",
    description: "Workers accept, check in on site, and the contractor sees live fill status.",
  },
  { title: "Close out", description: "Hours are approved and invoiced with full detail." },
];

export default function HomePage() {
  const features = [
    {
      title: "Verified workers",
      description:
        "Skills, certifications, and reliability history are reviewed before a worker is activated.",
    },
    {
      title: "Transparent status",
      description:
        "Contractors see fill progress and assignment status in real time, not just a confirmation email.",
    },
    {
      title: "Demand-based crews",
      description: `We activate workers based on actual job demand in ${brand.market}, not open-ended sign-ups.`,
    },
  ];

  return (
    <div className="space-y-20">
      <section className="relative -mx-4 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-brand-900 px-4 py-14 text-white sm:-mx-6 sm:px-10 sm:py-20">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div className="space-y-5">
            <p className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-200">
              {brand.market}
            </p>
            <h1 className="text-3xl font-bold leading-tight sm:text-5xl">{brand.tagline}</h1>
            <p className="max-w-xl text-slate-300">
              {brand.name} connects vetted local workers with contractors who need reliable crews
              on short notice. Every job is matched, tracked, and reported from request to
              invoice.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/contractor-interest"
                className="rounded-md bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
              >
                Request workers
              </Link>
              <Link
                href="/apply"
                className="rounded-md border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Apply to work
              </Link>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-200">
              How dispatch works
            </h2>
            <ol className="mt-4 space-y-4">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-white/15 text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="text-sm text-slate-200">
                    <span className="font-semibold text-white">{step.title}.</span>{" "}
                    {step.description}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-900">{feature.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{feature.description}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-dashed border-slate-300 bg-slate-100 p-6 text-sm text-slate-600">
        <p>
          {brand.shortName} is a dispatch platform, not a guarantee of work. Applicants join a
          waitlist and are activated as contractor demand requires it.
        </p>
      </section>
    </div>
  );
}
