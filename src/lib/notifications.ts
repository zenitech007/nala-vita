import { prisma } from "@/lib/prisma";

interface NotificationMetadata {
  link?: string;
  [key: string]: unknown;
}

/**
 * Create a notification for a user.
 *
 * @param userId  - The Prisma User.id of the recipient
 * @param title   - Short notification title
 * @param body    - Notification message body
 * @param type    - Category string (e.g. "APPOINTMENT", "PAYMENT", "MESSAGE", "VITAL_ALERT", "LAB_ORDER")
 * @param metadata - Optional metadata (link, etc.)
 */
export async function createNotification(
  userId: string,
  title: string,
  body: string,
  type: string,
  metadata?: NotificationMetadata
) {
  return prisma.notification.create({
    data: {
      userId,
      title,
      message: body,
      type,
      link: metadata?.link ?? null,
    },
  });
}

/**
 * Create notifications for multiple users at once.
 */
export async function createBulkNotifications(
  userIds: string[],
  title: string,
  body: string,
  type: string,
  metadata?: NotificationMetadata
) {
  return prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title,
      message: body,
      type,
      link: metadata?.link ?? null,
    })),
  });
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadCount(userId: string) {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}
