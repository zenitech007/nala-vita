# Known follow-ups

Documented gaps from Phases 1–5 that are NOT bugs — they're conscious
deferrals. Each has a rationale in the original task / phase plan.

## Code-level

1. **Wire `HealthDashboard.onUpdate` to a real API.** Currently the inline
   widget on `(patient)/dashboard` accepts a callback but isn't persisted.
   Needs a `DailyLog` Prisma model + `/api/patients/me/daily-log` endpoint.
   The current `Vital` model is per-reading; a daily-log is per-day-per-
   patient with water/steps/medsTaken summary. Either add it or repurpose
   `Vital`. Phase 4 Task 3 left a `TODO` comment in
   `PatientDashboardClient.tsx`.

2. **Replace ChatWindow internals with Phase 3 components.**
   `src/components/chat/ChatWindow.tsx` has its own bubble + textarea
   implementation. The Phase 3 `ChatMessage`, `ChatInput`, and
   `TypingIndicator` components are available but not composed. Refactor
   risk is "could break realtime + scroll" — needs a careful pass when
   there's appetite for it. Phase 4 Task 5 explicitly chose the lower-risk
   "just sweep blues" path.

3. **Add `ThemeContext` bridge for recharts.** Charts use static
   `THEMES.rose.primary` for stroke / fill. They won't re-tint when the
   user switches theme. Adding a small context that resolves the active
   CSS variable's RGB value at runtime would fix it. Phase 3 Task 2 left a
   `TODO Phase 4+` comment in `PatientIntakeChart.tsx`.

4. **Add `(patient)/pharmacy` backend.** Phase 5 Task 2 shipped a UI-only
   pharmacy page. A full implementation needs:
   - `PharmacyOrder` Prisma model with status enum (REQUESTED/READY/COLLECTED)
   - `/api/pharmacy/orders` POST/PATCH/GET
   - Notification fired when the order status changes to READY

5. **Cosmetic file extraction.** `src/lib/openai.ts`, `src/lib/stripe.ts`
   (note: would be `paystack.ts`), `src/lib/validations.ts` are not
   standalone — logic is inlined in routes. Functional equivalents exist;
   purely a discoverability / convention cleanup.

6. **`src/hooks/useAuth.ts` missing.** Auth currently uses Supabase client
   directly in components. A `useAuth()` hook would centralise. Cosmetic.

7. **Step 25 runtime: RLS policies applied in Supabase dashboard.**
   ✅ Done 2026-05-22. 60 policies applied across 16 tables. See
   `docs/SUPABASE_SETUP.md` for the apply command.

8. **Spec Stripe items vs. Paystack reality.** See
   [`docs/decisions/2026-05-22-paystack-over-stripe.md`](decisions/2026-05-22-paystack-over-stripe.md). Spec says Stripe; we use Paystack
   (better fit for NGN market). Future maintainers should reference the ADR.

## Operational

9. **18 npm audit vulnerabilities** (1 low, 11 moderate, 6 high) noted
   during `npm install`. Run `npm audit fix --force` and re-test when
   there's time.

10. **Windows file-locking on `.next/trace`.** Hit twice during Phase 1
    builds. Workaround documented:
    `cmd //c "taskkill /F /IM node.exe" && rm -rf .next` before re-building.
    Likely a Next.js + Windows interaction; not Nala-Vita-specific.

## Documentation

11. **Per-route ownership doc.** No `docs/ARCHITECTURE.md` exists. Useful
    if more than one developer joins. Should cover: route groups, the
    server-component layout pattern, the SidebarShell composition, the
    Phase 1 theming system, and the realtime subscription topology.
