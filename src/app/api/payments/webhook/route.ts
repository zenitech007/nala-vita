import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { chargeSuccessSchema, SettlementError, settleCharge } from "@/lib/payment-settlement";

export async function POST(req: NextRequest) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret?.startsWith("sk_test_")) return NextResponse.json({ error: "Test payment configuration is unavailable" }, { status: 503 });
  const body = await req.text();
  const signature = req.headers.get("x-paystack-signature");
  const expected = createHmac("sha512", secret).update(body).digest();
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature) || !timingSafeEqual(expected, Buffer.from(signature, "hex")))
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  let parsed: unknown;
  try { parsed = JSON.parse(body); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  // Transfer/reversal events belong to a different resource and cannot settle or downgrade a charge.
  if (!parsed || typeof parsed !== "object" || !("event" in parsed) || parsed.event !== "charge.success")
    return NextResponse.json({ received: true });
  const event = chargeSuccessSchema.safeParse(parsed);
  if (!event.success) return NextResponse.json({ error: "Invalid charge event" }, { status: 400 });
  try {
    const outcome = await settleCharge(event.data);
    return NextResponse.json({ received: true, outcome });
  } catch (error) {
    if (error instanceof SettlementError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Could not process webhook; retry delivery" }, { status: 500 });
  }
}