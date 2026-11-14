import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pageResult, type PageCursor } from "@/lib/pagination";
import type { MessagingUser } from "@/app/api/messages/_access";

type ConversationRow = {
  id: string;
  createdAt: Date;
  partner: Pick<MessagingUser, "id" | "firstName" | "lastName" | "avatarUrl" | "role">;
  lastMessage: { id: string; senderId: string; receiverId: string; content: string; isRead: boolean; attachmentUrl: string | null; createdAt: string };
  unreadCount: number;
};
/** One bounded result query: membership, partner, latest message and unread count.
 * Membership intentionally matches getAuthorizedMessageParticipant; a clinic-created
 * patient alone does not grant messaging access. All values are bound parameters.
 */
export async function listMessageConversations(user: MessagingUser, limit: number, cursor: PageCursor | null) {
  const patientId = user.role === "PATIENT" ? user.patient!.id : null;
  const doctorId = user.role === "DOCTOR" ? user.doctor!.id : null;
  const position = cursor ? Prisma.sql`AND (l.created_at, u.id) < (${new Date(cursor.at)}, ${cursor.id})` : Prisma.empty;
  const rows = await prisma.$queryRaw<ConversationRow[]>(Prisma.sql`
    WITH latest AS (
      SELECT DISTINCT ON (partner_id) * FROM (
        SELECT m.*, CASE WHEN m.sender_id = ${user.id} THEN m.receiver_id ELSE m.sender_id END AS partner_id
        FROM messages m WHERE m.sender_id = ${user.id} OR m.receiver_id = ${user.id}
      ) scoped ORDER BY partner_id, created_at DESC, id DESC
    ), unread AS (
      SELECT sender_id, count(*)::integer AS total FROM messages
      WHERE receiver_id = ${user.id} AND NOT is_read GROUP BY sender_id
    )
    SELECT u.id, l.created_at AS "createdAt",
      jsonb_build_object('id',u.id,'firstName',u.first_name,'lastName',u.last_name,'avatarUrl',u.avatar_url,'role',u.role) AS partner,
      jsonb_build_object('id',l.id,'senderId',l.sender_id,'receiverId',l.receiver_id,'content',l.content,'isRead',l.is_read,'attachmentUrl',l.attachment_url,'createdAt',l.created_at) AS "lastMessage",
      COALESCE(unread.total,0) AS "unreadCount"
    FROM latest l JOIN users u ON u.id = l.partner_id
    LEFT JOIN doctors d ON d.user_id = u.id LEFT JOIN patients p ON p.user_id = u.id
    LEFT JOIN unread ON unread.sender_id = u.id
    WHERE u.is_active AND u.id <> ${user.id}
      AND ((u.role = 'DOCTOR' AND d.is_verified AND ${patientId}::text IS NOT NULL AND (
        EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = ${patientId} AND a.doctor_id = d.id)
        OR EXISTS (SELECT 1 FROM referrals r WHERE r.patient_id = ${patientId} AND r.status = 'ACCEPTED' AND (r.referring_doctor_id = d.id OR r.referred_doctor_id = d.id))
      )) OR (u.role = 'PATIENT' AND p.id IS NOT NULL AND ${doctorId}::text IS NOT NULL AND (
        EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = p.id AND a.doctor_id = ${doctorId})
        OR EXISTS (SELECT 1 FROM referrals r WHERE r.patient_id = p.id AND r.status = 'ACCEPTED' AND (r.referring_doctor_id = ${doctorId} OR r.referred_doctor_id = ${doctorId}))
      ))) ${position}
    ORDER BY l.created_at DESC, u.id DESC LIMIT ${limit + 1}
  `);
  const page = pageResult(rows, limit, "createdAt");
  return { conversations: page.items.map(row => ({userId:row.id, partner:row.partner, lastMessage:row.lastMessage, unreadCount:row.unreadCount})), nextCursor:page.nextCursor };
}
