import { Prisma } from "@prisma/client";

/** Paystack requires base ×100 even for XOF, where fractional base amounts are forbidden. */
export function paystackMinorUnits(amount: Prisma.Decimal.Value, currency: string): bigint {
  if (!["USD", "NGN", "GHS", "ZAR", "KES", "XOF"].includes(currency)) throw new Error("Unsupported payment currency");
  const decimal = new Prisma.Decimal(amount);
  const minor = decimal.mul(100);
  if (!decimal.isFinite() || decimal.lte(0) || !minor.isInteger()
    || (currency === "XOF" && !decimal.isInteger()) || minor.gt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Invalid quoted amount");
  }
  return BigInt(minor.toFixed(0));
}

/** Keep existing JSON number contracts; accounting and comparisons stay decimal/integer. */
export function moneyForJson(value: unknown): unknown {
  if (Prisma.Decimal.isDecimal(value)) return value.toNumber();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(moneyForJson);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, moneyForJson(item)]));
  return value;
}
