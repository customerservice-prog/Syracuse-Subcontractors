import Link from "next/link";
import { brand } from "@/config/brand";

const ICON_PATHS: Record<string, string> = {
  send: "M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5",
  users:
    "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
  shieldCheck:
    "M9 12.75 11.25 15 15 9.75M12 3c-2.755 0-5.455.232-8.084.678a1.5 1.5 0 0 0-1.235 1.541 22.5 22.5 0 0 0 8.965 17.94l.1.06a.75.75 0 0 0 .548 0l.1-.06a22.5 22.5 0 0 0 8.965-17.94 1.5 1.5 0 0 0-1.235-1.541A48.86 48.86 0 0 0 12 3Z",
  fileText:
    "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
  eye: "M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  building:
    "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21",
  hardhat:
    "M4.5 15.75h15M4.5 15.75a7.5 7.5 0 0 1 15 0M4.5 15.75V18a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-2.25M9.75 9V6.75a2.25 2.25 0 1 1 4.5 0V9",
  info: "M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z",
};

function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[name]} />
    </svg>
  );
}

function NetworkGraphic() {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      className="pointer-events-none absolute -right-6 -top-10 h-64 w-64 text-white/10 sm:h-80 sm:w-80"
      aria-hidden="true"
    >
      <circle cx="40" cy="40" r="6" fill="currentColor" />
      <circle cx="122" cy="18" r="4" fill="currentColor" />
      <circle cx="164" cy="78" r="8" fill="currentColor" />
      <circle cx="92" cy="102" r="5" fill="currentColor" />
      <circle cx="150" cy="150" r="7" fill="currentColor" />
      <circle cx="58" cy="162" r="4" fill="currentColor" />
      <line x1="40" y1="40" x2="122" y2="18" stroke="currentColor" strokeWidth="1" />
      <line x1="122" y1="18" x2="164" y2="78" stroke="currentColor" strokeWidth="1" />
      <line x1="164" y1="78" x2="92" y2="102" stroke="currentColor" strokeWidth="1" />
      <line x1="92" y1="102" x2="40" y2="40" stroke="currentColor" strokeWidth="1" />
      <line x1="92" y1="102" x2="150" y2="150" stroke="currentColor" strokeWidth="1" />
      <line x1="150" y1="150" x2="58" y2="162" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

const TRUST_POINTS = [
  { icon: "send", text: "Ranked offers sent in waves, never blasted to everyone at once" },
  { icon: "shieldCheck", text: "Workers are reviewed before they can be activated for jobs" },
  { icon: "eye", text: "Live fill status, not a confirmation email and a guess" },
];

const STEPS = [
  { title: "Request", description: "Contractors submit job details: date, site, skills, headcount.", icon: "send" },
  { title: "Match", description: "We rank qualified, available workers and send ranked offers.", icon: "users" },
  {
    title: "Confirm",
    description: "Workers accept, check in on site, and the contractor sees live fill status.",
    icon: "shieldCheck",
  },
  { title: "Close out", description: "Hours are approved and invoiced with full detail.", icon: "fileText" },
];

export default function HomePage() {
  const features = [
    {
      title: "Verified workers",
      description:
        "Skills, certifications, and reliability history are reviewed before a worker is activated.",
      icon: "shieldCheck",
    },
    {
      title: "Transparent status",
      description:
        "Contractors see fill progress and assignment status in real time, not just a confirmation email.",
      icon: "eye",
    },
    {
      title: "Demand-based crews",
      description: `We activate workers based on actual job demand in ${brand.market}, not open-ended sign-ups.`,
      icon: "users",
    },
  ];

  return (
    <div className="space-y-20">
      <section className="relative -mx-4 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-brand-900 px-4 py-14 text-white sm:-mx-6 sm:px-10 sm:py-20">
        <NetworkGraphic />
        <div className="relative grid gap-10 md:grid-cols-2 md:items-center">
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
          <div className="relative rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-200">
              Why it feels different
            </h2>
            <ul className="mt-4 space-y-4">
              {TRUST_POINTS.map((point) => (
                <li key={point.text} className="flex gap-3">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white/15">
                    <Icon name={point.icon} className="h-4 w-4" />
                  </span>
                  <span className="text-sm text-slate-200">{point.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900">How dispatch works</h2>
          <p className="mt-2 text-sm text-slate-600">
            From request to invoice, every job moves through the same tracked steps.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <div
              key={step.title}
              className="relative rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon name={step.icon} className="h-5 w-5" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Step {index + 1}
                </span>
              </div>
              <h3 className="font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Icon name="building" className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900">For contractors</h3>
          <p className="mt-2 text-sm text-slate-600">
            Post a job once and get a ranked, qualified crew fast, with full visibility the whole
            way through.
          </p>
          <ul className="mt-5 space-y-3 text-sm text-slate-600">
            <li className="flex gap-2">
              <Icon name="shieldCheck" className="mt-0.5 h-4 w-4 flex-none text-brand-600" />
              Skills, certifications, and reliability checked before dispatch
            </li>
            <li className="flex gap-2">
              <Icon name="eye" className="mt-0.5 h-4 w-4 flex-none text-brand-600" />
              Real-time fill status instead of guesswork
            </li>
            <li className="flex gap-2">
              <Icon name="fileText" className="mt-0.5 h-4 w-4 flex-none text-brand-600" />
              Approved hours flow straight into an invoice
            </li>
          </ul>
          <Link
            href="/contractor-interest"
            className="mt-6 inline-flex rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800"
          >
            Request workers
          </Link>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Icon name="hardhat" className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900">For workers</h3>
          <p className="mt-2 text-sm text-slate-600">
            Apply once, build your profile, and get offered jobs that match your skills and
            availability.
          </p>
          <ul className="mt-5 space-y-3 text-sm text-slate-600">
            <li className="flex gap-2">
              <Icon name="send" className="mt-0.5 h-4 w-4 flex-none text-brand-600" />
              Ranked job offers you can accept or decline
            </li>
            <li className="flex gap-2">
              <Icon name="users" className="mt-0.5 h-4 w-4 flex-none text-brand-600" />
              Clear applicant, waitlisted, and active status, no guessing
            </li>
            <li className="flex gap-2">
              <Icon name="fileText" className="mt-0.5 h-4 w-4 flex-none text-brand-600" />
              Track hours, earnings estimates, and completed jobs in one place
            </li>
          </ul>
          <Link
            href="/apply"
            className="mt-6 inline-flex rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800"
          >
            Apply to work
          </Link>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Icon name={feature.icon} className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-900">{feature.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{feature.description}</p>
          </div>
        ))}
      </section>

      <section className="flex gap-4 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-amber-50 text-amber-700">
          <Icon name="info" className="h-5 w-5" />
        </span>
        <p>
          {brand.shortName} is a dispatch platform, not a guarantee of work. Applicants join a
          waitlist and are activated as contractor demand requires it.
        </p>
      </section>
    </div>
  );
}

