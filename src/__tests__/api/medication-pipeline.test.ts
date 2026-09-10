import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock Supabase Server
const getUser = jest.fn();
jest.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: () => ({
    auth: { getUser: () => getUser() },
  }),
}));

// Mock Notifications
const createNotification = jest.fn();
jest.mock("@/lib/notifications", () => ({
  createNotification: (...args: unknown[]) => createNotification(...args),
}));

// Mock Prisma
const userFindUnique = jest.fn();
const patientFindUnique = jest.fn();
const appointmentFindFirst = jest.fn();
const referralFindFirst = jest.fn();
const prescriptionFindUnique = jest.fn();
const prescriptionFindMany = jest.fn();
const prescriptionCreate = jest.fn();
const prescriptionUpdate = jest.fn();
const auditLogCreate = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => userFindUnique(...a),
    },
    patient: {
      findUnique: (...a: unknown[]) => patientFindUnique(...a),
    },
    appointment: {
      findFirst: (...a: unknown[]) => appointmentFindFirst(...a),
    },
    referral: {
      findFirst: (...a: unknown[]) => referralFindFirst(...a),
    },
    prescription: {
      findUnique: (...a: unknown[]) => prescriptionFindUnique(...a),
      findMany: (...a: unknown[]) => prescriptionFindMany(...a),
      create: (...a: unknown[]) => prescriptionCreate(...a),
      update: (...a: unknown[]) => prescriptionUpdate(...a),
    },
    auditLog: {
      create: (...a: unknown[]) => auditLogCreate(...a),
    },
  },
}));

import { GET as getMedications, POST as postMedication } from "@/app/api/medications/route";
import { POST as toggleUsage } from "@/app/api/medications/[id]/usage/route";
import { PATCH as togglePrivacy } from "@/app/api/medications/[id]/privacy/route";
import { NextRequest } from "next/server";

describe("Two-Sided Medication Pipeline & Adherence Suite", () => {
  const todayStr = new Date().toISOString().split("T")[0];

  beforeEach(() => {
    jest.clearAllMocks();
    auditLogCreate.mockResolvedValue({ id: "audit-1" });
    createNotification.mockResolvedValue(true);
  });

  describe("Patient Dashboard: 7-Day Adherence & Prescription Self-Management", () => {
    it("should return strict 7-day adherence history and usage logs for authenticated patient", async () => {
      getUser.mockResolvedValueOnce({
        data: { user: { id: "auth-patient-1" } },
      });

      userFindUnique.mockResolvedValueOnce({
        id: "u-patient-1",
        role: "PATIENT",
        patient: { id: "pat-1" },
        doctor: null,
      });

      // Prescription with older logs and today's log
      const oldDate = "2025-01-01";
      prescriptionFindMany.mockResolvedValueOnce([
        {
          id: "rx-1",
          patientId: "pat-1",
          doctorId: "doc-1",
          medication: "Amoxicillin",
          dosage: "500mg",
          frequency: "Once daily",
          duration: "7 days",
          instructions: "With water",
          refillsAllowed: 2,
          refillsUsed: 0,
          isActive: true,
          prescribedAt: new Date().toISOString(),
          expiresAt: null,
          addedBy: "DOCTOR",
          isSharedWithDoctor: true,
          usageLogs: [oldDate, todayStr],
          doctor: {
            user: { firstName: "Sarah", lastName: "Connor" },
          },
        },
      ]);

      const req = new NextRequest("http://localhost/api/medications");
      const res = await getMedications(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.last7Days).toHaveLength(7);
      expect(data.today).toBe(todayStr);
      expect(data.adherenceStats.window).toBe("7_days");

      const med = data.medications[0];
      expect(med.medication).toBe("Amoxicillin");
      // Old date 2025-01-01 should be strictly filtered out of 7-day logs
      expect(med.usageLogs).not.toContain(oldDate);
      expect(med.usageLogs).toContain(todayStr);
      expect(med.takenToday).toBe(true);
      expect(med.takenDaysCount).toBe(1);
    });

    it("should allow a patient to manually add personal supplement with shareWithDoctor setting", async () => {
      getUser.mockResolvedValueOnce({
        data: { user: { id: "auth-patient-1" } },
      });

      userFindUnique.mockResolvedValueOnce({
        id: "u-patient-1",
        role: "PATIENT",
        patient: { id: "pat-1" },
        doctor: null,
      });

      prescriptionCreate.mockResolvedValueOnce({
        id: "rx-supp-1",
        patientId: "pat-1",
        doctorId: null,
        medication: "Vitamin D3",
        dosage: "1000 IU",
        frequency: "Once daily",
        duration: "Ongoing",
        instructions: "Take with breakfast",
        refillsAllowed: 0,
        isActive: true,
        addedBy: "PATIENT",
        isSharedWithDoctor: true,
        usageLogs: [],
      });

      const req = new NextRequest("http://localhost/api/medications", {
        method: "POST",
        body: JSON.stringify({
          medication: "Vitamin D3",
          dosage: "1000 IU",
          frequency: "Once daily",
          duration: "Ongoing",
          instructions: "Take with breakfast",
          isSharedWithDoctor: true,
        }),
      });

      const res = await postMedication(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(prescriptionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            patientId: "pat-1",
            doctorId: null,
            addedBy: "PATIENT",
            isSharedWithDoctor: true,
          }),
        })
      );
      expect(data.medication.medication).toBe("Vitamin D3");
    });

    it("should toggle usage log for today (1-click mark as taken / unmark)", async () => {
      getUser.mockResolvedValueOnce({
        data: { user: { id: "auth-patient-1" } },
      });

      userFindUnique.mockResolvedValueOnce({
        id: "u-patient-1",
        role: "PATIENT",
        patient: { id: "pat-1" },
        doctor: null,
      });

      // Prescription currently has empty logs
      prescriptionFindUnique.mockResolvedValueOnce({
        id: "rx-1",
        patientId: "pat-1",
        medication: "Lisinopril",
        usageLogs: [],
      });

      prescriptionUpdate.mockResolvedValueOnce({
        id: "rx-1",
        usageLogs: [todayStr],
      });

      const req = new NextRequest("http://localhost/api/medications/rx-1/usage", {
        method: "POST",
        body: JSON.stringify({ date: todayStr }),
      });

      const res = await toggleUsage(req, {
        params: Promise.resolve({ id: "rx-1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.action).toBe("LOGGED");
      expect(prescriptionUpdate).toHaveBeenCalledWith({
        where: { id: "rx-1" },
        data: { usageLogs: [todayStr] },
      });

      // Call again to unmark (toggle behavior)
      getUser.mockResolvedValueOnce({
        data: { user: { id: "auth-patient-1" } },
      });
      userFindUnique.mockResolvedValueOnce({
        id: "u-patient-1",
        role: "PATIENT",
        patient: { id: "pat-1" },
        doctor: null,
      });
      prescriptionFindUnique.mockResolvedValueOnce({
        id: "rx-1",
        patientId: "pat-1",
        medication: "Lisinopril",
        usageLogs: [todayStr],
      });
      prescriptionUpdate.mockResolvedValueOnce({
        id: "rx-1",
        usageLogs: [],
      });

      const req2 = new NextRequest("http://localhost/api/medications/rx-1/usage", {
        method: "POST",
        body: JSON.stringify({ date: todayStr }),
      });

      const res2 = await toggleUsage(req2, {
        params: Promise.resolve({ id: "rx-1" }),
      });
      const data2 = await res2.json();

      expect(res2.status).toBe(200);
      expect(data2.action).toBe("UNLOGGED");
      expect(prescriptionUpdate).toHaveBeenCalledWith({
        where: { id: "rx-1" },
        data: { usageLogs: [] },
      });
    });

    it("should allow a patient to toggle isSharedWithDoctor privacy setting", async () => {
      getUser.mockResolvedValueOnce({
        data: { user: { id: "auth-patient-1" } },
      });

      userFindUnique.mockResolvedValueOnce({
        id: "u-patient-1",
        role: "PATIENT",
        patient: { id: "pat-1" },
        doctor: null,
      });

      prescriptionFindUnique.mockResolvedValueOnce({
        id: "rx-supp-1",
        patientId: "pat-1",
        addedBy: "PATIENT",
        isSharedWithDoctor: true,
      });

      prescriptionUpdate.mockResolvedValueOnce({
        id: "rx-supp-1",
        isSharedWithDoctor: false,
      });

      const req = new NextRequest("http://localhost/api/medications/rx-supp-1/privacy", {
        method: "PATCH",
        body: JSON.stringify({ isSharedWithDoctor: false }),
      });

      const res = await togglePrivacy(req, {
        params: Promise.resolve({ id: "rx-supp-1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.isSharedWithDoctor).toBe(false);
      expect(prescriptionUpdate).toHaveBeenCalledWith({
        where: { id: "rx-supp-1" },
        data: { isSharedWithDoctor: false },
      });
    });
  });

  describe("Doctor Dashboard: 6-Month Adherence Tracking & Privacy Isolation", () => {
    it("should reject doctor query without patientId or without care relationship", async () => {
      getUser.mockResolvedValueOnce({
        data: { user: { id: "auth-doctor-1" } },
      });

      userFindUnique.mockResolvedValueOnce({
        id: "u-doc-1",
        role: "DOCTOR",
        doctor: { id: "doc-1" },
        patient: null,
      });

      // Missing patientId
      const req1 = new NextRequest("http://localhost/api/medications");
      const res1 = await getMedications(req1);
      expect(res1.status).toBe(400);

      // Care relationship check fails
      getUser.mockResolvedValueOnce({
        data: { user: { id: "auth-doctor-1" } },
      });
      userFindUnique.mockResolvedValueOnce({
        id: "u-doc-1",
        role: "DOCTOR",
        doctor: { id: "doc-1" },
        patient: null,
      });
      appointmentFindFirst.mockResolvedValueOnce(null);
      referralFindFirst.mockResolvedValueOnce(null);

      const req2 = new NextRequest("http://localhost/api/medications?patientId=pat-unknown");
      const res2 = await getMedications(req2);
      expect(res2.status).toBe(403);
    });

    it("should strictly enforce privacy filter in doctor query: includes doctor prescriptions + shared patient meds, excludes unshared patient meds", async () => {
      getUser.mockResolvedValueOnce({
        data: { user: { id: "auth-doctor-1" } },
      });

      userFindUnique.mockResolvedValueOnce({
        id: "u-doc-1",
        role: "DOCTOR",
        doctor: { id: "doc-1" },
        patient: null,
      });

      appointmentFindFirst.mockResolvedValueOnce({ id: "apt-1" });

      prescriptionFindMany.mockResolvedValueOnce([
        {
          id: "rx-doc-1",
          patientId: "pat-1",
          doctorId: "doc-1",
          medication: "Metformin",
          dosage: "500mg",
          frequency: "Twice daily",
          duration: "30 days",
          instructions: null,
          refillsAllowed: 3,
          refillsUsed: 1,
          isActive: true,
          prescribedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          expiresAt: null,
          addedBy: "DOCTOR",
          isSharedWithDoctor: true,
          usageLogs: [todayStr],
          doctor: {
            user: { firstName: "Doctor", lastName: "Who" },
          },
        },
      ]);

      const req = new NextRequest("http://localhost/api/medications?patientId=pat-1");
      const res = await getMedications(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(prescriptionFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: "pat-1",
            AND: expect.arrayContaining([
              {
                OR: [
                  { addedBy: "DOCTOR" },
                  { isSharedWithDoctor: true },
                ],
              },
            ]),
          }),
        })
      );
      expect(data.adherenceStats.window).toBe("6_months");
      expect(data.medications[0].medication).toBe("Metformin");
      expect(data.medications[0].totalLoggedDoses).toBe(1);
    });

    it("should allow a doctor to prescribe medication to a patient", async () => {
      getUser.mockResolvedValueOnce({
        data: { user: { id: "auth-doctor-1" } },
      });

      userFindUnique.mockResolvedValueOnce({
        id: "u-doc-1",
        firstName: "Gregory",
        lastName: "House",
        role: "DOCTOR",
        doctor: { id: "doc-1" },
        patient: null,
      });

      patientFindUnique.mockResolvedValueOnce({
        id: "pat-1",
        userId: "u-patient-1",
        user: { firstName: "John", lastName: "Doe" },
      });

      prescriptionCreate.mockResolvedValueOnce({
        id: "rx-new-1",
        patientId: "pat-1",
        doctorId: "doc-1",
        medication: "Atorvastatin",
        dosage: "20mg",
        frequency: "Once daily",
        duration: "30 days",
        instructions: "Take at night",
        refillsAllowed: 2,
        isActive: true,
        addedBy: "DOCTOR",
        isSharedWithDoctor: true,
        usageLogs: [],
      });

      const req = new NextRequest("http://localhost/api/medications", {
        method: "POST",
        body: JSON.stringify({
          patientId: "pat-1",
          medication: "Atorvastatin",
          dosage: "20mg",
          frequency: "Once daily",
          duration: "30 days",
          instructions: "Take at night",
          refillsAllowed: 2,
        }),
      });

      const res = await postMedication(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(prescriptionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            patientId: "pat-1",
            doctorId: "doc-1",
            addedBy: "DOCTOR",
            isSharedWithDoctor: true,
          }),
        })
      );
      expect(createNotification).toHaveBeenCalledWith(
        "u-patient-1",
        "New Medication Prescribed",
        expect.stringContaining("Atorvastatin"),
        "PRESCRIPTION",
        expect.any(Object)
      );
      expect(data.medication.medication).toBe("Atorvastatin");
    });
  });
});
