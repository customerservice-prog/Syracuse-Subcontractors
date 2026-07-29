import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getActingUser } from "@/lib/auth/get-acting-user";
import { StatusBadge } from "@/components/status-badge";
import { submitJobRequestAction } from "./actions";
import { listInvoicesForContractor } from "@/lib/services/invoice.service";

// Contractor dashboard for Phase 1/2/3: submit a new job request, track the
// status of requests already submitted, and view invoices generated from
// approved hours. Matching, dispatch, and detailed fill status live on the
// admin side per docs/PHASE1-DESIGN.md - for now a contractor can see their
// request queue, coarse status, and billing history. This page only ever
// reads/writes data scoped to the acting user's own contractorId;
// lib/services/contractor.service.ts and lib/services/invoice.service.ts
// re-check that server-side.
export const dynamic = "force-dynamic";

const CONTRACTOR_STAFF_ROLES = ["CONTRACTOR_OWNER", "CONTRACTOR_MANAGER", "SUPERVISOR"];

const ICON_PATHS = {
  clipboard:
    "M9 4h6a1 1 0 0 1 1 1v1h1a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h1V5a1 1 0 0 1 1-1Zm0 0v2h6V4M9 12h6M9 16h6",
  clock: "M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  invoice: "M8 3h8a1 1 0 0 1 1 1v16l-3-2-2 2-2-2-3 2V4a1 1 0 0 1 1-1Zm1 5h6M9 11h6M9 14h4",
  plus: "M12 5v14M5 12h14",
} satisfies Record<string, string>;

function Icon({ name, className = "h-4 w-4" }: { name: keyof typeof ICON_PATHS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[name]} />
    </svg>
  );
}

function SectionHeading({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: keyof typeof ICON_PATHS;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-200 pb-3">
      {icon ? (
        <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon name={icon} className="h-4 w-4" />
        </span>
      ) : null}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: keyof typeof ICON_PATHS;
  accent: "brand" | "amber" | "sky";
}) {
  const accentClasses: Record<string, string> = {
    brand: "bg-brand-50 text-brand-700",
    amber: "bg-amber-50 text-amber-700",
    sky: "bg-sky-50 text-sky-700",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${accentClasses[accent]}`}>
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default async function ContractorPage({
  searchParams,
}: {
  searchParams: { error?: string; submitted?: string };
}) {
  const actingUser = await getActingUser();

  if (!actingUser || !CONTRACTOR_STAFF_ROLES.includes(actingUser.role) || !actingUser.contractorId) {
    redirect("/login");
  }

  const contractorId = actingUser.contractorId as string;

  const [contractor, jobRequests, invoices] = await Promise.all([
    db.contractor.findUnique({ where: { id: contractorId } }),
    db.jobRequest.findMany({
      where: { contractorId },
      orderBy: { createdAt: "desc" },
    }),
    listInvoicesForContractor(contractorId),
  ]);

  const pendingRequestCount = jobRequests.filter((r) => r.status === "SUBMITTED").length;

  return (
    <div className="space-y-10 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">
          {contractor?.companyName ?? "Contractor"} dashboard
        </h1>
        <p className="text-sm text-slate-600">Submit a job request and track its status.</p>
      </div>

      {searchParams.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      ) : null}
      {searchParams.submitted ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Job request submitted. A dispatcher will review it shortly.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Job requests submitted" value={jobRequests.length} icon="clipboard" accent="brand" />
        <StatCard label="Pending review" value={pendingRequestCount} icon="clock" accent="amber" />
        <StatCard label="Invoices" value={invoices.length} icon="invoice" accent="sky" />
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Icon name="plus" className="h-4 w-4" />
          </span>
          <h2 className="text-lg font-semibold text-slate-900">New job request</h2>
        </div>
        <form action={submitJobRequestAction} className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Type of work
            <input
              name="jobType"
              required
              maxLength={100}
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="e.g. General labor, event setup"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Number of workers
            <input
              type="number"
              name="requestedWorkerCount"
              required
              min={1}
              max={500}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Job date
            <input type="date" name="requestedDate" required className="rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Start time
              <input type="time" name="requestedStartTime" required className="rounded-md border border-slate-300 px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              End time
              <input type="time" name="requestedEndTime" required className="rounded-md border border-slate-300 px-3 py-2" />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm text-slate-700 sm:col-span-2">
            Jobsite address
            <input name="jobsiteAddress" required maxLength={255} className="rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700 sm:col-span-2">
            Notes (optional)
            <textarea name="notes" maxLength={2000} rows={3} className="rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800"
            >
              Submit request
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <SectionHeading title="Your job requests" icon="clipboard" />
        {jobRequests.length === 0 ? (
          <p className="text-sm text-slate-500">No job requests submitted yet.</p>
        ) : (
          <div className="space-y-3">
            {jobRequests.map((request) => (
              <div key={request.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{request.jobType}</p>
                  <StatusBadge status={request.status} />
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {request.requestedWorkerCount} worker(s) on {request.requestedDate.toISOString().slice(0, 10)},{" "}
                  {request.requestedStartTime}-{request.requestedEndTime} at {request.jobsiteAddress}
                </p>
                {request.notes ? <p className="mt-1 text-xs text-slate-500">{request.notes}</p> : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeading
          title="Your invoices"
          description="Invoices are generated from hours your on-site supervisor has approved. No payment is collected through this platform yet - online payment is coming soon."
          icon="invoice"
        />
        {invoices.length === 0 ? (
          <p className="text-sm text-slate-500">No invoices yet.</p>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{invoice.invoiceNumber}</p>
                  <StatusBadge status={invoice.status} />
                </div>
                <p className="mt-1 text-sm text-slate-600">Total due: ${invoice.total.toString()}</p>
                <div className="mt-2 space-y-1">
                  {invoice.lineItems.map((li) => (
                    <p key={li.id} className="text-xs text-slate-500">
                      {li.description}: {li.quantity.toString()} hrs x ${li.rate.toString()}/hr = ${li.amount.toString()}
                    </p>
                  ))}
                  {invoice.adjustments.map((adj) => (
                    <p key={adj.id} className="text-xs text-amber-700">
                      Adjustment: ${adj.amount.toString()} - {adj.reason}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
