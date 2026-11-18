const auth = jest.fn();
const find = jest.fn();
const update = jest.fn();
const conditional = jest.fn();
jest.mock("@/lib/auth", () => ({ requireApiUser: () => auth() }));
jest.mock("@/lib/access-control", () => ({ doctorHasPatientAccess: async () => true }));
jest.mock("@/lib/visible-patient-record", () => ({}));
jest.mock("@/lib/supabase-server", () => ({}));
jest.mock("@/lib/prisma", () => ({ prisma: { appointment: { findUnique: (...args: unknown[]) => find(...args), update: (...args: unknown[]) => update(...args), updateMany: (...args: unknown[]) => conditional(...args) } } }));
import { PATCH } from "@/app/api/appointments/[id]/route";
import { NextRequest } from "next/server";

const statuses = ["SCHEDULED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"];
const clinical: Record<string, string[]> = { SCHEDULED: ["IN_PROGRESS", "NO_SHOW"], CONFIRMED: ["IN_PROGRESS", "NO_SHOW"], IN_PROGRESS: ["COMPLETED"] };
const request = (body: object) => new NextRequest("http://localhost/api/appointments/a1", { method: "PATCH", body: JSON.stringify(body) });
const context = { params: Promise.resolve({ id: "a1" }) };
beforeEach(() => {
  jest.clearAllMocks();
  conditional.mockResolvedValue({ count: 1 });
  update.mockResolvedValue({ id: "a1" });
});
describe.each(["PATIENT", "DOCTOR"])("%s appointment transitions", role => {
  test.each(statuses.flatMap(from => statuses.map(to => [from, to])))("%s to %s", async (from, to) => {
    auth.mockResolvedValue({ ok: true, user: { id: "u", role, patient: role === "PATIENT" ? { id: "p" } : null, doctor: role === "DOCTOR" ? { id: "d" } : null } });
    find.mockResolvedValue({ id: "a1", patientId: "p", doctorId: "d", status: from });
    const expected = role === "PATIENT"
      ? to !== "CANCELLED" ? 403 : ["SCHEDULED", "CONFIRMED"].includes(from) ? 200 : 409
      : !["IN_PROGRESS", "COMPLETED", "NO_SHOW"].includes(to) ? 403 : clinical[from]?.includes(to) ? 200 : 409;
    expect((await PATCH(request({ status: to }), context)).status).toBe(expected);
  });
});
test("patients cannot edit clinical notes", async () => {
  auth.mockResolvedValue({ ok: true, user: { role: "PATIENT", patient: { id: "p" } } });
  find.mockResolvedValue({ id: "a1", patientId: "p", doctorId: "d", status: "SCHEDULED" });
  expect((await PATCH(request({ status: "CANCELLED", notes: "forged" }), context)).status).toBe(403);
});
test("a lost conditional transition returns 409", async () => {
  auth.mockResolvedValue({ ok: true, user: { role: "DOCTOR", doctor: { id: "d" } } });
  find.mockResolvedValue({ id: "a1", patientId: "p", doctorId: "d", status: "SCHEDULED" });
  conditional.mockResolvedValue({ count: 0 });
  expect((await PATCH(request({ status: "IN_PROGRESS" }), context)).status).toBe(409);
});
