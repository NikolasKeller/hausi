import type { Prisma } from '@prisma/client';

type Client = Prisma.TransactionClient;

export interface NotificationInput {
  type:
    | 'RSVP'
    | 'COMMENT'
    | 'EVENT_UPDATED'
    | 'EVENT_CANCELED'
    | 'WAITLIST_PROMOTED'
    | 'COHOST_ADDED';
  text: string;
  eventSlug?: string;
}

export async function notify(tx: Client, userIds: string[], input: NotificationInput) {
  const recipients = [...new Set(userIds)];
  if (!recipients.length) return;
  await tx.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      type: input.type,
      text: input.text,
      eventSlug: input.eventSlug ?? null,
    })),
  });
}
