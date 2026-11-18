const medications = jest.fn();
jest.mock("@/lib/prisma", () => ({ prisma: { prescription: { findMany: medications } } }));
jest.mock("@/lib/auth", () => ({
  requireApiUser: async () => ({ ok: true, user: { id: "u1", role: "PATIENT", patient: { id: "p1" } } }),
}));
jest.mock("@/lib/audit", () => ({ logAudit: jest.fn() }));
jest.mock("@/lib/supabase-server", () => ({}));
jest.mock("@/lib/notifications", () => ({}));
import { GET } from "@/app/api/medications/route";
import { NextRequest } from "next/server";

test("adherence uses prescribed frequency and only active dates", async () => {
  jest.useFakeTimers().setSystemTime(new Date("2026-11-11T12:00:00Z"));
  try {
    medications.mockResolvedValue([{
      id: "rx1", medication: "Synthetic", dosage: "1mg", frequency: "Twice daily", duration: "7 days",
      prescribedAt: new Date("2026-11-10T08:00:00Z"), expiresAt: null, isActive: true,
      usageLogs: ["2026-11-10", "2026-11-11"], doctor: null,
    }]);
    const response = await GET(new NextRequest("http://localhost/api/medications"));
    const body = await response.json();
    expect(body.medications[0].adherenceRate7Days).toBe(50);
    expect(body.adherenceStats.weeklyAdherenceRate).toBe(50);
    expect(body.medications[0].expectedDoses).toBe(4);
  } finally {
    jest.useRealTimers();
  }
});
