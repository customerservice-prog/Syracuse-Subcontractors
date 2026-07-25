import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getActingUser } from "@/lib/auth/get-acting-user";
import { submitJobRequestAction } from "./actions";

// Contractor dashboard for Phase 1/2: submit a new job request and track the
// status of requests already submitted. Matching, dispatch, and detailed
// fill status land in later phases per docs/PHASE1-DESIGN.md - for now a
// contractor can see their request queue and its coarse status. This page
// only ever reads/writes data scoped to the acting user's own contractorId;
// lib/services/contractor.service.ts re-checks that server-side.
export const dynamic = "force-dynamic";

const CONTRACTOR_STAFF_ROLES = ["CONTRACTOR_OWNER", "CONTRACTOR_MANAGER", "SUPERVISOR"];

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

  const [contractor, jobRequests] = await Promise.all([
    db.contractor.findUnique({ where: { id: contractorId } }),
    db.jobRequest.findMany({
      where: { contractorId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

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

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">New job request</h2>
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
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Submit request
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Your job requests</h2>
        {jobRequests.length === 0 ? (
          <p className="text-sm text-slate-500">No job requests submitted yet.</p>
        ) : (
          <div className="space-y-3">
            {jobRequests.map((request) => (
              <div key={request.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{request.jobType}</p>
                  <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-600">
                    {request.status.replace("_", " ").toLowerCase()}
                  </span>
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
    </div>
  );
}
