import { prisma } from "@/lib/prisma";
import { nextDailyFireAt, reminderLocalDate } from "@/lib/reminder-schedule";

/** Claim advancement and delivery share a transaction, so a failed delivery rolls back the claim. */
export async function runReminderWorker(now = new Date()): Promise<number> {
  const due = await prisma.reminder.findMany({
    where: {
      active: true, nextFireAt: { lte: now }, timeZone: { not: null },
      patient: { user: { isActive: true } },
      OR: [{ frequency: "ONCE" }, { frequency: "DAILY", localHour: { not: null }, localMinute: { not: null } }],
    },
    include: { patient: { select: { user: { select: { id: true, isActive: true } } } } },
    orderBy: [{ nextFireAt: "asc" }, { id: "asc" }],
    take: 100,
  });
  let delivered = 0;
  for (const reminder of due) {
    const nextFireAt = reminder.frequency === "DAILY"
      ? nextDailyFireAt(reminder.localHour!, reminder.localMinute!, reminder.timeZone!, now, reminderLocalDate(reminder.nextFireAt, reminder.timeZone!))
      : reminder.nextFireAt;
    delivered += await prisma.$transaction(async tx => {
      const claim = await tx.reminder.updateMany({
        where: { id: reminder.id, active: true, nextFireAt: reminder.nextFireAt, patient: { user: { isActive: true } } },
        data: { nextFireAt, active: reminder.frequency === "DAILY" },
      });
      if (claim.count === 0) return 0;
      await tx.notification.createMany({
        data: [{
          id: `reminder:${reminder.id}:${reminder.nextFireAt.toISOString()}`,
          userId: reminder.patient.user.id,
          title: "Reminder", message: reminder.label, type: "REMINDER", link: "/patient/amelia",
        }],
        skipDuplicates: true,
      });
      return 1;
    });
  }
  return delivered;
}
