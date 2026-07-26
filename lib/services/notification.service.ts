import { db } from "@/lib/db";
import { emailProvider } from "@/lib/providers/email.provider";
import { smsProvider } from "@/lib/providers/sms.provider";

// Central notification system. Every meaningful platform event creates a
// NotificationEvent with one or more NotificationRecipients, and delivery is
// attempted immediately through the email/SMS provider adapters - every
// attempt (success or failure) is recorded in NotificationDeliveryAttempt so
// the delivery history is real and auditable even though the providers
// themselves are mock (log-only) implementations until real credentials are
// configured (see config/features.ts and lib/providers/*). This is the "real
// event system even if SMS/email use mock providers" requirement from
// docs/PHASE1-DESIGN.md.

export type NotificationType =
  | "NEW_JOB_REQUEST"
  | "JOB_OFFER"
  | "OFFER_ACCEPTED"
  | "OFFER_DECLINED"
  | "OFFER_EXPIRED"
  | "SHIFT_REMINDER"
  | "WORKER_RUNNING_LATE"
  | "NO_SHOW"
  | "SHIFT_COMPLETED"
  | "HOURS_AWAITING_APPROVAL"
  | "INVOICE_CREATED"
  | "INVOICE_OVERDUE"
  | "DOCUMENT_EXPIRING";

export type NotificationRecipientInput = {
  userId?: string;
  workerProfileId?: string;
  contractorUserId?: string;
};

const NOTIFICATION_SUBJECTS: Record<NotificationType, string> = {
  NEW_JOB_REQUEST: "New job request submitted",
  JOB_OFFER: "You have a new job offer",
  OFFER_ACCEPTED: "A worker accepted an offer",
  OFFER_DECLINED: "A worker declined an offer",
  OFFER_EXPIRED: "An offer expired with no response",
  SHIFT_REMINDER: "Upcoming shift reminder",
  WORKER_RUNNING_LATE: "Worker running late",
  NO_SHOW: "Worker no-show reported",
  SHIFT_COMPLETED: "Shift completed",
  HOURS_AWAITING_APPROVAL: "Hours are awaiting approval",
  INVOICE_CREATED: "A new invoice is available",
  INVOICE_OVERDUE: "An invoice is overdue",
  DOCUMENT_EXPIRING: "A document is expiring soon",
};

// Resolves the best-known contact channels for a recipient reference. Only
// reads the minimum contact fields needed to attempt delivery - never
// exposes any other private worker/contractor data to the caller.
async function resolveContact(
  recipient: NotificationRecipientInput
): Promise<{ email?: string | null; phone?: string | null }> {
  if (recipient.workerProfileId) {
    const profile = await db.workerProfile.findUnique({
      where: { id: recipient.workerProfileId },
      include: { user: true, application: true },
    });
    return { email: profile?.user.email, phone: profile?.application.phone };
  }
  if (recipient.contractorUserId) {
    const contractorUser = await db.contractorUser.findUnique({
      where: { id: recipient.contractorUserId },
      include: { user: true },
    });
    return { email: contractorUser?.user.email, phone: null };
  }
  if (recipient.userId) {
    const user = await db.user.findUnique({ where: { id: recipient.userId } });
    return { email: user?.email, phone: null };
  }
  return {};
}

// Creates the event + recipient rows and attempts delivery to each
// recipient's known contact channels. Intended to be called after a primary
// action's own transaction has already committed - a delivery failure here
// never rolls back the primary business action, it is only recorded.
export async function notify(input: {
  type: NotificationType;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
  recipients: NotificationRecipientInput[];
}) {
  const event = await db.notificationEvent.create({
    data: {
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: (input.payload ?? {}) as any,
    },
  });

  for (const recipientInput of input.recipients) {
    const recipient = await db.notificationRecipient.create({
      data: {
        eventId: event.id,
        userId: recipientInput.userId,
        workerProfileId: recipientInput.workerProfileId,
        contractorUserId: recipientInput.contractorUserId,
      },
    });

    const contact = await resolveContact(recipientInput);
    const subject = NOTIFICATION_SUBJECTS[input.type];
    const body = subject + ". Details: " + JSON.stringify(input.payload ?? {});

    if (contact.email) {
      const result = await emailProvider.sendEmail({ to: contact.email, subject, body });
      await db.notificationDeliveryAttempt.create({
        data: {
          recipientId: recipient.id,
          channel: "EMAIL",
          status: result.success ? "SENT" : "FAILED",
          providerResponse: result.providerMessageId ?? null,
          failureReason: result.error ?? null,
        },
      });
    }

    if (contact.phone) {
      const result = await smsProvider.sendSms({ to: contact.phone, body });
      await db.notificationDeliveryAttempt.create({
        data: {
          recipientId: recipient.id,
          channel: "SMS",
          status: result.success ? "SENT" : "FAILED",
          providerResponse: result.providerMessageId ?? null,
          failureReason: result.error ?? null,
        },
      });
    }
  }

  return event;
}

// Every active SUPER_ADMIN/DISPATCHER user - used for admin-facing
// notification types (new job request, offer accepted/declined/expired,
// hours awaiting approval) where there is no single natural recipient.
export async function getAdminRecipients(): Promise<NotificationRecipientInput[]> {
  const admins = await db.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "DISPATCHER"] }, status: "ACTIVE" },
    select: { id: true },
  });
  return admins.map((a) => ({ userId: a.id }));
}

// Every ContractorUser for a given contractor - used for contractor-facing
// notification types (invoice created, shift completed).
export async function getContractorUserRecipients(
  contractorId: string
): Promise<NotificationRecipientInput[]> {
  const contractorUsers = await db.contractorUser.findMany({
    where: { contractorId },
    select: { id: true },
  });
  return contractorUsers.map((cu) => ({ contractorUserId: cu.id }));
}

// Read-heavy list for the admin dashboard's notification history section.
export async function listRecentNotificationsForAdmin() {
  return db.notificationEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      recipients: { include: { deliveryAttempts: true } },
    },
  });
}
