// Central authorization policy module.
// Every service method must call the relevant policy function before acting.
// This is enforced in the service layer so route handlers, server actions, and
// server components all get the same guarantee. Middleware only performs coarse
// route-group gating (e.g. /admin/* requires an admin/dispatcher role) as a first
// line of defense - it is never the only check.
// Ownership checks are always re-verified against the database record's actual
// owning organization/user, never inferred from the URL alone.

import type { UserRole } from "@prisma/client";

export type PolicyResult = {
  allowed: boolean;
  reason: string;
};

export type ActingUser = {
  id: string;
  role: UserRole;
  contractorId?: string | null;
  workerProfileId?: string | null;
};

function allow(reason: string): PolicyResult {
  return { allowed: true, reason };
}

function deny(reason: string): PolicyResult {
  return { allowed: false, reason };
}

const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "DISPATCHER"];

function isAdmin(user: ActingUser): boolean {
  return ADMIN_ROLES.includes(user.role);
}

function isContractorStaff(user: ActingUser): boolean {
  return (
    user.role === "CONTRACTOR_OWNER" ||
    user.role === "CONTRACTOR_MANAGER" ||
    user.role === "SUPERVISOR"
  );
}

export function canViewWorkerProfile(
  user: ActingUser,
  target: { workerProfileId: string }
): PolicyResult {
  if (isAdmin(user)) return allow("Admin/dispatcher roles can view all worker profiles.");
  if (user.role === "WORKER" && user.workerProfileId === target.workerProfileId) {
    return allow("Workers can view their own profile.");
  }
  return deny("Only admins, dispatchers, or the worker themselves may view this profile.");
}

export function canViewWorkerPrivateDocuments(
  user: ActingUser,
  target: { workerProfileId: string }
): PolicyResult {
  if (isAdmin(user)) return allow("Admin/dispatcher roles may view private worker documents.");
  if (user.role === "WORKER" && user.workerProfileId === target.workerProfileId) {
    return allow("Workers may view their own private documents.");
  }
  return deny(
    "Private worker documents such as home address, personal documents, internal notes, and background-check details are never exposed to contractors."
  );
}

export function canDispatchPosition(
  user: ActingUser,
  _target: { positionId: string }
): PolicyResult {
  if (isAdmin(user)) return allow("Admin/dispatcher roles may dispatch shift positions.");
  return deny("Only admins or dispatchers may send offers or dispatch a shift position.");
}

export function canApproveTimeEntry(
  user: ActingUser,
  target: { contractorId: string }
): PolicyResult {
  if (isAdmin(user)) return allow("Admin/dispatcher roles may approve any time entry.");
  if (isContractorStaff(user) && user.contractorId === target.contractorId) {
    return allow("Contractor staff may approve time entries for their own jobs.");
  }
  return deny(
    "Only admins, dispatchers, or the owning contractor's staff may approve this time entry."
  );
}

export function canViewInvoice(
  user: ActingUser,
  target: { contractorId: string }
): PolicyResult {
  if (isAdmin(user)) return allow("Admin/dispatcher roles may view any invoice.");
  if (
    (user.role === "CONTRACTOR_OWNER" || user.role === "CONTRACTOR_MANAGER") &&
    user.contractorId === target.contractorId
  ) {
    return allow("Contractor owners/managers may view their own invoices.");
  }
  return deny(
    "Only admins, dispatchers, or the owning contractor's owner/manager may view this invoice."
  );
}

export function canModifyContractor(
  user: ActingUser,
  target: { contractorId: string }
): PolicyResult {
  if (isAdmin(user)) return allow("Admin/dispatcher roles may modify any contractor record.");
  if (user.role === "CONTRACTOR_OWNER" && user.contractorId === target.contractorId) {
    return allow("Contractor owners may modify their own contractor record.");
  }
  return deny("Only admins, dispatchers, or the contractor owner may modify this contractor record.");
}

export function canActivateWorker(
  user: ActingUser,
  _target: { workerProfileId: string }
): PolicyResult {
  if (isAdmin(user)) {
    return allow(
      "Admin/dispatcher roles may activate a worker from the waitlist, subject to capacity settings. Activation is never automatic."
    );
  }
  return deny("Worker activation is an admin-only action; activation is never automatic.");
}

export function canApproveContractor(
  user: ActingUser,
  _target: { contractorId: string }
): PolicyResult {
  if (user.role === "SUPER_ADMIN") {
    return allow("Super admins may approve a contractor interest submission into an active account.");
  }
  return deny("Only a super admin may approve a contractor account.");
}

export function canViewJobRequest(
  user: ActingUser,
  target: { contractorId: string }
): PolicyResult {
  if (isAdmin(user)) return allow("Admin/dispatcher roles may view any job request.");
  if (isContractorStaff(user) && user.contractorId === target.contractorId) {
    return allow("Contractor staff may view their own job requests.");
  }
  return deny("Only admins, dispatchers, or the owning contractor's staff may view this job request.");
}

export function canConvertJobRequestToJob(
  user: ActingUser,
  _target: { contractorId: string }
): PolicyResult {
  if (isAdmin(user)) {
    return allow("Admin/dispatcher roles may convert a job request into a schedulable job with shifts and positions.");
  }
  return deny("Only admins or dispatchers may convert a job request into a job.");
}

export function canManageApplicationLifecycle(user: ActingUser): PolicyResult {
  if (isAdmin(user)) {
    return allow("Admin/dispatcher roles may manage application status transitions.");
  }
  return deny("Only admins or dispatchers may transition an application's status.");
}
