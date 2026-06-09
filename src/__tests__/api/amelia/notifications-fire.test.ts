// src/__tests__/api/amelia/notifications-fire.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const getUser = jest.fn();
jest.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: () => ({ auth: { getUser: () => getUser() } }) }));
const userFindUnique = jest.fn();
const notifFindMany = jest.fn();
const notifCount = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    notification: { findMany: (...a: unknown[]) => notifFindMany(...a), count: (...a: unknown[]) => notifCount(...a) },
  },
}));
const fireDueReminders = jest.fn();
jest.mock("@/lib/amelia/reminders", () => ({ fireDueReminders: (...a: unknown[]) => fireDueReminders(...a) }));

import { GET } from "@/app/api/notifications/route";

function req() { return new Request("http://localhost/api/notifications") as never; }

beforeEach(() => [getUser, userFindUnique, notifFindMany, notifCount, fireDueReminders].forEach((m) => m.mockReset()));

describe("GET /api/notifications fires reminders for patients", () => {
  it("calls fireDueReminders with patientId + userId then returns notifications", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    fireDueReminders.mockResolvedValue(1);
    notifFindMany.mockResolvedValue([{ id: "n1" }]);
    notifCount.mockResolvedValue(1);

    const res = await GET(req());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(fireDueReminders).toHaveBeenCalledWith("pat1", "u1");
    expect(json.notifications).toHaveLength(1);
  });

  it("does not fire for non-patients (no patient profile)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: null });
    notifFindMany.mockResolvedValue([]);
    notifCount.mockResolvedValue(0);

    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(fireDueReminders).not.toHaveBeenCalled();
  });
});
