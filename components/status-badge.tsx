// Generic status pill used across the admin, contractor, and worker
// dashboards. Colors are keyed off common keywords shared by the many
// status enums in prisma/schema.prisma (JobStatus, InvoiceStatus,
// OfferStatus, ShiftAssignmentStatus, ApplicationStatus, ContractorStatus,
// WorkerStatus, TimeEntryStatus, ShiftPositionStatus, etc.) rather than one
// mapping per enum, so the badge stays visually correct as new statuses are
// added elsewhere without needing to touch this file.
const POSITIVE = new Set([
  "COMPLETED",
  "APPROVED",
  "ACTIVE",
  "PAID",
  "VERIFIED",
  "CONFIRMED",
  "ACCEPTED",
  "FILLED",
  "ACTIVATED",
]);

const WARNING = new Set([
  "PENDING",
  "SUBMITTED",
  "DRAFT",
  "QUEUED",
  "OFFERED",
  "SENT",
  "UNDER_REVIEW",
  "WAITLISTED",
  "PENDING_APPROVAL",
  "PENDING_REVIEW",
  "PARTIALLY_FILLED",
  "PARTIALLY_PAID",
  "CHECKED_IN",
  "CHECKED_OUT",
  "VIEWED",
  "DISPATCHING",
  "REQUESTED",
  "QUOTED",
  "IN_PROGRESS",
  "INTERVIEW_REQUESTED",
  "DOCUMENTS_REQUESTED",
  "LEAD",
  "PENDING_VERIFICATION",
]);

const NEGATIVE = new Set([
  "CANCELED",
  "REJECTED",
  "DISPUTED",
  "FAILED",
  "NO_SHOW",
  "EXPIRED",
  "OVERDUE",
  "SUSPENDED",
  "DECLINED",
  "WORKER_CANCELED",
  "CONTRACTOR_CANCELED",
  "DELIVERY_FAILED",
  "DISABLED",
]);

const NEUTRAL = new Set([
  "VOID",
  "WITHDRAWN",
  "ARCHIVED",
  "INACTIVE",
  "SUPERSEDED",
  "REPLACED",
  "POSITION_FILLED",
]);

function toneClasses(status: string): string {
  const key = status.toUpperCase();
  if (POSITIVE.has(key)) return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
  if (WARNING.has(key)) return "bg-amber-50 text-amber-700 ring-amber-600/20";
  if (NEGATIVE.has(key)) return "bg-red-50 text-red-700 ring-red-600/20";
  if (NEUTRAL.has(key)) return "bg-slate-100 text-slate-600 ring-slate-500/20";
  return "bg-blue-50 text-blue-700 ring-blue-600/20";
}

function formatLabel(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${toneClasses(
        status
      )}`}
    >
      {formatLabel(status)}
    </span>
  );
}
