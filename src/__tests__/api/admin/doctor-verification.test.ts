const auth = jest.fn();
const findDoctor = jest.fn();
const updateDoctor = jest.fn();
const verification = jest.fn();
const auditWrite = jest.fn();
const email = jest.fn();
const tx = { doctor: { updateMany: updateDoctor }, doctorVerification: { upsert: verification }, auditLog: { create: auditWrite } };
jest.mock("@/lib/auth", () => ({ requireApiUser: (...args: unknown[]) => auth(...args) }));
jest.mock("@/lib/prisma", () => ({ prisma: { doctor: { findUnique: (...args: unknown[]) => findDoctor(...args) }, $transaction: (work: (client: typeof tx) => unknown) => work(tx) } }));
jest.mock("@/lib/otp-channel", () => ({ sendAppEmail: (...args: unknown[]) => email(...args) }));
import { PATCH } from "@/app/api/admin/doctors/[id]/verification/route";
import { NextRequest, NextResponse } from "next/server";
const changedAt = "2026-11-11T08:00:00.000Z";
const context = { params: Promise.resolve({ id: "d1" }) };
const request = () => new NextRequest("http://localhost/api/admin/doctors/d1/verification", {
  method: "PATCH", body: JSON.stringify({ status: "VERIFIED", reason: "Synthetic license review completed.", expectedUpdatedAt: changedAt }),
});
beforeEach(() => {
  jest.clearAllMocks();
  auth.mockResolvedValue({ ok: true, user: { id: "admin1", role: "ADMIN", isActive: true, admin: { id: "a1" } } });
  findDoctor.mockResolvedValue({ id: "d1", updatedAt: new Date(changedAt), user: { id: "u1", email: "synthetic@example.test", emailVerified: true } });
  updateDoctor.mockResolvedValue({ count: 1 });
  verification.mockResolvedValue({});
  auditWrite.mockResolvedValue({});
  email.mockResolvedValue(undefined);
});

test.each(["PATIENT", "DOCTOR"])("rejects a %s verification attempt", async () => {
  auth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) });
  expect((await PATCH(request(), context)).status).toBe(403);
  expect(auth).toHaveBeenCalledWith({ roles: ["ADMIN"], profile: "admin" });
  expect(updateDoctor).not.toHaveBeenCalled();
});

test("persists an audited verification decision and notifies the verified contact", async () => {
  const response = await PATCH(request(), context);
  expect(response.status).toBe(200);
  expect(updateDoctor).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "d1", updatedAt: new Date(changedAt) }, data: { isVerified: true } }));
  expect(verification).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ status: "VERIFIED", reviewerId: "admin1", reason: "Synthetic license review completed." }) }));
  expect(auditWrite).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(auditWrite.mock.calls)).not.toMatch(/synthetic@example|license review/);
  expect(email).toHaveBeenCalledTimes(1);
});

test("does not notify or persist a decision after a lost conditional update", async () => {
  updateDoctor.mockResolvedValue({ count: 0 });
  expect((await PATCH(request(), context)).status).toBe(409);
  expect(verification).not.toHaveBeenCalled();
  expect(email).not.toHaveBeenCalled();
});

test("requires audit persistence for verification", async () => {
  auditWrite.mockRejectedValue(new Error("synthetic audit failure"));
  expect((await PATCH(request(), context)).status).toBe(500);
  expect(email).not.toHaveBeenCalled();
});

test("reports unavailable email delivery after saving a decision", async () => {
  email.mockRejectedValue(new Error("synthetic delivery failure"));
  const response = await PATCH(request(), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ emailStatus: "unavailable" });
});
