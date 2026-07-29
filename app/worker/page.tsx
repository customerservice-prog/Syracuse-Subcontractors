import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getActingUser } from "@/lib/auth/get-acting-user";
import { getWorkerProfile } from "@/lib/services/worker.service";
import { StatusBadge } from "@/components/status-badge";
import {
  acceptOfferAction,
  declineOfferAction,
  checkInAction,
  checkOutAction,
} from "./actions";
import { CheckInOutButton } from "./check-in-out-button";

// Worker dashboard for Phase 1/2/3. Like the admin dashboard, this is
// intentionally read-heavy for now - updating availability lands in a later
// increment per docs/PHASE1-DESIGN.md. This page only ever shows a worker
// their OWN data; canViewWorkerProfile / canRespondToOffer /
// canCheckInOutAssignment enforce that server-side, and being active here
// never implies guaranteed hours.
export const dynamic = "force-dynamic";

const GEOFENCE_LABELS: Record<string, string> = {
  WITHIN_RANGE: "Location verified on-site.",
  OUT_OF_RANGE: "Check-in location was outside the expected jobsite radius.",
  NO_JOB_LOCATION: "Jobsite location isn't on file yet, so location couldn't be verified.",
  LOCATION_UNAVAILABLE: "Location wasn't available for this check-in.",
};

const ICON_PATHS = {
  star: "M12 3.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7L12 3.5Z",
  send: "M3 12 20 4l-7 17-3-7-7-2Z",
  calendar: "M8 3v3M16 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
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
  accent: "brand" | "amber";
}) {
  const accentClasses: Record<string, string> = {
    brand: "bg-brand-50 text-brand-700",
    amber: "bg-amber-50 text-amber-700",
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
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Your worker dashboard</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span>Status:</span>
          <StatusBadge status={workerProfile.status} />
          {application ? (
            <>
              <span>- application:</span>
              <StatusBadge status={application.status} />
            </>
          ) : null}
        </div>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Pending offers" value={pendingOffers.length} icon="send" accent="brand" />
        <StatCard label="Upcoming shifts" value={upcomingAssignments.length} icon="calendar" accent="amber" />
      </div>

      <section className="space-y-4">
        <SectionHeading title="Your skills" icon="star" />
        {workerProfile.skills.length === 0 ? (
          <p className="text-sm text-slate-500">No skills on file yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {workerProfile.skills.map((s) => (
              <span
                key={s.id}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 shadow-sm"
              >
                {s.skill.name} - {s.level.replace("_", " ").toLowerCase()}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeading title="Pending offers" icon="send" />
        {pendingOffers.length === 0 ? (
          <p className="text-sm text-slate-500">No open offers right now.</p>
        ) : (
          <div className="space-y-3">
            {pendingOffers.map((offer) => (
              <div key={offer.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
                    <button className="rounded-md bg-brand-700 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800">
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
        <SectionHeading title="Upcoming shifts" icon="calendar" />
        {upcomingAssignments.length === 0 ? (
          <p className="text-sm text-slate-500">No upcoming shifts scheduled.</p>
        ) : (
          <div className="space-y-3">
            {upcomingAssignments.map((assignment) => (
              <div key={assignment.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">
                    {assignment.position.shift.job.contractor.companyName}
                  </p>
                  <StatusBadge status={assignment.status} />
                </div>
                <p className="text-sm text-slate-600">
                  {assignment.position.shift.shiftDate.toISOString().slice(0, 10)}, {assignment.position.shift.startTime}-
                  {assignment.position.shift.endTime} at {assignment.position.shift.job.address}
                </p>

                {!assignment.timeEntry ? (
                  <div className="mt-3">
                    <CheckInOutButton assignmentId={assignment.id} mode="in" action={checkInAction} />
                  </div>
                ) : assignment.timeEntry.status === "CHECKED_IN" ? (
                  <div className="mt-3 space-y-1">
                    {assignment.timeEntry.geofenceResult ? (
                      <p className="text-xs text-slate-500">
                        {GEOFENCE_LABELS[assignment.timeEntry.geofenceResult] ?? ""}
                      </p>
                    ) : null}
                    <CheckInOutButton assignmentId={assignment.id} mode="out" action={checkOutAction} />
                  </div>
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
