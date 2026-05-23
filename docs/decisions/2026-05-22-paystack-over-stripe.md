# ADR-001: Paystack chosen over Stripe for payments

**Date:** 2026-05-22
**Status:** Accepted
**Affects:** Step 16 of `nala-vita-claude-code-prompt.md`

## Context

The Nala Vita spec (Step 16) calls for Stripe with NGN currency:

```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(amount * 100),
  currency: 'ngn',
  metadata: { appointmentId, patientId }
})
```

When the spec was implemented (during the Med connect import that became this
codebase's foundation), **Paystack** was used instead of Stripe. The
`package.json` does NOT contain `stripe` or `@stripe/stripe-js`. The payment
routes at `src/app/api/payments/route.ts` and
`src/app/api/payments/webhook/route.ts` wire directly to Paystack's REST API.

## Decision

**Keep Paystack. Do NOT migrate to Stripe.**

## Rationale

1. **Target market is Nigerian.** The spec uses NGN currency, which strongly
   signals a Nigerian-first product. Paystack is the dominant Nigerian
   payment processor with native NGN support, local bank integrations, USSD
   payment collection, and mobile-money rails that Stripe lacks in West
   Africa.

2. **Already working.** `src/app/api/payments/route.ts` and
   `src/app/api/payments/webhook/route.ts` already wire to Paystack's API and
   handle the equivalent of `payment_intent.succeeded` via Paystack's
   `charge.success` event.

3. **Webhook signature verification is implemented for Paystack**
   (`PAYSTACK_WEBHOOK_SECRET` env var, HMAC-SHA512 of the request body).
   Same security posture as a Stripe webhook signature would provide.

4. **Migration cost.** Switching to Stripe would mean: install `stripe` +
   `@stripe/stripe-js`, rewrite both routes, rewrite the webhook signature
   logic, replace the Paystack Inline JS on the patient payments page with
   Stripe Elements, and re-test the entire payment flow end-to-end. Net
   negative without a clear reason.

## Consequences

- Step 16 of the spec is implemented in spirit but not in letter. Future
  maintainers reading the spec should treat the Stripe-specific code as
  reference, not requirement.
- If Nala Vita expands beyond Nigerian markets later, a payment-provider
  abstraction (or dual-provider) becomes a sensible refactor. Not now.
- Anyone grepping `package.json` for "stripe" expecting to find the
  implementation will not. This ADR is the answer.

## Implementation pointers

| Concept | Stripe (spec) | Paystack (actual) |
|---|---|---|
| Server-side init | `new Stripe(SECRET_KEY)` | `process.env.PAYSTACK_SECRET_KEY` (raw `fetch` — no SDK) |
| Create payment | `stripe.paymentIntents.create({amount, currency})` | `POST /transaction/initialize` returns `authorization_url` |
| Frontend collect | `@stripe/stripe-js` Elements | Paystack Inline JS (loaded client-side on `/patient/payments`) |
| Webhook event | `payment_intent.succeeded` | `charge.success` |
| Webhook auth | `Stripe.webhooks.constructEvent(body, sig, secret)` | HMAC-SHA512 of raw body with `PAYSTACK_WEBHOOK_SECRET` |
| Currency | `'ngn'` literal | `NGN` enum value in `Payment.currency` (default in Prisma schema) |
| Env vars | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` | `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` |
