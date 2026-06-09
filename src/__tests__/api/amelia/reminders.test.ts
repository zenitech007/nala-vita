import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const getUser = jest.fn();
jest.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: () => ({ auth: { getUser: () => getUser() } }) }));
const userFindUnique = jest.fn();
jest.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: (...a: unknown[]) => userFindUnique(...a) } } }));
const createReminder = jest.fn();
const listReminders = jest.fn();
const cancelReminder = jest.fn();
jest.mock("@/lib/amelia/reminders", () => ({
  createReminder: (...a: unknown[]) => createReminder(...a),
  listReminders: (...a: unknown[]) => listReminders(...a),
  cancelReminder: (...a: unknown[]) => cancelReminder(...a),
}));

import { POST, GET } from "@/app/api/amelia/reminders/route";
import { DELETE } from "@/app/api/amelia/reminders/[id]/route";

function req(body?: unknown) {
  return new Request("http://localhost/api/amelia/reminders", { method: "POST", body: body ? JSON.stringify(body) : undefined }) as never;
}
const ctx = (id: string) => ({ params: { id } });

beforeEach(() => [getUser, userFindUnique, createReminder, listReminders, cancelReminder].forEach((m) => m.mockReset()));

describe("reminders API", () => {
  it("POST 401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(req({}))).status).toBe(401);
  });

  it("POST creates a reminder for the patient", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    createReminder.mockResolvedValue(undefined);
    const iso = new Date(2026, 5, 12, 8, 0).toISOString();
    const res = await POST(req({ kind: "MEDICATION", label: "BP meds", frequency: "DAILY", nextFireAt: iso }));
    expect(res.status).toBe(200);
    expect(createReminder).toHaveBeenCalledTimes(1);
    const [pid, data] = createReminder.mock.calls[0] as [string, { label: string; nextFireAt: Date }];
    expect(pid).toBe("pat1");
    expect(data.label).toBe("BP meds");
    expect(data.nextFireAt instanceof Date).toBe(true);
  });

  it("GET lists the patient's reminders", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    listReminders.mockResolvedValue([{ id: "1", kind: "MEDICATION", label: "BP meds", frequency: "DAILY", nextFireAt: "x", schedule: "every day at 8:00 AM" }]);
    const res = await GET(req());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.reminders[0].label).toBe("BP meds");
    expect(listReminders).toHaveBeenCalledWith("pat1");
  });

  it("DELETE cancels scoped to the patient", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    cancelReminder.mockResolvedValue(undefined);
    const res = await DELETE(req(), ctx("r1"));
    expect(res.status).toBe(200);
    expect(cancelReminder).toHaveBeenCalledWith("r1", "pat1");
  });
});
