import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock Supabase Server
const getUser = jest.fn();
jest.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: () => ({
    auth: { getUser: () => getUser() },
  }),
}));

// Mock Supabase Admin
const createUser = jest.fn();
jest.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: (...args: unknown[]) => createUser(...args),
      },
    },
  },
}));

// Mock Notifications
const createNotification = jest.fn();
jest.mock("@/lib/notifications", () => ({
  createNotification: (...args: unknown[]) => createNotification(...args),
}));

// Mock Prisma
const userFindUnique = jest.fn();
const userFindFirst = jest.fn();
const userCreate = jest.fn();
const userUpdate = jest.fn();
const doctorFindUnique = jest.fn();
const doctorFindMany = jest.fn();
const patientFindUnique = jest.fn();
const patientFindMany = jest.fn();
const patientCreate = jest.fn();
const appointmentFindFirst = jest.fn();
const appointmentFindMany = jest.fn();
const appointmentCreate = jest.fn();
const referralFindFirst = jest.fn();
const referralFindMany = jest.fn();
const referralCreate = jest.fn();
const referralUpdate = jest.fn();
const medicalNoteFindFirst = jest.fn();
const medicalNoteFindMany = jest.fn();
const medicalNoteCreate = jest.fn();
const medicalNoteUpdate = jest.fn();
const auditLogCreate = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => userFindUnique(...a),
      findFirst: (...a: unknown[]) => userFindFirst(...a),
      create: (...a: unknown[]) => userCreate(...a),
      update: (...a: unknown[]) => userUpdate(...a),
    },
    doctor: {
      findUnique: (...a: unknown[]) => doctorFindUnique(...a),
      findMany: (...a: unknown[]) => doctorFindMany(...a),
    },
    patient: {
      findUnique: (...a: unknown[]) => patientFindUnique(...a),
      findMany: (...a: unknown[]) => patientFindMany(...a),
      create: (...a: unknown[]) => patientCreate(...a),
    },
    appointment: {
      findFirst: (...a: unknown[]) => appointmentFindFirst(...a),
      findMany: (...a: unknown[]) => appointmentFindMany(...a),
      create: (...a: unknown[]) => appointmentCreate(...a),
    },
    referral: {
      findFirst: (...a: unknown[]) => referralFindFirst(...a),
      findMany: (...a: unknown[]) => referralFindMany(...a),
      create: (...a: unknown[]) => referralCreate(...a),
      update: (...a: unknown[]) => referralUpdate(...a),
    },
    medicalNote: {
      findFirst: (...a: unknown[]) => medicalNoteFindFirst(...a),
      findMany: (...a: unknown[]) => medicalNoteFindMany(...a),
      create: (...a: unknown[]) => medicalNoteCreate(...a),
      update: (...a: unknown[]) => medicalNoteUpdate(...a),
    },
    vital: {
      findMany: jest.fn().mockReturnValue([]),
    },
    prescription: {
      findMany: jest.fn().mockReturnValue([]),
    },
    labOrder: {
      findMany: jest.fn().mockReturnValue([]),
    },
    auditLog: {
      create: (...a: unknown[]) => auditLogCreate(...a),
    },
  },
}));

import { POST as registerHandler } from "@/app/api/auth/register/route";
import { POST as intakePatientHandler } from "@/app/api/patients/route";
import { PATCH as updateReferralHandler } from "@/app/api/referrals/route";
import { POST as shareHandler } from "@/app/api/patients/share/route";
import { PATCH as privacyHandler } from "@/app/api/patients/privacy/route";
import { GET as getPatientRecordHandler } from "@/app/api/patients/[id]/route";

describe("Patient Records Lifecycle & Privacy Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auditLogCreate.mockResolvedValue({ id: "audit-1" });
    createNotification.mockResolvedValue(true);
  });

  describe("1. Patient Account Claiming (Hospital Pre-registered Profile)", () => {
    it("should allow a patient to claim their hospital-provisioned account using their email", async () => {
      // Existing patient created by hospital clinic with emailVerified: false
      userFindUnique.mockResolvedValueOnce({
        id: "u-hospital-1",
        email: "claimant@test.com",
        firstName: "Jane",
        lastName: "HospitalPatient",
        phone: "+15551234",
        role: "PATIENT",
        emailVerified: false,
        patient: { id: "p-hospital-1" },
      });

      // Supabase user creation succeeds
      createUser.mockResolvedValueOnce({
        data: { user: { id: "new-supabase-uid" } },
        error: null,
      });

      // Update Prisma user with Supabase ID and emailVerified: true
      userUpdate.mockResolvedValueOnce({
        id: "u-hospital-1",
        email: "claimant@test.com",
        firstName: "Jane",
        lastName: "HospitalPatient",
        role: "PATIENT",
        emailVerified: true,
        patient: { id: "p-hospital-1" },
      });

      const request = new Request("http://localhost/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: "claimant@test.com",
          password: "SecurePassword123!",
          firstName: "Jane",
          lastName: "HospitalPatient",
          role: "PATIENT",
          dateOfBirth: "1990-01-01",
          gender: "female",
        }),
      });

      const res = await registerHandler(request as never);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.claimed).toBe(true);
      expect(json.message).toContain("prior medical records");
      expect(userUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "u-hospital-1" },
          data: expect.objectContaining({
            supabaseId: "new-supabase-uid",
            emailVerified: true,
          }),
        })
      );
    });

    it("should reject claiming if user already has an active verified account", async () => {
      userFindUnique.mockResolvedValueOnce({
        id: "u-active",
        email: "active@test.com",
        role: "PATIENT",
        emailVerified: true,
      });

      const request = new Request("http://localhost/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: "active@test.com",
          password: "SecurePassword123!",
          firstName: "Active",
          lastName: "User",
          role: "PATIENT",
          dateOfBirth: "1990-01-01",
          gender: "female",
        }),
      });

      const res = await registerHandler(request as never);
      expect(res.status).toBe(409);
    });
  });

  describe("2. Clinic Intake of In-Person Patients", () => {
    it("should allow an authenticated doctor to intake an in-person patient and create records", async () => {
      getUser.mockResolvedValueOnce({ data: { user: { id: "doc-sb-id" } } });
      userFindUnique.mockResolvedValueOnce({
        id: "u-doc",
        role: "DOCTOR",
        doctor: { id: "doc-1" },
      });

      // No existing user
      userFindUnique.mockResolvedValueOnce(null);
      userFindFirst.mockResolvedValueOnce(null);

      // Create provisional patient
      userCreate.mockResolvedValueOnce({
        id: "u-new-prov",
        email: "walkin@clinic.com",
        patient: { id: "p-new-prov" },
      });

      appointmentCreate.mockResolvedValueOnce({ id: "appt-intake" });
      medicalNoteCreate.mockResolvedValueOnce({ id: "note-intake" });
      patientFindUnique.mockResolvedValueOnce({
        id: "p-new-prov",
        user: { firstName: "Walk", lastName: "In", email: "walkin@clinic.com" },
      });

      const request = new Request("http://localhost/api/patients", {
        method: "POST",
        body: JSON.stringify({
          firstName: "Walk",
          lastName: "In",
          email: "walkin@clinic.com",
          phone: "+15559876",
          dateOfBirth: "1985-05-15",
          gender: "male",
          initialNotes: "Patient has acute bronchitis symptoms",
        }),
      });

      const res = await intakePatientHandler(request as never);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.message).toContain("registered successfully");
      expect(appointmentCreate).toHaveBeenCalled();
      expect(medicalNoteCreate).toHaveBeenCalled();
    });
  });

  describe("3. Doctor-to-Doctor Transfer with Patient Approval", () => {
    it("should allow a patient to approve a pending doctor transfer referral", async () => {
      getUser.mockResolvedValueOnce({ data: { user: { id: "pat-sb-id" } } });
      userFindUnique.mockResolvedValueOnce({
        id: "u-patient",
        role: "PATIENT",
        patient: { id: "p-1" },
        firstName: "Alex",
        lastName: "Morgan",
      });

      referralFindFirst.mockResolvedValueOnce({
        id: "ref-1",
        patientId: "p-1",
        status: "PENDING",
        referringDoctor: {
          user: { id: "u-doc-a", firstName: "Alice", lastName: "DocA" },
        },
        referredDoctor: {
          user: { id: "u-doc-b", firstName: "Bob", lastName: "DocB" },
        },
      });

      referralUpdate.mockResolvedValueOnce({
        id: "ref-1",
        status: "ACCEPTED",
      });

      const request = new Request("http://localhost/api/referrals", {
        method: "PATCH",
        body: JSON.stringify({
          referralId: "ref-1",
          action: "ACCEPTED",
        }),
      });

      const res = await updateReferralHandler(request as never);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toContain("approved");
      expect(referralUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ref-1" },
          data: { status: "ACCEPTED" },
        })
      );
      expect(createNotification).toHaveBeenCalledTimes(2); // Both Doctor A and Doctor B notified
    });

    it("should grant Doctor B access to patient records when referral is accepted", async () => {
      getUser.mockResolvedValueOnce({ data: { user: { id: "doc-b-sb-id" } } });
      userFindUnique.mockResolvedValueOnce({
        id: "u-doc-b",
        role: "DOCTOR",
        doctor: { id: "doc-b" },
      });

      // No direct appointment
      appointmentFindFirst.mockResolvedValueOnce(null);

      // But accepted referral exists!
      referralFindFirst.mockResolvedValueOnce({ id: "ref-1", status: "ACCEPTED" });

      patientFindUnique.mockResolvedValueOnce({
        id: "p-1",
        insuranceNumber: "1234567890",
        user: { firstName: "Alex", lastName: "Morgan" },
      });

      const request = new Request("http://localhost/api/patients/p-1");
      const res = await getPatientRecordHandler(request as never, {
        params: { id: "p-1" },
      });

      expect(res.status).toBe(200);
    });

    it("should deny Doctor B access if referral is pending or not accepted", async () => {
      getUser.mockResolvedValueOnce({ data: { user: { id: "doc-c-sb-id" } } });
      userFindUnique.mockResolvedValueOnce({
        id: "u-doc-c",
        role: "DOCTOR",
        doctor: { id: "doc-c" },
      });

      // No appointment and no accepted referral
      appointmentFindFirst.mockResolvedValueOnce(null);
      referralFindFirst.mockResolvedValueOnce(null);

      const request = new Request("http://localhost/api/patients/p-1");
      const res = await getPatientRecordHandler(request as never, {
        params: { id: "p-1" },
      });

      expect(res.status).toBe(403);
    });
  });

  describe("4. Patient Direct Self-Share to Doctor", () => {
    it("should allow a patient to share their records directly with a doctor", async () => {
      getUser.mockResolvedValueOnce({ data: { user: { id: "pat-sb-id" } } });
      userFindUnique.mockResolvedValueOnce({
        id: "u-patient",
        role: "PATIENT",
        patient: { id: "p-1" },
        firstName: "Alex",
        lastName: "Morgan",
      });

      doctorFindUnique.mockResolvedValueOnce({
        id: "doc-target",
        user: { id: "u-target", firstName: "Sarah", lastName: "Cardiologist" },
      });

      appointmentFindFirst.mockResolvedValueOnce(null);
      appointmentCreate.mockResolvedValueOnce({ id: "appt-shared" });

      const request = new Request("http://localhost/api/patients/share", {
        method: "POST",
        body: JSON.stringify({
          doctorId: "doc-target",
          reason: "Seeking cardiology second opinion",
        }),
      });

      const res = await shareHandler(request as never);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(appointmentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            patientId: "p-1",
            doctorId: "doc-target",
            status: "CONFIRMED",
          }),
        })
      );
      expect(createNotification).toHaveBeenCalled();
    });
  });

  describe("5. Granular Privacy & Access Restrictions", () => {
    it("should allow a patient to restrict a sensitive medical note", async () => {
      getUser.mockResolvedValueOnce({ data: { user: { id: "pat-sb-id" } } });
      userFindUnique.mockResolvedValueOnce({
        id: "u-patient",
        role: "PATIENT",
        patient: { id: "p-1" },
      });

      medicalNoteFindFirst.mockResolvedValueOnce({
        id: "note-secret",
        patientId: "p-1",
        title: "Confidential Psychiatry Note",
        isPrivate: false,
      });

      medicalNoteUpdate.mockResolvedValueOnce({
        id: "note-secret",
        isPrivate: true,
      });

      const request = new Request("http://localhost/api/patients/privacy", {
        method: "PATCH",
        body: JSON.stringify({
          noteId: "note-secret",
          isPrivate: true,
        }),
      });

      const res = await privacyHandler(request as never);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.isPrivate).toBe(true);
      expect(json.message).toContain("Record restricted");
      expect(medicalNoteUpdate).toHaveBeenCalledWith({
        where: { id: "note-secret" },
        data: { isPrivate: true },
      });
    });

    it("should reject privacy modification if patient does not own the note", async () => {
      getUser.mockResolvedValueOnce({ data: { user: { id: "pat-sb-id" } } });
      userFindUnique.mockResolvedValueOnce({
        id: "u-patient",
        role: "PATIENT",
        patient: { id: "p-1" },
      });

      medicalNoteFindFirst.mockResolvedValueOnce(null);

      const request = new Request("http://localhost/api/patients/privacy", {
        method: "PATCH",
        body: JSON.stringify({
          noteId: "note-other",
          isPrivate: true,
        }),
      });

      const res = await privacyHandler(request as never);
      expect(res.status).toBe(404);
    });
  });
});
