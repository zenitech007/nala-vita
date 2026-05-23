# Step 26 — Final Integration Checklist

This mirrors the spec's Step 26 final integration checklist with current
status. **Code-side ✅** means the code exists and builds; **Runtime ✅**
means a real human has walked the flow with valid auth and confirmed it
works end-to-end.

| Item | Code | Runtime | Notes |
|---|---|---|---|
| Patient register, log in | ✅ | ⏳ | Needs real Supabase project + a test user |
| Patient book appointment | ✅ | ⏳ | Booking modal wired in Phase 4 Task 3 |
| Patient join video call | ✅ | ⏳ | Phase 4 Task 8 restyled VideoCallPanel; signaling via Supabase Realtime |
| Patient receive prescription | ✅ | ⏳ | Patient prescriptions page exists; doctor writes via doctor/prescriptions |
| Patient view lab results | ✅ | ⏳ | Patient lab-results page exists |
| Patient pay | ✅ | ⏳ | **Paystack**, not Stripe — see [ADR-001](decisions/2026-05-22-paystack-over-stripe.md) |
| Patient chat with doctor | ✅ | ⏳ | Realtime via Supabase Realtime; ChatWindow active |
| Patient pharmacy order | ✅ | ⏳ | Built in Phase 5 Task 2; backend fulfilment is mocked optimistically |
| Doctor log in, see queue | ✅ | ⏳ | Doctor dashboard MetricCards + queue |
| Doctor start consultation | ✅ | ⏳ | `(doctor)/consultation/[appointmentId]` |
| Doctor take voice notes | ✅ | ⏳ | Web Speech API integration in consultation page |
| Doctor write prescription | ✅ | ⏳ | `(doctor)/prescriptions` form |
| Doctor order labs | ✅ | ⏳ | `(doctor)/lab-orders` form |
| Doctor view vitals alerts | ✅ | ⏳ | `(doctor)/monitoring` colour-coded table |
| Doctor refer patient | ✅ | ⏳ | `(doctor)/referrals` send/incoming tabs |
| Doctor see revenue analytics | ✅ | ⏳ | `(doctor)/analytics` + `(doctor)/billing` |
| Admin manage staff | ✅ | ⏳ | `(admin)/staff` |
| Admin assign beds | ✅ | ⏳ | `(admin)/beds` |
| Admin view system analytics | ✅ | ⏳ | `(admin)/dashboard` + `(admin)/reports` |
| Notifications fire for: new appointment, prescription ready, lab result, abnormal vital, new message, payment confirmed | ✅ | ⏳ | `createNotification()` util in `lib/notifications.ts`; every event-emitting route should call it — needs runtime trace to confirm full coverage |
| AI symptom checker returns JSON + renders | ✅ | ⏳ | `/api/ai/symptom-check` uses `response_format: json_object` |
| All routes RBAC-protected | ✅ | ✅ | `middleware.ts`; runtime-verified during Phase 5 Task 4 smoke (all protected paths redirected via `-L` to `/login`, no 500s) |
| File uploads work | ✅ | ⏳ | `/api/upload` + `FileUpload` component; Supabase Storage bucket `medical-files` |
| Real-time chat + vitals alerts | ✅ | ⏳ | Supabase Realtime subscription on `messages` + `vitals` tables |
| Payments flow + webhook | ✅ | ⏳ | Paystack — `POST /transaction/initialize` + `charge.success` webhook signature check |
| Multi-language selector + persists | ✅ | ⏳ | next-intl; locale stored in `NEXT_LOCALE` cookie; 5 locales (en/fr/yo/ha/ig) |

**Legend:**
- ✅ = done
- ⏳ = pending runtime verification (needs valid Supabase + Paystack credentials + a real user walk)
- ❌ = known broken

Currently no items are ❌. If runtime testing reveals breakage, add detail to
`docs/FOLLOW_UPS.md` and mark the item here ❌.
