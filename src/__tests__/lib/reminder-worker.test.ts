const findMany = jest.fn();
const updateMany = jest.fn();
const createMany = jest.fn();
const tx = { reminder: { updateMany }, notification: { createMany } };
const transaction = jest.fn((work: (client: typeof tx) => Promise<unknown>) => work(tx));
jest.mock("@/lib/prisma", () => ({
  prisma: { reminder: { findMany }, $transaction: (work: Parameters<typeof transaction>[0]) => transaction(work) },
}));
import { runReminderWorker } from "@/lib/reminder-worker";

beforeEach(() => jest.clearAllMocks());

test("concurrent workers atomically claim a due reminder and deliver it once", async () => {
  const dueAt = new Date("2026-06-12T08:00:00Z");
  findMany.mockResolvedValue([{
    id: "r1", patientId: "p1", kind: "OTHER", label: "Synthetic reminder", frequency: "ONCE",
    nextFireAt: dueAt, timeZone: "UTC", localHour: null, localMinute: null,
    patient: { user: { id: "u1", isActive: true } },
  }]);
  let claimed = false;
  updateMany.mockImplementation(async () => {
    if (claimed) return { count: 0 };
    claimed = true;
    return { count: 1 };
  });
  createMany.mockResolvedValue({ count: 1 });
  const counts = await Promise.all([runReminderWorker(dueAt), runReminderWorker(dueAt)]);
  expect(counts.reduce((total, count) => total + count, 0)).toBe(1);
  expect(createMany).toHaveBeenCalledTimes(1);
  expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ id: "r1", active: true, nextFireAt: dueAt }),
  }));
  expect(createMany).toHaveBeenCalledWith(expect.objectContaining({
    skipDuplicates: true,
    data: [expect.objectContaining({ id: "reminder:r1:2026-06-12T08:00:00.000Z", userId: "u1" })],
  }));
});

test("delivery failures reject the claim transaction", async () => {
  findMany.mockResolvedValue([{
    id: "r2", label: "Synthetic reminder", frequency: "ONCE", nextFireAt: new Date(0),
    timeZone: "UTC", patient: { user: { id: "u1", isActive: true } },
  }]);
  updateMany.mockResolvedValue({ count: 1 });
  createMany.mockRejectedValue(new Error("synthetic failure"));
  await expect(runReminderWorker(new Date())).rejects.toThrow("synthetic failure");
  expect(transaction).toHaveBeenCalledTimes(1);
});
