import { describe, expect, it } from "vitest";
import {
  canActivateWorker,
  canApproveContractor,
  canApproveTimeEntry,
  canDispatchPosition,
  canManageApplicationLifecycle,
  canModifyContractor,
  canViewInvoice,
  canViewJobRequest,
  canViewWorkerPrivateDocuments,
  canViewWorkerProfile,
  type ActingUser,
} from "@/lib/authz/policies";

function user(overrides: Partial<ActingUser>): ActingUser {
  return {
    id: "user-1",
    role: "WORKER",
    contractorId: null,
    workerProfileId: null,
    ...overrides,
  };
}

describe("canViewWorkerProfile", () => {
  it("allows admins to view any worker profile", () => {
    const result = canViewWorkerProfile(user({ role: "SUPER_ADMIN" }), { workerProfileId: "wp-1" });
    expect(result.allowed).toBe(true);
  });

  it("allows a worker to view their own profile", () => {
    const result = canViewWorkerProfile(user({ role: "WORKER", workerProfileId: "wp-1" }), {
      workerProfileId: "wp-1",
    });
    expect(result.allowed).toBe(true);
  });

  it("denies a worker viewing a different worker's profile", () => {
    const result = canViewWorkerProfile(user({ role: "WORKER", workerProfileId: "wp-1" }), {
      workerProfileId: "wp-2",
    });
    expect(result.allowed).toBe(false);
  });

  it("denies contractor staff from viewing a worker profile directly", () => {
    const result = canViewWorkerProfile(user({ role: "CONTRACTOR_OWNER", contractorId: "c-1" }), {
      workerProfileId: "wp-1",
    });
    expect(result.allowed).toBe(false);
  });
});

describe("canViewWorkerPrivateDocuments", () => {
  it("never allows contractor staff to view private worker documents", () => {
    const result = canViewWorkerPrivateDocuments(
      user({ role: "CONTRACTOR_MANAGER", contractorId: "c-1" }),
      { workerProfileId: "wp-1" }
    );
    expect(result.allowed).toBe(false);
  });

  it("allows a worker to view their own private documents", () => {
    const result = canViewWorkerPrivateDocuments(user({ role: "WORKER", workerProfileId: "wp-1" }), {
      workerProfileId: "wp-1",
    });
    expect(result.allowed).toBe(true);
  });
});

describe("canDispatchPosition", () => {
  it("only allows admin/dispatcher roles", () => {
    expect(canDispatchPosition(user({ role: "DISPATCHER" }), { positionId: "p-1" }).allowed).toBe(true);
    expect(canDispatchPosition(user({ role: "WORKER" }), { positionId: "p-1" }).allowed).toBe(false);
    expect(
      canDispatchPosition(user({ role: "CONTRACTOR_OWNER", contractorId: "c-1" }), { positionId: "p-1" })
        .allowed
    ).toBe(false);
  });
});

describe("canApproveTimeEntry", () => {
  it("allows the owning contractor's staff", () => {
    const result = canApproveTimeEntry(user({ role: "CONTRACTOR_OWNER", contractorId: "c-1" }), {
      contractorId: "c-1",
    });
    expect(result.allowed).toBe(true);
  });

  it("denies staff from a different contractor", () => {
    const result = canApproveTimeEntry(user({ role: "CONTRACTOR_OWNER", contractorId: "c-1" }), {
      contractorId: "c-2",
    });
    expect(result.allowed).toBe(false);
  });
});

describe("canViewInvoice", () => {
  it("denies a supervisor role even for their own contractor", () => {
    const result = canViewInvoice(user({ role: "SUPERVISOR", contractorId: "c-1" }), {
      contractorId: "c-1",
    });
    expect(result.allowed).toBe(false);
  });

  it("allows a contractor owner viewing their own invoice", () => {
    const result = canViewInvoice(user({ role: "CONTRACTOR_OWNER", contractorId: "c-1" }), {
      contractorId: "c-1",
    });
    expect(result.allowed).toBe(true);
  });
});

describe("canModifyContractor", () => {
  it("denies a contractor manager from modifying the contractor record", () => {
    const result = canModifyContractor(user({ role: "CONTRACTOR_MANAGER", contractorId: "c-1" }), {
      contractorId: "c-1",
    });
    expect(result.allowed).toBe(false);
  });

  it("allows the contractor owner to modify their own record", () => {
    const result = canModifyContractor(user({ role: "CONTRACTOR_OWNER", contractorId: "c-1" }), {
      contractorId: "c-1",
    });
    expect(result.allowed).toBe(true);
  });
});

describe("canActivateWorker", () => {
  it("is admin-only and never automatic", () => {
    expect(canActivateWorker(user({ role: "SUPER_ADMIN" }), { workerProfileId: "wp-1" }).allowed).toBe(
      true
    );
    expect(canActivateWorker(user({ role: "WORKER" }), { workerProfileId: "wp-1" }).allowed).toBe(false);
  });
});

describe("canApproveContractor", () => {
  it("requires super admin, not just any admin role", () => {
    expect(canApproveContractor(user({ role: "SUPER_ADMIN" }), { contractorId: "ci-1" }).allowed).toBe(
      true
    );
    expect(canApproveContractor(user({ role: "DISPATCHER" }), { contractorId: "ci-1" }).allowed).toBe(
      false
    );
  });
});

describe("canViewJobRequest", () => {
  it("allows the owning contractor's staff and denies others", () => {
    expect(
      canViewJobRequest(user({ role: "SUPERVISOR", contractorId: "c-1" }), { contractorId: "c-1" }).allowed
    ).toBe(true);
    expect(
      canViewJobRequest(user({ role: "SUPERVISOR", contractorId: "c-1" }), { contractorId: "c-2" }).allowed
    ).toBe(false);
  });
});

describe("canManageApplicationLifecycle", () => {
  it("is restricted to admin/dispatcher roles", () => {
    expect(canManageApplicationLifecycle(user({ role: "DISPATCHER" })).allowed).toBe(true);
    expect(canManageApplicationLifecycle(user({ role: "CONTRACTOR_OWNER" })).allowed).toBe(false);
  });
});
