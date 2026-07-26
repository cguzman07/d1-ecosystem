import {
  NotificationChannel,
  NotificationType,
  Prisma,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

export type NotifyInput = {
  recipientIds?: string[];
  /** Notify all active users with these roles */
  roles?: Role[];
  orderId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  payload?: Prisma.InputJsonValue;
  sendEmailChannel?: boolean;
  /**
   * Extra email addresses (e.g. supplier contactEmail when no portal user).
   * Email-only — no in-app notification row without a User id.
   */
  extraEmails?: string[];
};

/**
 * Creates in-app Notification rows and optionally sends email via Resend.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const recipientIds = new Set<string>(input.recipientIds ?? []);

  if (input.roles?.length) {
    const users = await prisma.user.findMany({
      where: { role: { in: input.roles }, active: true },
      select: { id: true, email: true, name: true },
    });
    for (const u of users) recipientIds.add(u.id);
  }

  const recipients =
    recipientIds.size > 0
      ? await prisma.user.findMany({
          where: { id: { in: Array.from(recipientIds) }, active: true },
          select: { id: true, email: true, name: true },
        })
      : [];

  for (const recipient of recipients) {
    await prisma.notification.create({
      data: {
        recipientId: recipient.id,
        orderId: input.orderId ?? null,
        type: input.type,
        channel: NotificationChannel.in_app,
        title: input.title,
        message: input.message,
        payload: input.payload ?? undefined,
      },
    });

    logger.notificationSent({
      recipientId: recipient.id,
      type: input.type,
      channel: NotificationChannel.in_app,
      orderId: input.orderId,
    });

    if (input.sendEmailChannel !== false && recipient.email) {
      try {
        await sendEmail({
          to: recipient.email,
          subject: input.title,
          text: input.message,
          html: `<p>${input.message}</p>`,
        });

        await prisma.notification.create({
          data: {
            recipientId: recipient.id,
            orderId: input.orderId ?? null,
            type: input.type,
            channel: NotificationChannel.email,
            title: input.title,
            message: input.message,
            payload: input.payload ?? undefined,
          },
        });

        logger.notificationSent({
          recipientId: recipient.id,
          type: input.type,
          channel: NotificationChannel.email,
          orderId: input.orderId,
        });
      } catch (error) {
        logger.error("email_notification_failed", {
          recipientId: recipient.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  if (input.sendEmailChannel !== false && input.extraEmails?.length) {
    const knownEmails = new Set(
      recipients.map((r) => r.email.toLowerCase()).filter(Boolean),
    );
    for (const email of input.extraEmails) {
      const trimmed = email?.trim();
      if (!trimmed || knownEmails.has(trimmed.toLowerCase())) continue;
      try {
        await sendEmail({
          to: trimmed,
          subject: input.title,
          text: input.message,
          html: `<p>${input.message}</p>`,
        });
        logger.notificationSent({
          recipientId: "external",
          type: input.type,
          channel: NotificationChannel.email,
          orderId: input.orderId,
        });
      } catch (error) {
        logger.error("email_notification_failed", {
          recipientId: "external",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
