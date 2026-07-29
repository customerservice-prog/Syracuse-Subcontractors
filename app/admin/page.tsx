import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getActingUser } from "@/lib/auth/get-acting-user";
import { StatusBadge } from "@/components/status-badge";
import {
  approveContractorInterestAction,
  transitionApplicationAction,
  convertJobRequestAction,
  findCandidatesAction,
  sendOfferAction,
  approveTimeEntryAction,
  generateInvoiceAction,
  addInvoiceAdjustmentAction,
  transitionInvoiceStatusAction,
  createCrewAction,
  addCrewMemberAction,
  removeCrewMemberAction,
} from "./actions";
import { listJobsForAdmin } from "@/lib/services/job.service";
import { listOpenPositionsForAdmin, expireStaleOffers } from "@/lib/services/dispatch.service";
import { runReminderSweep } from "@/lib/services/reminders.service";
import { listTimeEntriesAwaitingApproval } from "@/lib/services/time.service";
import {
  listContractorsWithUninvoicedApprovedHours,
  listInvoicesForAdmin,
} from "@/lib/services/invoice.service";
import { listCrewsForAdmin, listActiveWorkersForCrewAssignment } from "@/lib/services/crew.service";
import { listRecentNotificationsForAdmin } from "@/lib/services/notification.service";

export const dynamic = "force-dynamic";

const INVOICE_NEXT_STATUSES: Record<string, string[]> = {
  DRAFT: ["SENT", "VOID"],
  SENT: ["VIEWED", "PARTIALLY_PAID", "PAID", "OVERDUE", "DISPUTED", "VOID"],
  VIEWED: ["PARTIALLY_PAID", "PAID", "OVERDUE", "DISPUTED", "VOID"],
  PARTIALLY_PAID: ["PAID", "OVERDUE", "DISPUTED", "VOID"],
  OVERDUE: ["PARTIALLY_PAID", "PAID", "DISPUTED", "VOID"],
  DISPUTED: ["SENT", "VOID"],
  PAID: [],
  VOID: [],
};

const GEOFENCE_ADMIN_LABELS: Record<string, string> = {
  WITHIN_RANGE: "on-site (verified)",
  OUT_OF_RANGE: "outside expected radius",
  NO_JOB_LOCATION: "jobsite location not on file",
  LOCATION_UNAVAILABLE: "location unavailable",
};

const ICON_PATHS = {
  building:
    "M3 21h18M5 21V6a1 1 0 0 1 1-1h5v16M12 21V10a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v11M8 8h.01M8 12h.01M8 16h.01M16 12h.01M16 16h.01",
  clipboard:
    "M9 4h6a1 1 0 0 1 1 1v1h1a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h1V5a1 1 0 0 1 1-1Zm0 0v2h6V4M9 12h6M9 16h6",
  send: "M3 12 20 4l-7 17-3-7-7-2Z",
  clock: "M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  invoice: "M8 3h8a1 1 0 0 1 1 1v16l-3-2-2 2-2-2-3 2V4a1 1 0 0 1 1-1Zm1 5h6M9 11h6M9 14h4",
  briefcase:
    "M4 8h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Zm4 0V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18",
  bell: "M12 3a3 3 0 0 0-3 3v1.2C7.2 8 6 9.9 6 12v3l-1.5 2.5h15L18 15v-3c0-2.1-1.2-4-3-4.8V6a3 3 0 0 0-3-3Zm-2 15a2 2 0 0 0 4 0",
  users:
    "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1m2 0v-1a4 4 0 0 0-3-3.87",
  userPlus:
    "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 9v-1a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v1M18 8v6M15 11h6",
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
  accent: "brand" | "emerald" | "amber" | "sky";
}) {
  const accentClasses: Record<string, string> = {
    brand: "bg-brand-50 text-brand-700",
    emerald: "bg-emerald-50 text-emerald-700",
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

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const actingUser = await getActingUser();
  if (!actingUser || (actingUser.role !== "SUPER_ADMIN" && actingUser.role !== "DISPATCHER")) {
    redirect("/login");
  }

  await expireStaleOffers();
  await runReminderSweep();
  const [
    pendingContractorInterests,
    pendingJobRequests,
    reviewApplications,
    activeWorkerCount,
    activeContractorCount,
    jobs,
    openPositions,
    timeEntriesAwaitingApproval,
    contractorsWithUninvoicedHours,
    invoices,
    crews,
    activeWorkersForCrewAssignment,
    recentNotifications,
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
    listJobsForAdmin(),
    listOpenPositionsForAdmin(),
    listTimeEntriesAwaitingApproval(),
    listContractorsWithUninvoicedApprovedHours(),
    listInvoicesForAdmin(),
    listCrewsForAdmin(),
    listActiveWorkersForCrewAssignment(),
    listRecentNotificationsForAdmin(),
  ]);

  return (
    <div className="space-y-10 py-8">
      <div id="overview" className="scroll-mt-24 space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Admin dashboard</h1>
        <p className="text-sm text-slate-600">
          Signed in as {actingUser.role.replace("_", " ").toLowerCase()}.
        </p>
      </div>

      {searchParams.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Active workers" value={activeWorkerCount} icon="users" accent="brand" />
        <StatCard label="Approved contractors" value={activeContractorCount} icon="building" accent="emerald" />
        <StatCard
          label="Pending contractor interests"
          value={pendingContractorInterests.length}
          icon="clipboard"
          accent="amber"
        />
        <StatCard label="Applications to review" value={reviewApplications.length} icon="userPlus" accent="sky" />
      </div>
      <section id="interests" className="scroll-mt-24 space-y-4">
        <SectionHeading title="Pending contractor interests" icon="building" />
        {pendingContractorInterests.length === 0 ? (
          <p className="text-sm text-slate-500">No pending contractor interests.</p>
        ) : (
          <div className="space-y-3">
            {pendingContractorInterests.map((interest) => (
              <div key={interest.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
                      className="whitespace-nowrap rounded-md bg-brand-700 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800"
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

      <section id="job-requests" className="scroll-mt-24 space-y-4">
        <SectionHeading title="Pending job requests" icon="clipboard" />
        {pendingJobRequests.length === 0 ? (
          <p className="text-sm text-slate-500">No job requests awaiting review.</p>
        ) : (
          <div className="space-y-3">
            {pendingJobRequests.map((request) => (
              <div key={request.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="font-semibold text-slate-900">
                  {request.contractor.companyName} - {request.jobType}
                </p>
                <p className="text-sm text-slate-600">
                  {request.requestedWorkerCount} worker(s) on{" "}
                  {request.requestedDate.toISOString().slice(0, 10)}, {request.requestedStartTime}-
                  {request.requestedEndTime} at {request.jobsiteAddress}
                </p>
                {request.notes ? <p className="mt-1 text-xs text-slate-500">{request.notes}</p> : null}

                <form action={convertJobRequestAction} className="mt-3 grid gap-2 sm:grid-cols-4">
                  <input type="hidden" name="jobRequestId" value={request.id} />
                  <input
                    name="workerPayRate"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="Worker pay rate ($/hr)"
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                  />
                  <input
                    name="contractorBillRate"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="Contractor bill rate ($/hr)"
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                  />
                  <input
                    name="supervisorName"
                    placeholder="Supervisor name (optional)"
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                  />
                  <button
                    type="submit"
                    className="whitespace-nowrap rounded-md bg-brand-700 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800"
                  >
                    Create job &amp; shifts
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
      <section id="dispatch" className="scroll-mt-24 space-y-4">
        <SectionHeading
          title="Dispatch: open positions"
          description="Find eligible workers for an open position, then send an offer to one worker at a time - offers are never blasted to every worker at once. If a worker declines or an offer expires, the next-ranked eligible candidate is offered automatically."
          icon="send"
        />
        {openPositions.length === 0 ? (
          <p className="text-sm text-slate-500">No open or offered positions right now.</p>
        ) : (
          <div className="space-y-3">
            {openPositions.map(({ position, latestRunGeneratedAt, topCandidates }) => (
              <div key={position.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {position.shift.job.contractor.companyName} - {position.shift.job.address}
                    </p>
                    <p className="text-sm text-slate-600">
                      {position.shift.shiftDate.toISOString().slice(0, 10)}, {position.shift.startTime}-
                      {position.shift.endTime}
                    </p>
                  </div>
                  <StatusBadge status={position.status} />
                </div>

                {position.requiredSkills.length > 0 ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Requires:{" "}
                    {position.requiredSkills
                      .map((r) => `${r.skill.name} (${r.minimumLevel.replace("_", " ").toLowerCase()}+)`)
                      .join(", ")}
                  </p>
                ) : null}

                {position.offers.length > 0 ? (
                  <p className="mt-1 text-xs text-amber-700">
                    {position.offers.length} offer(s) currently pending a worker response.
                  </p>
                ) : null}

                <form action={findCandidatesAction} className="mt-3">
                  <input type="hidden" name="positionId" value={position.id} />
                  <button className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                    {latestRunGeneratedAt ? "Re-run matching" : "Find matching workers"}
                  </button>
                </form>

                {topCandidates.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top ranked candidates</p>
                    {topCandidates.map((candidate) => (
                      <div
                        key={candidate.workerProfileId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <p className="text-sm text-slate-700">
                          #{candidate.rank} {candidate.name} - score {candidate.totalScore?.toFixed(2)}
                          {candidate.alreadyOffered ? " (already offered)" : ""}
                        </p>
                        {!candidate.alreadyOffered ? (
                          <form action={sendOfferAction}>
                            <input type="hidden" name="positionId" value={position.id} />
                            <input type="hidden" name="workerProfileId" value={candidate.workerProfileId} />
                            <button className="rounded-md bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800">
                              Send offer
                            </button>
                          </form>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : latestRunGeneratedAt ? (
                  <p className="mt-2 text-xs text-slate-500">No eligible candidates found in the last matching run.</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
      <section id="hours" className="scroll-mt-24 space-y-4">
        <SectionHeading
          title="Hours awaiting approval"
          description="Workers have checked out of these shifts. Approve worked hours to mark the assignment complete and record a positive reliability event; approving is never automatic."
          icon="clock"
        />
        {timeEntriesAwaitingApproval.length === 0 ? (
          <p className="text-sm text-slate-500">No hours are currently awaiting approval.</p>
        ) : (
          <div className="space-y-3">
            {timeEntriesAwaitingApproval.map(({ timeEntry, hoursWorked }) => {
              const application = timeEntry.assignment.workerProfile.application;
              const job = timeEntry.assignment.position.shift.job;
              return (
                <div key={timeEntry.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {application.firstName} {application.lastName} - {job.contractor.companyName}
                      </p>
                      <p className="text-sm text-slate-600">{job.address}</p>
                    </div>
                    <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-600">
                      {hoursWorked !== null ? `${hoursWorked.toFixed(2)} hrs` : "hours unknown"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Checked in {timeEntry.checkInServerAt?.toISOString().slice(0, 16).replace("T", " ")} - checked out{" "}
                    {timeEntry.checkOutServerAt?.toISOString().slice(0, 16).replace("T", " ")}
                  </p>
                  {timeEntry.geofenceResult ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Check-in location: {GEOFENCE_ADMIN_LABELS[timeEntry.geofenceResult] ?? timeEntry.geofenceResult.toLowerCase()}
                      {timeEntry.checkInLat !== null && timeEntry.checkInLng !== null
                        ? ` (${timeEntry.checkInLat.toFixed(4)}, ${timeEntry.checkInLng.toFixed(4)})`
                        : ""}
                    </p>
                  ) : null}
                  <form action={approveTimeEntryAction} className="mt-3">
                    <input type="hidden" name="timeEntryId" value={timeEntry.id} />
                    <button className="rounded-md bg-brand-700 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800">
                      Approve hours
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <section id="invoices" className="scroll-mt-24 space-y-4">
        <SectionHeading
          title="Generate invoices"
          description="Contractors below have approved, not-yet-invoiced hours. Generating an invoice always produces a new DRAFT - nothing is sent to the contractor and no payment is processed until you explicitly move it forward."
          icon="invoice"
        />
        {contractorsWithUninvoicedHours.length === 0 ? (
          <p className="text-sm text-slate-500">No contractors currently have approved hours awaiting invoicing.</p>
        ) : (
          <div className="space-y-3">
            {contractorsWithUninvoicedHours.map((c) => (
              <div
                key={c.contractorId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">{c.companyName}</span> - {c.assignmentCount} approved
                  shift(s) not yet invoiced
                </p>
                <form action={generateInvoiceAction}>
                  <input type="hidden" name="contractorId" value={c.contractorId} />
                  <button className="rounded-md bg-brand-700 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800">
                    Generate draft invoice
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeading title="All invoices" icon="invoice" />
        {invoices.length === 0 ? (
          <p className="text-sm text-slate-500">No invoices have been generated yet.</p>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => {
              const nextStatuses = INVOICE_NEXT_STATUSES[invoice.status] ?? [];
              return (
                <div key={invoice.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {invoice.invoiceNumber} - {invoice.contractor.companyName}
                      </p>
                      <p className="text-sm text-slate-600">Total: ${invoice.total.toString()}</p>
                    </div>
                    <StatusBadge status={invoice.status} />
                  </div>

                  <div className="mt-2 space-y-1">
                    {invoice.lineItems.map((li) => (
                      <p key={li.id} className="text-xs text-slate-500">
                        {li.description}: {li.quantity.toString()} x ${li.rate.toString()} = ${li.amount.toString()}
                      </p>
                    ))}
                    {invoice.adjustments.map((adj) => (
                      <p key={adj.id} className="text-xs text-amber-700">
                        Adjustment: ${adj.amount.toString()} - {adj.reason}
                      </p>
                    ))}
                  </div>

                  {invoice.status === "DRAFT" ? (
                    <form action={addInvoiceAdjustmentAction} className="mt-3 grid gap-2 sm:grid-cols-4">
                      <input type="hidden" name="invoiceId" value={invoice.id} />
                      <input
                        name="amount"
                        type="number"
                        step="0.01"
                        required
                        placeholder="Adjustment amount ($)"
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                      />
                      <input
                        name="reason"
                        required
                        placeholder="Reason"
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-xs sm:col-span-2"
                      />
                      <button className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                        Add adjustment
                      </button>
                    </form>
                  ) : null}

                  {nextStatuses.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {nextStatuses.map((status) => (
                        <form key={status} action={transitionInvoiceStatusAction}>
                          <input type="hidden" name="invoiceId" value={invoice.id} />
                          <input type="hidden" name="toStatus" value={status} />
                          <button className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                            Mark {status.replace("_", " ").toLowerCase()}
                          </button>
                        </form>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
      <section id="jobs" className="scroll-mt-24 space-y-4">
        <SectionHeading title="Active jobs" icon="briefcase" />
        {jobs.length === 0 ? (
          <p className="text-sm text-slate-500">No jobs created yet.</p>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const positions = job.shifts.flatMap((shift) => shift.positions);
              const filledCount = positions.filter((p) => p.status === "FILLED").length;
              return (
                <div key={job.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">
                      {job.contractor.companyName} - {job.address}
                    </p>
                    <StatusBadge status={job.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {filledCount} / {positions.length} position(s) filled across {job.shifts.length} shift(s)
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section id="notifications" className="scroll-mt-24 space-y-4">
        <SectionHeading
          title="Recent notifications"
          description="Every dispatch, hours, and invoice event creates a notification record with a full delivery history. Email/SMS providers are mock (log-only) until real credentials are configured."
          icon="bell"
        />
        {recentNotifications.length === 0 ? (
          <p className="text-sm text-slate-500">No notifications recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {recentNotifications.map((event) => {
              const attempts = event.recipients.flatMap((r) => r.deliveryAttempts);
              return (
                <div key={event.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{event.type.replace(/_/g, " ")}</p>
                    <span className="text-xs text-slate-500">
                      {event.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {event.entityType} - {event.recipients.length} recipient(s)
                  </p>
                  {attempts.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {attempts.map((attempt) => (
                        <span key={attempt.id} className="inline-flex items-center gap-1 text-xs text-slate-500">
                          {attempt.channel}: <StatusBadge status={attempt.status} />
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400">No delivery attempts recorded (no contact info on file).</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
      <section id="crews" className="scroll-mt-24 space-y-4">
        <SectionHeading
          title="Crews"
          description="Crews are admin-managed in this MVP. Membership changes are tracked as history - removing a member ends their membership rather than deleting the record."
          icon="users"
        />

        <form action={createCrewAction} className="flex flex-wrap items-center gap-2">
          <input
            name="name"
            required
            placeholder="New crew name"
            className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
          />
          <button className="rounded-md bg-brand-700 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800">
            Create crew
          </button>
        </form>

        {crews.length === 0 ? (
          <p className="text-sm text-slate-500">No crews created yet.</p>
        ) : (
          <div className="space-y-3">
            {crews.map((crew) => (
              <div key={crew.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{crew.name}</p>
                  <StatusBadge status={crew.status} />
                </div>

                {crew.averageRating !== null ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Average contractor rating: {crew.averageRating.toFixed(1)} / 5 ({crew.ratingCount} rating(s))
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">No contractor ratings yet.</p>
                )}

                <div className="mt-2 space-y-1">
                  {crew.members.length === 0 ? (
                    <p className="text-xs text-slate-500">No active members.</p>
                  ) : (
                    crew.members.map((member) => (
                      <div
                        key={member.membershipId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <p className="text-xs text-slate-700">
                          {member.name} - {member.role.replace("_", " ").toLowerCase()}
                          {member.isPrimaryCrew ? " (primary)" : ""}
                        </p>
                        <form action={removeCrewMemberAction}>
                          <input type="hidden" name="crewMembershipId" value={member.membershipId} />
                          <button className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">
                            Remove
                          </button>
                        </form>
                      </div>
                    ))
                  )}
                </div>

                <form action={addCrewMemberAction} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="crewId" value={crew.id} />
                  <select
                    name="workerProfileId"
                    required
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                  >
                    <option value="">Select worker...</option>
                    {activeWorkersForCrewAssignment.map((w) => (
                      <option key={w.workerProfileId} value={w.workerProfileId}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                  <select name="role" className="rounded-md border border-slate-300 px-2 py-1.5 text-xs">
                    <option value="MEMBER">Member</option>
                    <option value="ASSISTANT_LEADER">Assistant leader</option>
                    <option value="LEADER">Leader</option>
                  </select>
                  <button className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                    Add member
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
      <section id="applications" className="scroll-mt-24 space-y-4">
        <SectionHeading title="Applications to review" icon="userPlus" />
        {reviewApplications.length === 0 ? (
          <p className="text-sm text-slate-500">No applications waiting on a decision.</p>
        ) : (
          <div className="space-y-3">
            {reviewApplications.map((application) => (
              <div key={application.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {application.firstName} {application.lastName}
                      </p>
                      <StatusBadge status={application.status} />
                    </div>
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
                      <button className="rounded-md bg-brand-700 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800">
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
