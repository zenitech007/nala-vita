import {mockOf,mockQuery} from "../../helpers/mock";
import type {AuthReply,UserProjection} from "../../helpers/projections";
// src/__tests__/api/amelia/notifications-fire.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const getUser=mockQuery<AuthReply>();
jest.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: () => ({ auth: { getUser: () => getUser() } }) }));
const userFindUnique=mockQuery<UserProjection|null>();
const notifFindMany=mockQuery<Partial<import("@prisma/client").Notification>[]>();
const notifCount=mockQuery<number>();
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    notification: { findMany: (...a: unknown[]) => notifFindMany(...a), count: (...a: unknown[]) => notifCount(...a) },
  },
}));
const runReminderWorker=mockOf<typeof import("@/lib/reminder-worker").runReminderWorker>();
jest.mock("@/lib/reminder-worker", () => ({ runReminderWorker: (...a: Parameters<typeof runReminderWorker>) => runReminderWorker(...a) }));

import { GET } from "@/app/api/notifications/route";

function req() { return new Request("http://localhost/api/notifications") as never; }

beforeEach(() => [getUser, userFindUnique, notifFindMany, notifCount, runReminderWorker].forEach((m) => m.mockReset()));

describe("GET /api/notifications is read-only", () => {
  it("returns notifications without firing reminder jobs", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", role: "PATIENT", isActive: true, patient: { id: "pat1" } });
    runReminderWorker.mockResolvedValue(1);
    notifFindMany.mockResolvedValue([{ id: "n1" }]);
    notifCount.mockResolvedValue(1);

    const res = await GET(req());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(runReminderWorker).not.toHaveBeenCalled();
    expect(json.notifications).toHaveLength(1);
  });

  it("does not fire for non-patients (no patient profile)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", role: "DOCTOR", isActive: true, doctor: { id: "d", isVerified: true }, patient: null });
    notifFindMany.mockResolvedValue([]);
    notifCount.mockResolvedValue(0);

    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(runReminderWorker).not.toHaveBeenCalled();
  });
});
