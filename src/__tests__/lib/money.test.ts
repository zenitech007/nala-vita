import { Prisma } from '@prisma/client';
import { paystackMinorUnits, moneyForJson } from '@/lib/money';
it('F16 uses exact cents when adding a platform fee', () => {
  const quote = new Prisma.Decimal('0.10').plus('0.20').plus(2);
  expect(quote.toFixed(2)).toBe('2.30'); expect(paystackMinorUnits(quote, 'USD')).toBe(230n);
});
it.each(['NaN', 'Infinity', '-1', '0', '1.001'])('F16 rejects invalid/sub-cent amount %s', value => {
  expect(() => paystackMinorUnits(value, 'USD')).toThrow();
});
it('F16 follows Paystack XOF rules and preserves numeric display contracts', () => {
  expect(paystackMinorUnits('100', 'XOF')).toBe(10000n);
  expect(() => paystackMinorUnits('100.50', 'XOF')).toThrow();
  expect(moneyForJson({ amount: new Prisma.Decimal('10.10') })).toEqual({ amount: 10.1 });
});
