import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getActingUser } from "@/lib/auth/get-acting-user";
import { getWorkerProfile } from "@/lib/services/worker.service";
import {
  acceptOfferAction,
  declineOfferAction,
  checkInAction,
  checkOutAction,
} from "./actions";

// Worker dashboard for Phase 1/2/3. Like the admin dashboard, this is
// intentionally read-heavy for now - updating availability lands in a later
// increment per docs/PHASE1-DESIGN.md. This page only ever shows a worker
// their OWN data; canViewWorkerProfile / canRespondToOffer /
// canCheckInOutAssignment enforce that server-side, and being active here
// never implies guaranteed hours.
export const dynamic = "force-dynamic";

export default async function WorkerPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const actingUser = await getActingUser();

  if (!actingUser || actingUser.role !== "WORKER" || !actingUser.workerProfileId) {
    redirect("/login");
  }

  const workerProfileId = actingUser.workerProfileId as string;

  const [workerProfile, upcomingAssignments, pendingOffers] = await Promise.all([
    getWorkerProfile(actingUser, workerProfileId),
    db.shiftAssignment.findMany({
      where: {
        workerProfileId,
        isCurrent: true,
        status: { in: ["PENDING", "CONFIRMED", "ACTIVE"] },
      },
      include: {
        position: { include: { shift: { include: { job: { include: { contractor: true } } } } } },
        timeEntry: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.offer.findMany({
      where: { workerProfileId, status: { in: ["SENT", "VIEWED", "QUEUED"] } },
      include: {
        position: { include: { shift: { include: { job: { include: { contractor: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!workerProfile) {
    redirect("/login");
  }

  const application = await db.application.findUnique({
    where: { id: workerProfile.applicationId },
  });

  return (
    <div className="space-y-10 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Your worker dashboard</h1>
        <p className="text-sm text-slate-600">
          Status: <span className="font-medium">{workerProfile.status.replace("_", " ").toLowerCase()}</span>
          {application ? ` - application ${application.status.replace("_", " ").toLowerCase()}` : ""}
        </p>
      </div>

      {searchParams.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      ) : null}

      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Shifts are offered based on contractor demand and your skills/availability. Being active does not
        guarantee hours - check back here for new offers.
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Your skills</h2>
        {workerProfile.skills.length === 0 ? (
          <p className="text-sm text-slate-500">No skills on file yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {workerProfile.skills.map((s) => (
              <span
                key={s.id}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700"
              >
                {s.skill.name} - {s.level.replace("_", " ").toLowerCase()}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Pending offers</h2>
        {pendingOffers.length === 0 ? (
          <p className="text-sm text-slate-500">No open offers right now.</p>
        ) : (
          <div className="space-y-3">
            {pendingOffers.map((offer) => (
              <div key={offer.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="font-semibold text-slate-900">
                  {offer.position.shift.job.contractor.companyName}
                </p>
                <p className="text-sm text-slate-600">
                  {offer.position.shift.shiftDate.toISOString().slice(0, 10)}, {offer.position.shift.startTime}-
                  {offer.position.shift.endTime} at {offer.position.shift.job.address}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Pay rate: ${offer.position.workerPayRateSnapshot.toString()}/hr
                  {offer.expiresAt ? ` - offer expires ${offer.expiresAt.toISOString().slice(0, 16).replace("T", " ")}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={acceptOfferAction}>
                    <input type="hidden" name="offerId" value={offer.id} />
                    <button className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">
                      Accept
                    </button>
                  </form>
                  <form action={declineOfferAction}>
                    <input type="hidden" name="offerId" value={offer.id} />
                    <button className="rounded-md border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
                      Decline
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Upcoming shifts</h2>
        {upcomingAssignments.length === 0 ? (
          <p className="text-sm text-slate-500">No upcoming shifts scheduled.</p>
        ) : (
          <div className="space-y-3">
            {upcomingAssignments.map((assignment) => (
              <div key={assignment.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="font-semibold text-slate-900">
                  {assignment.position.shift.job.contractor.companyName}
                </p>
                <p className="text-sm text-slate-600">
                  {assignment.position.shift.shiftDate.toISOString().slice(0, 10)}, {assignment.position.shift.startTime}-
                  {assignment.position.shift.endTime} at {assignment.position.shift.job.address}
                </p>
                <p className="mt-1 text-xs text-slate-500">Assignment status: {assignment.status.toLowerCase()}</p>

                {!assignment.timeEntry ? (
                  <form action={checkInAction} className="mt-3">
                    <input type="hidden" name="assignmentId" value={assignment.id} />
                    <button className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">
                      Check in
                    </button>
                  </form>
                ) : assignment.timeEntry.status === "CHECKED_IN" ? (
                  <form action={checkOutAction} className="mt-3">
                    <input type="hidden" name="assignmentId" value={assignment.id} />
                    <button className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">
                      Check out
                    </button>
                  </form>
                ) : assignment.timeEntry.status === "PENDING_APPROVAL" ? (
                  <p className="mt-3 text-xs font-medium text-amber-700">
                    Checked out - your hours are awaiting approval.
                  </p>
                ) : assignment.timeEntry.status === "APPROVED" ? (
                  <p className="mt-3 text-xs font-medium text-emerald-700">Hours approved.</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
