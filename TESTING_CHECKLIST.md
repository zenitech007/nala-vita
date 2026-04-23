# MediConnect — Final Integration Testing Checklist (Step 26)

> End-to-end verification of all major flows. Test each item manually
> and check the box when confirmed working.

---

## 1. Authentication & Registration

- [ ] **Patient Registration** — Register a new patient account at `/register`. Verify Supabase creates the auth user and Prisma creates the `User` + `Patient` records.
- [ ] **Doctor Registration** — Register a doctor account. Confirm `User` + `Doctor` records are created with specialization and license number.
- [ ] **Login / Logout** — Log in at `/login`, verify session cookie is set. Log out and confirm session is cleared.
- [ ] **Email Verification** — Confirm email verification flow sends a verification email (Supabase Auth setting).
- [ ] **RBAC Middleware** — As a patient, try navigating to `/doctor/dashboard`. Verify redirect to `/unauthorized`. Repeat for `/admin/dashboard`.
- [ ] **Unauthenticated Access** — Visit `/patient/dashboard` while logged out. Verify redirect to `/login?redirectTo=/patient/dashboard`.

---

## 2. Patient Dashboard & Vitals

- [ ] **Patient Dashboard** — Log in as patient. Verify dashboard loads with metrics, quick actions, recent activity, and health alerts.
- [ ] **Record Vitals** — Navigate to `/patient/vitals`. Submit blood pressure, heart rate, temperature, SpO2, blood sugar. Verify data is persisted.
- [ ] **Vitals History** — Confirm recorded vitals appear in the vitals history with correct values and timestamps.
- [ ] **Health Alerts** — If abnormal vitals are recorded (e.g. BP > 140/90), confirm an alert appears on the dashboard.

---

## 3. AI Symptom Checker

- [ ] **Access Symptom Checker** — Navigate to `/patient/symptom-checker`.
- [ ] **Submit Symptoms** — Enter symptoms, severity (1-10), duration, and existing conditions. Submit the form.
- [ ] **Receive Assessment** — Verify the AI returns urgency level, possible conditions, recommendation, seek-care timeframe, and self-care advice.
- [ ] **Disclaimer** — Confirm the medical disclaimer is displayed with the results.
- [ ] **Rate Limiting** — Submit >10 requests within 60 seconds. Verify a 429 response with `Retry-After` header.

---

## 4. Appointment Booking

- [ ] **Browse Doctors** — From the patient dashboard, click "Book Appointment". Verify doctor list loads with specialization and fees.
- [ ] **Select Slot** — Choose a doctor, date, time, and consultation type (Video/In-Person/Phone/Chat).
- [ ] **Confirm Booking** — Submit the booking. Verify an `Appointment` record is created with status `SCHEDULED` and a `Payment` record with status `PENDING`.
- [ ] **Conflict Detection** — Try booking the same doctor at an overlapping time slot. Verify a 409 conflict error.
- [ ] **View Appointments** — Navigate to `/patient/appointments`. Confirm the new appointment appears under "Upcoming".

---

## 5. Video Consultation (Telemedicine)

- [ ] **Join Video Call** — Navigate to `/patient/telemedicine/{appointmentId}`. Verify the video call panel renders.
- [ ] **Doctor Joins** — Log in as the doctor. Navigate to `/doctor/consultation/{appointmentId}`. Verify both parties can see the video interface.
- [ ] **Chat During Call** — Send a message during the consultation. Confirm it appears in the chat window for both parties.
- [ ] **End Consultation** — End the call. Verify appointment status updates to `COMPLETED`.

---

## 6. Doctor Consultation & Clinical Tools

- [ ] **Doctor Dashboard** — Log in as doctor. Verify today's queue, abnormal vitals alerts, and recent prescriptions.
- [ ] **AI Diagnosis Support** — During a consultation, trigger the AI clinical decision support. Verify it returns differential diagnoses, drug interactions, suggested tests, treatment options, and red flags.
- [ ] **Rate Limiting (Diagnosis)** — Confirm >10 requests in 60s returns 429.
- [ ] **Medical Notes** — Create a medical note for the patient. Verify it persists in the database.
- [ ] **AI Risk Score** — Request a risk score for a patient. Verify it returns score (0-100), risk factors, and recommended actions.

---

## 7. Prescriptions

- [ ] **Create Prescription** — As doctor, navigate to `/doctor/prescriptions`. Create a prescription with medication, dosage, frequency, duration, and instructions.
- [ ] **Patient Views Prescription** — Log in as patient. Navigate to `/patient/prescriptions`. Confirm the prescription is visible with all details.
- [ ] **Active vs Expired** — Verify active prescriptions show as active and expired ones are clearly marked.

---

## 8. Lab Orders & Results

- [ ] **Order Lab Test** — As doctor, navigate to `/doctor/lab-orders`. Order a test (e.g. CBC) with urgency level.
- [ ] **View Lab Results** — As patient, navigate to `/patient/lab-results`. Verify completed results display values, units, reference ranges, and abnormal flags.

---

## 9. Payments (Stripe)

- [ ] **Initiate Payment** — Navigate to `/patient/payments`. Click pay on a pending appointment.
- [ ] **Stripe Checkout** — Verify Stripe PaymentIntent is created and the client receives `clientSecret`.
- [ ] **Test Card Payment** — Use Stripe test card `4242 4242 4242 4242`. Confirm payment succeeds.
- [ ] **Webhook Processing** — Verify `/api/payments/webhook` processes `payment_intent.succeeded` and updates the payment record to `COMPLETED` with `paidAt` timestamp.
- [ ] **Payment History** — Confirm the payment appears in payment history with correct status.
- [ ] **Failed Payment Alert** — Use a declining test card (`4000 0000 0000 0002`). Verify admin alerts feed shows the failed payment.

---

## 10. Messaging & Notifications

- [ ] **Send Message** — As patient, navigate to `/patient/chat/{doctorId}`. Send a message.
- [ ] **Receive Message** — As doctor, navigate to `/doctor/chat/{patientId}`. Verify the message appears.
- [ ] **Real-time Delivery** — With both sessions open, send a message and confirm it appears instantly (Socket.IO).
- [ ] **Notification Bell** — Verify the notification bell shows unread count and clicking shows notification list.
- [ ] **Mark As Read** — Click a notification and confirm it's marked as read.

---

## 11. Referrals

- [ ] **Create Referral** — As doctor, navigate to `/doctor/referrals`. Select a receiving doctor by speciality, select a patient, enter reason and notes. Submit.
- [ ] **Notifications Sent** — Verify both the receiving doctor and patient receive notifications.
- [ ] **Accept Referral** — Log in as receiving doctor. Navigate to referrals, click "Accept". Verify status updates.
- [ ] **Decline Referral** — Create another referral and decline it. Verify status updates and notifications.

---

## 12. Admin Panel

- [ ] **Admin Dashboard** — Log in as admin. Verify metrics (active patients, doctors online, appointments today, revenue today) and alerts feed.
- [ ] **Staff Management** — Navigate to `/admin/staff`. Add a new staff member. Toggle active/inactive. Assign a department.
- [ ] **Bed Management** — Navigate to `/admin/beds`. Verify color-coded bed grid. Assign a patient to an available bed. Discharge an occupied bed.

---

## 13. File Uploads

- [ ] **Upload File** — Use the FileUpload component to drag-and-drop an image. Verify progress bar, thumbnail preview, and success state.
- [ ] **Upload PDF** — Upload a PDF file. Verify the PDF icon appears instead of a thumbnail.
- [ ] **Signed URL** — Confirm the returned signed URL is accessible and expires after 1 hour.
- [ ] **Validation** — Try uploading a `.exe` file. Verify rejection. Try a file >10 MB. Verify size error.

---

## 14. i18n & Accessibility

- [ ] **Language Switch** — Navigate to settings. Switch to French. Verify UI labels change.
- [ ] **Yoruba / Hausa / Igbo** — Switch to each Nigerian language. Confirm translations render correctly.
- [ ] **Font Size** — Toggle small → medium → large. Verify document root font-size changes and persists on reload.
- [ ] **High Contrast** — Enable high contrast mode. Verify dark backgrounds, white text, yellow focus outlines. Confirm preference persists on reload.
- [ ] **Aria Labels** — Inspect interactive elements in settings page with browser dev tools. Confirm `aria-label`, `aria-pressed`, `aria-checked`, and `role="switch"` are present.

---

## 15. Security & Compliance

- [ ] **Audit Logging** — Trigger a sensitive action (e.g. view patient record). Query `audit_logs` table and confirm the entry exists with action, resource type, and resource ID — but NO PHI in metadata.
- [ ] **RLS Policies** — Using the Supabase client SDK (not service key), query `patients` table as a patient. Verify only own records returned. Query as a doctor and verify only associated patient records returned.
- [ ] **Rate Limiting Headers** — Make an AI API call. Inspect response headers for `X-RateLimit-Remaining` and `X-RateLimit-Reset`.
- [ ] **RBAC Enforcement** — Confirm all `/patient/*`, `/doctor/*`, and `/admin/*` routes are protected by the middleware.

---

## Summary

| Section | Items |
|---------|-------|
| Auth & Registration | 6 |
| Patient Dashboard & Vitals | 4 |
| AI Symptom Checker | 5 |
| Appointment Booking | 5 |
| Video Consultation | 4 |
| Doctor Tools & AI | 5 |
| Prescriptions | 3 |
| Lab Orders & Results | 2 |
| Payments (Stripe) | 6 |
| Messaging & Notifications | 5 |
| Referrals | 4 |
| Admin Panel | 3 |
| File Uploads | 4 |
| i18n & Accessibility | 5 |
| Security & Compliance | 4 |
| **Total** | **65 test items** |
