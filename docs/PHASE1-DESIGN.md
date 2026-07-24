# Phase 1 Revised Design — Syracuse Labor Dispatch Platform

  This document is the locked structural design for Phase 1, incorporating all corrections requested before implementation. Later phases (matching intelligence, GPS, payments, AI) build on this foundation without restructuring core tables.

  ## 1. Entity Relationship Design

  ### Identity and organizations
  - User: auth identity, email, hashed password (or auth-provider link), role, status, createdAt.
    - Market: e.g. Syracuse / Central New York. ServiceArea belongs to Market, holds postal codes / boundary data.
      - Contractor: company record. Status: lead, pending_review, approved, suspended, rejected.
        - ContractorInterest: public interest-form submission, always creates this first, never an active Contractor.
          - ContractorUser: joins User to Contractor with role (owner, manager) and status.
            - ContractorInvite: time-limited invite token issued after admin approval.

            ### Applicants and workers
            - Application (ApplicantProfile): the primary application record. Status: submitted, under_review, waitlisted, interview_requested, documents_requested, approved, activated, rejected, withdrawn, archived.
            - ApplicationSkillInterest: join table, application to preferred skill categories.
              - ApplicationStatusHistory: every transition logged with actor, reason, timestamp.
                - WorkerProfile: created only when an Application reaches approved/activated. Holds contact info, transportation, work radius, status (applicant, waitlisted, approved, active, suspended, inactive).
                  - WaitlistEntry: tracks category-specific waitlist position/status, separate from WorkerProfile so capacity logic doesn't require an activated profile.

                    ### Skills and certifications
                    - Skill, CertificationType: normalized lookup tables.
                      - WorkerSkill: workerId, skillId, level, yearsExperience, verificationStatus, verifiedBy, verifiedAt, verificationMethod, lastUsedAt, notes.
                        - WorkerCertification: certification number, issuing org, issuedDate, expirationDate, verificationStatus, verificationSource, documentRef, verifiedBy, verifiedAt.
                          - PositionRequiredSkill / PositionRequiredCertification: attached to ShiftPosition, not Shift.

                            ### Availability
                            - WorkerAvailabilityRule: recurring weekly availability.
                              - WorkerAvailabilityException: specific date overrides.
                                - WorkerOfferPause: temporary self-service pause on receiving offers.
                                  - WorkerTimeOff: unavailable date ranges.

                                    ### Crews
                                    - Crew: name, leaderId, status (active/inactive).
                                      - CrewMembership: workerId, crewId, role (leader/assistant_leader/member), status, joinedAt, leftAt, isPrimaryCrew, createdBy. Full history preserved, never a single crewId on WorkerProfile.

                                        ### Contractor relationships
                                        - ContractorWorkerPreference: favorite, preferred, blocked, do_not_send, reason, internalNotes, createdBy, createdAt. Contractor-facing block is distinct from internal do-not-dispatch.
                                          - ContractorWorkerRating, ContractorCrewPreference, ContractorCrewRating: dedicated tables, not a vague many-to-many.

                                            ### Requests, jobs, shifts, positions
                                              - JobRequest: the contractor's original ask, with revision/status history. Never silently rewritten.
                                                - Job: the accepted, operational work order created from a JobRequest after review/approval. One JobRequest to many Job.
                                                  - Job holds jobsite-level requirements: address, GPS, supervisor, parking, safety instructions, general PPE, documents, weather notes.
                                                    - Shift: a work period under a Job (date, start/end time).
                                                      - ShiftPosition: one required worker position within a Shift (e.g. 5 general-laborer positions = 5 ShiftPosition rows). Holds position-level requirements: skill, level, certification, tools, transportation, worker pay rate snapshot, bill rate snapshot, status (open, offered, filled, canceled, replaced, disputed).
                                                        - ShiftAssignment: historical record of a worker assigned to a position. Multiple rows per position over time; only one current/active at a time. Status: pending, confirmed, active, completed, canceled, worker_canceled, contractor_canceled, no_show, replaced, disputed.
                                                          - Replacing a worker closes the old assignment (reason + timestamp), creates a new one, preserves all history, and writes an AuditLog entry.

                                                          ### Matching and offers
                                                          - MatchingRun: one execution of the matching engine for a ShiftPosition. Stores configurationVersion and generatedAt.
                                                            - MatchingCandidate: one worker's result within a run — eligibility result, exclusion reasons, total score, component scores. Never recalculated retroactively with new weights.
                                                            - Offer: references ShiftPosition (not Shift). Status: queued, sent, viewed, accepted, declined, expired, canceled, superseded, position_filled, delivery_failed. Tracks sentAt, viewedAt, respondedAt, expiresAt, delivery method/status, decline/expiration reason, dispatch wave number.
                                                              - Dispatch strategies: sequential, small_wave (top 3-5 simultaneously, first acceptance wins, others auto-close as position_filled), manual_selection, crew_offer, emergency_broadcast (admin-only).
                                                                - Accepting an offer is a single database transaction with row-level locking on ShiftPosition to prevent double-claim race conditions.

                                                                ### Notifications
                                                                - NotificationEvent: the business event (source of truth).
                                                                - NotificationRecipient: who should receive it.
                                                                  - NotificationDeliveryAttempt: per-channel attempt (in-app/email/SMS), provider response, retry count, failure reason. Business event is never lost if a delivery provider fails.

                                                                    ### Time tracking
                                                                    - TimeEntry: belongs to ShiftAssignment (not Shift directly). Holds scheduled start/end snapshot, original check-in/out, device timestamp, server timestamp, lat/long, accuracy radius, geofence result, QR validation result, break records, dispute status.
                                                                    - TimeAdjustment: separate table for any correction; original TimeEntry values are never overwritten.

                                                                      ### Reliability
                                                                      - ReliabilityEvent: append-only source record (offer accepted/declined, late cancellation, no-show, on-time/late check-in, completed assignment, repeat request, safety incident, admin adjustment).
                                                                        - WorkerReliabilitySnapshot: calculated score, stores the scoring configuration version used, generatedAt. Never overwritten without a preserved event/adjustment.

                                                                          ### Invoicing
                                                                          - Invoice, InvoiceLineItem (references ShiftAssignment/TimeEntry with rate snapshots), PaymentRecord (placeholder, no real processing), CreditMemo, InvoiceAdjustment, InvoiceStatusHistory.
                                                                            - Status: draft, sent, viewed, partially_paid, paid, overdue, void, disputed. Finalized totals are immutable; corrections happen via adjustments/credit memos.
                                                                              - Invoice numbers are a controlled sequential business identifier, separate from internal UUID/CUID primary keys.

                                                                                ### Capacity and demand
                                                                                - CapacitySetting: skillCategory, skillLevel, serviceArea, activeWorkerTarget, hardMaximum, minimumReserve, applicationStatus scope, activationStatus scope, effectiveDate, adminOverride.
                                                                                  - Demand dashboard reads live from Job/ShiftPosition/WorkerProfile/Offer data; no separate mutable aggregate table required for MVP.

                                                                                    ### Audit
                                                                                    - AuditLog: actorUserId, actorRole, action, entityType, entityPublicId, requestId, beforeJson (redacted), afterJson (redacted), reason, ip, userAgent, createdAt. Domain history tables (ApplicationStatusHistory, ShiftAssignment history, InvoiceStatusHistory, etc.) are the primary record; AuditLog supplements them.

                                                                                      All public-facing identifiers use UUID/CUID, never sequential integer IDs, except the business-facing invoice number.

                                                                                        ## 2. State Machines (allowed transitions only; enforced server-side)

                                                                                        - Application: submitted -> under_review -> (waitlisted | interview_requested | documents_requested | approved | rejected) -> approved -> activated; withdrawn/archived reachable from any pre-activation state.
                                                                                          - Contractor: lead -> pending_review -> (approved | rejected); approved -> suspended -> approved (reactivation is an explicit admin action).
                                                                                            - JobRequest: draft -> submitted -> under_review -> (quoted | rejected) -> approved -> converted_to_job.
                                                                                              - Job: draft -> requested -> quoted -> approved -> dispatching -> partially_filled -> filled -> in_progress -> completed; cancelable from any pre-completion state; disputed reachable from in_progress/completed. Reopening a canceled job is an explicit authorized action.
                                                                                                - ShiftPosition: open -> offered -> filled -> (canceled | replaced | disputed); filled position cannot accept a new offer without first being reopened via replacement flow.
                                                                                                  - Offer: queued -> sent -> viewed -> (accepted | declined | expired | canceled | superseded); accepted is terminal-success and triggers position_filled on sibling offers.
                                                                                                    - ShiftAssignment: pending -> confirmed -> active -> completed; alternate terminal states worker_canceled, contractor_canceled, no_show, replaced, disputed. Completed cannot return to offered.
                                                                                                      - TimeEntry: checked_in -> checked_out -> pending_approval -> approved; disputed reachable after checked_out; approved entries are only changed via TimeAdjustment.
                                                                                                        - Invoice: draft -> sent -> viewed -> (partially_paid -> paid) | overdue | disputed; void reachable from draft/sent only. Paid invoices never return to draft; corrections use adjustments/credit memos.
                                                                                                          
                                                                                                          ## 3. Authorization Policy Structure
                                                                                                          
                                                                                                          Central policy module (`lib/authz/policies.ts`) exposes named functions such as canViewWorkerProfile, canViewWorkerPrivateDocuments, canDispatchPosition, canApproveTimeEntry, canViewInvoice, canModifyContractor, canActivateWorker, canApproveContractor. Each function takes (actingUser, targetResource) and returns allow/deny with a reason. Every service method calls the relevant policy function before acting — this is enforced in the service layer, not just middleware, so route handlers, server actions, and server components all get the same guarantee. Middleware handles coarse route-group gating (e.g. `/admin/*` requires admin/dispatcher role) as a first line of defense only. Ownership checks (contractor can only see its own data, worker can only see its own data) are always re-verified against the database record's actual owning organization/user, never inferred from the URL alone.
                                                                                                          
                                                                                                          ## 4. Phase 1 File/Folder Plan
                                                                                                          
                                                                                                          ```
                                                                                                          /prisma/schema.prisma
                                                                                                          /prisma/seed.ts
                                                                                                          /lib/db.ts
                                                                                                          /lib/authz/policies.ts
                                                                                                          /lib/services/application.service.ts
                                                                                                          /lib/services/worker.service.ts
                                                                                                          /lib/services/contractor.service.ts
                                                                                                          /lib/services/capacity.service.ts
                                                                                                          /lib/validation/*.schema.ts (Zod)
                                                                                                          /lib/providers/{sms,email,payment,geo,ai}.provider.ts + mock implementations
                                                                                                          /config/features.ts
                                                                                                          /config/brand.ts
                                                                                                          /app/(public)/apply/page.tsx
                                                                                                          /app/(public)/contractor-interest/page.tsx
                                                                                                          /app/(auth)/login/page.tsx
                                                                                                          /app/admin/(dashboard pages)
                                                                                                          /app/api/**/route.ts
                                                                                                          /tests/**
                                                                                                          .env.example
                                                                                                          README.md
                                                                                                          ```
                                                                                                          
                                                                                                          ## 5. Migration Plan
                                                                                                          
                                                                                                          Single initial Prisma migration establishing all Phase 1 tables (identity, applications, worker/contractor core, skills, availability, crews, job/shift/position scaffolding even though matching/offers activate more fully in Phase 2, capacity settings, audit). Later phases add migrations incrementally rather than editing the initial one. Migrations are committed to source control; no migration is applied directly to a shared database without review.
                                                                                                          
                                                                                                          ## 6. Testing Plan (Phase 1)
                                                                                                          
                                                                                                          Unit/integration tests for: public application validation, application status transitions (invalid transitions rejected), waitlist capacity rule enforcement, contractor interest to approval to invite flow, role authorization matrix (each role denied/allowed per policy matrix), organization ownership isolation (contractor A cannot read contractor B), private worker data protection (worker cannot read another worker's profile; contractor cannot read private fields), contractor request validation, admin activation flow (waitlisted to approved to active, capacity-limited).
                                                                                                          
                                                                                                          ## 7. Seed Data Plan
                                                                                                          
                                                                                                          Fictional Syracuse-area market and service area; 4-5 fictional contractors in different approval states; 15-20 fictional workers across skill levels and statuses including waitlisted and suspended; a handful of jobs/shifts/positions in varied states including one partially filled; one no-show assignment; one disputed time entry; sample invoices in different statuses. All names, companies, addresses, and contact info are clearly fictional/non-deliverable.
                                                                                                          
                                                                                                          ## 8. Authentication Recommendation
                                                                                                          
                                                                                                          Auth.js (NextAuth v5) with the Prisma adapter, using the App Router-native configuration. It's the actively maintained option compatible with current Next.js App Router and Prisma, supports credentials + email verification + password reset flows, and session/JWT callbacks can carry role and organization membership cleanly. Custom session/role claims will carry contractor/worker org membership so server-side checks never need an extra round trip. No custom password/session implementation is planned; email verification, password reset, and account disabling are handled through Auth.js flows plus our own User.status field for suspension.
                                                                                                          
