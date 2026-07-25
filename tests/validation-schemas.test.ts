import { describe, expect, it } from "vitest";
import { applicationSchema } from "@/lib/validation/application.schema";
import { contractorInterestSchema, jobRequestSchema } from "@/lib/validation/contractor.schema";

describe("applicationSchema", () => {
  const base = {
    firstName: "Jordan",
    lastName: "Rivera",
    phone: "315-555-0100",
    email: "jordan.rivera@example.com",
    skillCategoryIds: ["skill-1"],
  };

  it("accepts a minimal valid application", () => {
    const result = applicationSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("requires at least one skill category", () => {
    const result = applicationSchema.safeParse({ ...base, skillCategoryIds: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = applicationSchema.safeParse({ ...base, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a work radius above the configured maximum", () => {
    const result = applicationSchema.safeParse({ ...base, workRadiusMiles: 500 });
    expect(result.success).toBe(false);
  });

  it("allows an application without an address or resume", () => {
    const result = applicationSchema.safeParse(base);
    expect(result.success).toBe(true);
  });
});

describe("contractorInterestSchema", () => {
  const base = {
    companyName: "Salt City Builders",
    contactName: "Pat Nguyen",
    contactEmail: "pat@example.com",
    contactPhone: "315-555-0111",
  };

  it("accepts a minimal valid contractor interest", () => {
    expect(contractorInterestSchema.safeParse(base).success).toBe(true);
  });

  it("requires a company name", () => {
    const result = contractorInterestSchema.safeParse({ ...base, companyName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid contact email", () => {
    const result = contractorInterestSchema.safeParse({ ...base, contactEmail: "nope" });
    expect(result.success).toBe(false);
  });
});

describe("jobRequestSchema", () => {
  const base = {
    contractorId: "contractor-1",
    jobType: "General labor",
    requestedWorkerCount: 4,
    requestedDate: "2026-08-01",
    requestedStartTime: "07:00",
    requestedEndTime: "15:30",
    jobsiteAddress: "123 Erie Blvd, Syracuse, NY",
  };

  it("accepts a well-formed job request", () => {
    expect(jobRequestSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a start time that is not HH:MM 24-hour format", () => {
    const result = jobRequestSchema.safeParse({ ...base, requestedStartTime: "7am" });
    expect(result.success).toBe(false);
  });

  it("rejects a worker count of zero", () => {
    const result = jobRequestSchema.safeParse({ ...base, requestedWorkerCount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a worker count above the configured maximum", () => {
    const result = jobRequestSchema.safeParse({ ...base, requestedWorkerCount: 5000 });
    expect(result.success).toBe(false);
  });
});
