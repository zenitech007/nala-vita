BEGIN;
-- CreateEnum
CREATE TYPE "RecordAccessStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RecordScope" AS ENUM ('PROFILE', 'APPOINTMENTS', 'VITALS', 'PRESCRIPTIONS', 'LAB_TESTS', 'NOTES', 'REFERRALS');

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "created_by_facility_id" TEXT;

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "authored_by_doctor_id" TEXT,
ADD COLUMN     "authored_by_facility_id" TEXT,
ADD COLUMN     "authored_by_user_id" TEXT;

-- AlterTable
ALTER TABLE "prescriptions" ADD COLUMN     "authored_by_doctor_id" TEXT,
ADD COLUMN     "authored_by_facility_id" TEXT,
ADD COLUMN     "authored_by_user_id" TEXT;

-- AlterTable
ALTER TABLE "vitals" ADD COLUMN     "authored_by_doctor_id" TEXT,
ADD COLUMN     "authored_by_facility_id" TEXT,
ADD COLUMN     "authored_by_user_id" TEXT;

-- AlterTable
ALTER TABLE "lab_orders" ADD COLUMN     "authored_by_doctor_id" TEXT,
ADD COLUMN     "authored_by_facility_id" TEXT,
ADD COLUMN     "authored_by_user_id" TEXT;

-- AlterTable
ALTER TABLE "lab_results" ADD COLUMN     "authored_by_doctor_id" TEXT,
ADD COLUMN     "authored_by_facility_id" TEXT,
ADD COLUMN     "authored_by_user_id" TEXT;

-- AlterTable
ALTER TABLE "medical_notes" ADD COLUMN     "authored_by_doctor_id" TEXT,
ADD COLUMN     "authored_by_facility_id" TEXT,
ADD COLUMN     "authored_by_user_id" TEXT;

-- AlterTable
ALTER TABLE "referrals" ADD COLUMN     "authored_by_doctor_id" TEXT,
ADD COLUMN     "authored_by_facility_id" TEXT,
ADD COLUMN     "authored_by_user_id" TEXT;

-- CreateTable
CREATE TABLE "facilities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_memberships" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "facility_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_access_requests" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "requester_doctor_id" TEXT,
    "requester_facility_id" TEXT,
    "source_doctor_id" TEXT,
    "source_facility_id" TEXT,
    "source_user_id" TEXT,
    "scope" "RecordScope"[],
    "reason" TEXT,
    "status" "RecordAccessStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "approved_at" TIMESTAMP(3),
    "denied_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "record_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_access_grants" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "requester_doctor_id" TEXT,
    "requester_facility_id" TEXT,
    "source_doctor_id" TEXT,
    "source_facility_id" TEXT,
    "source_user_id" TEXT,
    "scope" "RecordScope"[],
    "status" "RecordAccessStatus" NOT NULL DEFAULT 'APPROVED',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "approved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "record_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_access_logs" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "viewer_user_id" TEXT NOT NULL,
    "viewer_doctor_id" TEXT,
    "viewer_facility_id" TEXT,
    "grant_id" TEXT,
    "record_type" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "record_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "facility_memberships_facility_id_is_active_idx" ON "facility_memberships"("facility_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "facility_memberships_doctor_id_facility_id_key" ON "facility_memberships"("doctor_id", "facility_id");

-- CreateIndex
CREATE INDEX "record_access_requests_patient_id_status_created_at_idx" ON "record_access_requests"("patient_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "record_access_requests_requested_by_user_id_status_created__idx" ON "record_access_requests"("requested_by_user_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "record_access_grants_request_id_key" ON "record_access_grants"("request_id");

-- CreateIndex
CREATE INDEX "record_access_grants_patient_id_status_expires_at_idx" ON "record_access_grants"("patient_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "record_access_grants_requester_doctor_id_status_expires_at_idx" ON "record_access_grants"("requester_doctor_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "record_access_grants_requester_facility_id_status_expires_a_idx" ON "record_access_grants"("requester_facility_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "record_access_logs_patient_id_viewed_at_idx" ON "record_access_logs"("patient_id", "viewed_at");

-- CreateIndex
CREATE INDEX "record_access_logs_viewer_user_id_viewed_at_idx" ON "record_access_logs"("viewer_user_id", "viewed_at");

-- CreateIndex
CREATE INDEX "appointments_authored_by_doctor_id_patient_id_idx" ON "appointments"("authored_by_doctor_id", "patient_id");

-- CreateIndex
CREATE INDEX "appointments_authored_by_facility_id_patient_id_idx" ON "appointments"("authored_by_facility_id", "patient_id");

-- CreateIndex
CREATE INDEX "prescriptions_authored_by_doctor_id_patient_id_idx" ON "prescriptions"("authored_by_doctor_id", "patient_id");

-- CreateIndex
CREATE INDEX "prescriptions_authored_by_facility_id_patient_id_idx" ON "prescriptions"("authored_by_facility_id", "patient_id");

-- CreateIndex
CREATE INDEX "vitals_authored_by_doctor_id_patient_id_idx" ON "vitals"("authored_by_doctor_id", "patient_id");

-- CreateIndex
CREATE INDEX "vitals_authored_by_facility_id_patient_id_idx" ON "vitals"("authored_by_facility_id", "patient_id");

-- CreateIndex
CREATE INDEX "lab_orders_authored_by_doctor_id_patient_id_idx" ON "lab_orders"("authored_by_doctor_id", "patient_id");

-- CreateIndex
CREATE INDEX "lab_orders_authored_by_facility_id_patient_id_idx" ON "lab_orders"("authored_by_facility_id", "patient_id");

-- CreateIndex
CREATE INDEX "lab_results_authored_by_doctor_id_lab_order_id_idx" ON "lab_results"("authored_by_doctor_id", "lab_order_id");

-- CreateIndex
CREATE INDEX "lab_results_authored_by_facility_id_lab_order_id_idx" ON "lab_results"("authored_by_facility_id", "lab_order_id");

-- CreateIndex
CREATE INDEX "medical_notes_authored_by_doctor_id_patient_id_idx" ON "medical_notes"("authored_by_doctor_id", "patient_id");

-- CreateIndex
CREATE INDEX "medical_notes_authored_by_facility_id_patient_id_idx" ON "medical_notes"("authored_by_facility_id", "patient_id");

-- CreateIndex
CREATE INDEX "referrals_authored_by_doctor_id_patient_id_idx" ON "referrals"("authored_by_doctor_id", "patient_id");

-- CreateIndex
CREATE INDEX "referrals_authored_by_facility_id_patient_id_idx" ON "referrals"("authored_by_facility_id", "patient_id");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_created_by_facility_id_fkey" FOREIGN KEY ("created_by_facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_authored_by_doctor_id_fkey" FOREIGN KEY ("authored_by_doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_authored_by_facility_id_fkey" FOREIGN KEY ("authored_by_facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_authored_by_user_id_fkey" FOREIGN KEY ("authored_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_authored_by_doctor_id_fkey" FOREIGN KEY ("authored_by_doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_authored_by_facility_id_fkey" FOREIGN KEY ("authored_by_facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_authored_by_user_id_fkey" FOREIGN KEY ("authored_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vitals" ADD CONSTRAINT "vitals_authored_by_doctor_id_fkey" FOREIGN KEY ("authored_by_doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vitals" ADD CONSTRAINT "vitals_authored_by_facility_id_fkey" FOREIGN KEY ("authored_by_facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vitals" ADD CONSTRAINT "vitals_authored_by_user_id_fkey" FOREIGN KEY ("authored_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_authored_by_doctor_id_fkey" FOREIGN KEY ("authored_by_doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_authored_by_facility_id_fkey" FOREIGN KEY ("authored_by_facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_authored_by_user_id_fkey" FOREIGN KEY ("authored_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_authored_by_doctor_id_fkey" FOREIGN KEY ("authored_by_doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_authored_by_facility_id_fkey" FOREIGN KEY ("authored_by_facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_authored_by_user_id_fkey" FOREIGN KEY ("authored_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_notes" ADD CONSTRAINT "medical_notes_authored_by_doctor_id_fkey" FOREIGN KEY ("authored_by_doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_notes" ADD CONSTRAINT "medical_notes_authored_by_facility_id_fkey" FOREIGN KEY ("authored_by_facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_notes" ADD CONSTRAINT "medical_notes_authored_by_user_id_fkey" FOREIGN KEY ("authored_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_authored_by_doctor_id_fkey" FOREIGN KEY ("authored_by_doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_authored_by_facility_id_fkey" FOREIGN KEY ("authored_by_facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_authored_by_user_id_fkey" FOREIGN KEY ("authored_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_memberships" ADD CONSTRAINT "facility_memberships_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_memberships" ADD CONSTRAINT "facility_memberships_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_access_requests" ADD CONSTRAINT "record_access_requests_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_access_requests" ADD CONSTRAINT "record_access_requests_requester_doctor_id_fkey" FOREIGN KEY ("requester_doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_access_requests" ADD CONSTRAINT "record_access_requests_requester_facility_id_fkey" FOREIGN KEY ("requester_facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_access_requests" ADD CONSTRAINT "record_access_requests_source_doctor_id_fkey" FOREIGN KEY ("source_doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_access_requests" ADD CONSTRAINT "record_access_requests_source_facility_id_fkey" FOREIGN KEY ("source_facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_access_requests" ADD CONSTRAINT "record_access_requests_source_user_id_fkey" FOREIGN KEY ("source_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_access_requests" ADD CONSTRAINT "record_access_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_access_grants" ADD CONSTRAINT "record_access_grants_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_access_grants" ADD CONSTRAINT "record_access_grants_requester_doctor_id_fkey" FOREIGN KEY ("requester_doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_access_grants" ADD CONSTRAINT "record_access_grants_requester_facility_id_fkey" FOREIGN KEY ("requester_facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_access_grants" ADD CONSTRAINT "record_access_grants_source_doctor_id_fkey" FOREIGN KEY ("source_doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_access_grants" ADD CONSTRAINT "record_access_grants_source_facility_id_fkey" FOREIGN KEY ("source_facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_access_grants" ADD CONSTRAINT "record_access_grants_source_user_id_fkey" FOREIGN KEY ("source_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_access_grants" ADD CONSTRAINT "record_access_grants_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "record_access_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_access_logs" ADD CONSTRAINT "record_access_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_access_logs" ADD CONSTRAINT "record_access_logs_viewer_user_id_fkey" FOREIGN KEY ("viewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_access_logs" ADD CONSTRAINT "record_access_logs_viewer_doctor_id_fkey" FOREIGN KEY ("viewer_doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_access_logs" ADD CONSTRAINT "record_access_logs_viewer_facility_id_fkey" FOREIGN KEY ("viewer_facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_access_logs" ADD CONSTRAINT "record_access_logs_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "record_access_grants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- F04 ownership backfill: use only existing provider-of-record metadata.
-- No facility affiliation or legacy vital author is inferred from appointments.
UPDATE appointments SET authored_by_doctor_id = doctor_id;
UPDATE prescriptions SET authored_by_doctor_id = doctor_id WHERE added_by = 'DOCTOR' AND doctor_id IS NOT NULL;
UPDATE prescriptions r SET authored_by_user_id = p.user_id FROM patients p WHERE r.patient_id = p.id AND r.added_by = 'PATIENT';
UPDATE medical_notes SET authored_by_doctor_id = doctor_id;
UPDATE lab_orders SET authored_by_doctor_id = doctor_id;
UPDATE lab_results r SET authored_by_doctor_id = o.authored_by_doctor_id FROM lab_orders o WHERE r.lab_order_id = o.id;
UPDATE referrals SET authored_by_doctor_id = referring_doctor_id;
-- Legacy vitals/unknown authors remain unclassified and unavailable to provider grants.

ALTER TABLE record_access_requests ALTER COLUMN scope SET NOT NULL,
  ADD CONSTRAINT record_request_one_requester CHECK (num_nonnulls(requester_doctor_id, requester_facility_id) = 1),
  ADD CONSTRAINT record_request_one_source CHECK (num_nonnulls(source_doctor_id, source_facility_id, source_user_id) = 1),
  ADD CONSTRAINT record_request_scope_not_empty CHECK (cardinality(scope) > 0);
ALTER TABLE record_access_grants ALTER COLUMN scope SET NOT NULL,
  ADD CONSTRAINT record_grant_one_requester CHECK (num_nonnulls(requester_doctor_id, requester_facility_id) = 1),
  ADD CONSTRAINT record_grant_one_source CHECK (num_nonnulls(source_doctor_id, source_facility_id, source_user_id) = 1),
  ADD CONSTRAINT record_grant_scope_not_empty CHECK (cardinality(scope) > 0),
  ADD CONSTRAINT record_grant_revocation_timestamp CHECK (status <> 'REVOKED' OR revoked_at IS NOT NULL);
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_access_logs ENABLE ROW LEVEL SECURITY;
-- This app serves these data through guarded server APIs, not direct browser table access.
REVOKE ALL ON facilities, facility_memberships, record_access_requests, record_access_grants, record_access_logs FROM anon, authenticated;
COMMIT;