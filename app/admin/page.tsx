import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getActingUser } from "@/lib/auth/get-acting-user";
import { approveContractorInterestAction, transitionApplicationAction } from "./actions";

// Admin/dispatcher dashboard overview for Phase 1. This is intentionally a
// read-heavy screen with a small number of high-value actions (approve a
// contractor, move an application forward) rather than a full workspace -
// dispatch, offers, and time approval land in later phases per
// docs/PHASE1-DESIGN.md.
//
// This page reads live, per-request data (auth session plus several DB
// queries) and must never be statically prerendered at build time.
export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const actingUser = await getActingUser();
  if (!actingUser || (actingUser.role !== "SUPER_ADMIN" && actingUser.role !== "DISPATCHER")) {
    redirect("/login");
  }

  const [
    pendingContractorInterests,
    pendingJobRequests,
    reviewApplications,
    activeWorkerCount,
    activeContractorCount,
  ] = await Promise.all([
    db.contractorInterest.findMany({
      where: { contractor: null },
      orderBy: { createdAt: "desc" },
    }),
    db.jobRequest.findMany({
      where: { status: "SUBMITTED" },
      include: { contractor: true },
      orderBy: { createdAt: "asc" },
    }),
    db.application.findMany({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "WAITLISTED"] } },
      include: { skillInterests: { include: { skill: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.workerProfile.count({ where: { status: "ACTIVE" } }),
    db.contractor.count({ where: { status: "APPROVED" } }),
  ]);

  return (
    <div className="space-y-10 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Admin dashboard</h1>
        <p className="text-sm text-slate-600">Signed in as {actingUser.role.replace("_", " ").toLowerCase()}.</p>
      </div>

      {searchParams.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active workers</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{activeWorkerCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Approved contractors</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{activeContractorCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Pending contractor interests</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{pendingContractorInterests.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Applications to review</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{reviewApplications.length}</p>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Pending contractor interests</h2>
        {pendingContractorInterests.length === 0 ? (
          <p className="text-sm text-slate-500">No pending contractor interests.</p>
        ) : (
          <div className="space-y-3">
            {pendingContractorInterests.map((interest) => (
              <div key={interest.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{interest.companyName}</p>
                    <p className="text-sm text-slate-600">
                      {interest.contactName} - {interest.contactEmail} - {interest.contactPhone}
                    </p>
                    {interest.notes ? (
                      <p className="mt-2 text-sm text-slate-500">{interest.notes}</p>
                    ) : null}
                  </div>
                  <form action={approveContractorInterestAction} className="flex items-center gap-2">
                    <input type="hidden" name="contractorInterestId" value={interest.id} />
                    <input type="hidden" name="companyName" value={interest.companyName} />
                    <input type="hidden" name="inviteEmail" value={interest.contactEmail} />
                    <button
                      type="submit"
                      className="whitespace-nowrap rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                    >
                      Approve and invite
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Pending job requests</h2>
        {pendingJobRequests.length === 0 ? (
          <p className="text-sm text-slate-500">No job requests awaiting review.</p>
        ) : (
          <div className="space-y-3">
            {pendingJobRequests.map((request) => (
              <div key={request.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="font-semibold text-slate-900">
                  {request.contractor.companyName} - {request.jobType}
                </p>
                <p className="text-sm text-slate-600">
                  {request.requestedWorkerCount} worker(s) on{" "}
                  {request.requestedDate.toISOString().slice(0, 10)}, {request.requestedStartTime}-
                  {request.requestedEndTime} at {request.jobsiteAddress}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Applications to review</h2>
        {reviewApplications.length === 0 ? (
          <p className="text-sm text-slate-500">No applications waiting on a decision.</p>
        ) : (
          <div className="space-y-3">
            {reviewApplications.map((application) => (
              <div key={application.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {application.firstName} {application.lastName} - {application.status}
                    </p>
                    <p className="text-sm text-slate-600">
                      {application.email} - {application.phone}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {application.skillInterests.map((interest) => interest.skill.name).join(", ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <form action={transitionApplicationAction}>
                      <input type="hidden" name="applicationId" value={application.id} />
                      <input type="hidden" name="toStatus" value="UNDER_REVIEW" />
                      <button className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                        Mark under review
                      </button>
                    </form>
                    <form action={transitionApplicationAction}>
                      <input type="hidden" name="applicationId" value={application.id} />
                      <input type="hidden" name="toStatus" value="WAITLISTED" />
                      <button className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                        Waitlist
                      </button>
                    </form>
                    <form action={transitionApplicationAction}>
                      <input type="hidden" name="applicationId" value={application.id} />
                      <input type="hidden" name="toStatus" value="APPROVED" />
                      <button className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">
                        Approve
                      </button>
                    </form>
                    <form action={transitionApplicationAction}>
                      <input type="hidden" name="applicationId" value={application.id} />
                      <input type="hidden" name="toStatus" value="REJECTED" />
                      <button className="rounded-md border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
