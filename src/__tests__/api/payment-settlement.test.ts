import { createHmac } from 'node:crypto';
import { Prisma } from '@prisma/client';
const notification = jest.fn(), updatePayment = jest.fn(), updateAppointment = jest.fn();
let state: any, queue = Promise.resolve();
let receipts: Map<string, unknown>;
const appointment = () => ({ id: 'a', patientId: 'p', status: state.appointmentStatus,
  patient: { userId: 'patient-user', user: { id: 'patient-user', firstName: 'Synthetic', lastName: 'Patient' } },
  doctor: { userId: 'doctor-user', user: { id: 'doctor-user', firstName: 'Synthetic', lastName: 'Doctor' } } });
const attempt = () => ({ ...state.attempt, payment: { ...state.payment, appointment: appointment() } });
async function runTransaction(fn: (tx: any) => unknown) {
  const previous = queue; let release!: () => void;
  queue = new Promise<void>(resolve => { release = resolve; }); await previous;
  const backup = { payment: { ...state.payment }, attempt: { ...state.attempt }, appointmentStatus: state.appointmentStatus };
  const oldReceipts = new Map(receipts);
  const tx = {
    $queryRaw: async () => [],
    paymentAttempt: {
      findUnique: async ({ where }: any) => (where.reference && where.reference !== 'ref-synthetic') ? null : attempt(),
      updateMany: async ({ where, data }: any) => {
        if (where.status?.in && !where.status.in.includes(state.attempt.status)) return { count: 0 };
        Object.assign(state.attempt, data); return { count: 1 };
      },
    },
    paymentProviderEvent: {
      findUnique: async ({ where }: any) => receipts.get(where.providerEventId) ?? null,
      create: async ({ data }: any) => { if (receipts.has(data.providerEventId)) throw { code: 'P2002' }; receipts.set(data.providerEventId, data); return data; },
    },
    payment: {
      findFirst: async ({ where }: any) => where.paystackReference === 'ref-synthetic' ? { ...state.payment, patient: { user: { id: 'patient-user' } } } : null,
      findUnique: async () => ({ ...state.payment, appointment: appointment() }),
      update: updatePayment,
      updateMany: async ({ where, data }: any) => {
        if (where.status !== state.payment.status) return { count: 0 };
        updatePayment({ where, data }); Object.assign(state.payment, data); return { count: 1 };
      },
    },
    appointment: {
      findUnique: async () => appointment(), update: updateAppointment,
      updateMany: async ({ where, data }: any) => {
        if (!where.status.in.includes(state.appointmentStatus)) return { count: 0 };
        updateAppointment({ where, data }); state.appointmentStatus = data.status; return { count: 1 };
      },
    },
    notification: { create: notification },
  };
  try { return await fn(tx); }
  catch (error) { state = backup; receipts = oldReceipts; throw error; }
  finally { release(); }
}
jest.mock('@/lib/prisma', () => ({ prisma: {
  $transaction: (fn: (tx: any) => unknown) => runTransaction(fn),
  payment: { findFirst: async () => ({ ...state.payment, patient: { user: { id: 'patient-user' } } }), update: (...a: unknown[]) => updatePayment(...a) },
  notification: { create: (...a: unknown[]) => notification(...a) },
} }));
let POST: typeof import('@/app/api/payments/webhook/route').POST;
const originalKey = process.env.PAYSTACK_SECRET_KEY;
beforeAll(async () => { process.env.PAYSTACK_SECRET_KEY = 'sk_test_unit'; POST = (await import('@/app/api/payments/webhook/route')).POST; });
afterAll(() => { if (originalKey === undefined) delete process.env.PAYSTACK_SECRET_KEY; else process.env.PAYSTACK_SECRET_KEY = originalKey; });
beforeEach(() => {
  jest.clearAllMocks(); receipts = new Map(); queue = Promise.resolve();
  state = { payment: { id: 'pay', patientId: 'p', appointmentId: 'a', amount: new Prisma.Decimal('10.10'), currency: 'USD', status: 'PENDING' },
    attempt: { id: 'attempt', paymentId: 'pay', patientId: 'p', appointmentId: 'a', reference: 'ref-synthetic', amountMinor: 1010n,
      currency: 'USD', domain: 'test', status: 'INITIALIZED', providerTransactionId: null }, appointmentStatus: 'SCHEDULED' };
});
function webhook(data: Record<string, unknown> = {}, event = 'charge.success', validSignature = true) {
  const body = JSON.stringify({ event, data: { id: 123, domain: 'test', reference: 'ref-synthetic', amount: 1010, currency: 'USD',
    status: 'success', channel: 'card', paid_at: '2030-01-01T12:00:00Z', metadata: { appointmentId: 'a', patientId: 'p' }, ...data } });
  return POST(new Request('http://localhost/api/payments/webhook', { method: 'POST', body,
    headers: { 'x-paystack-signature': validSignature ? createHmac('sha512', 'sk_test_unit').update(body).digest('hex') : 'bad' } }) as never);
}
it.each([
  { reference: 'unknown' }, { amount: 1 }, { currency: 'NGN' }, { domain: 'live' },
  { metadata: { appointmentId: 'victim', patientId: 'p' } }, { metadata: { appointmentId: 'a', patientId: 'victim' } },
])('F15 refuses unbound signed settlement %j', async data => {
  expect((await webhook(data)).status).toBe(400); expect(updatePayment).not.toHaveBeenCalled();
  expect(updateAppointment).not.toHaveBeenCalled(); expect(notification).not.toHaveBeenCalled();
});
it('F15 rejects invalid signatures before database changes', async () => {
  expect((await webhook({}, 'charge.success', false)).status).toBe(400); expect(updatePayment).not.toHaveBeenCalled();
});
it('F15 duplicate and concurrent delivery produces exactly one settlement and two notifications', async () => {
  const results = await Promise.all([webhook(), webhook()]);
  expect(results.map(r => r.status)).toEqual([200, 200]); expect(updatePayment).toHaveBeenCalledTimes(1);
  expect(updateAppointment).toHaveBeenCalledTimes(1); expect(notification).toHaveBeenCalledTimes(2); expect(receipts.size).toBe(1);
});
it('F15 cannot reconfirm a cancelled appointment', async () => {
  state.appointmentStatus = 'CANCELLED'; expect((await webhook()).status).toBe(200);
  expect(updatePayment).not.toHaveBeenCalled(); expect(updateAppointment).not.toHaveBeenCalled(); expect(notification).not.toHaveBeenCalled();
  expect([...receipts.values()]).toEqual([expect.objectContaining({ outcome: 'REQUIRES_RECONCILIATION' })]);
});
it('F15 unrelated/out-of-order reversal events cannot downgrade a settled charge', async () => {
  await webhook(); const before = updatePayment.mock.calls.length;
  await webhook({}, 'transfer.reversed'); await webhook({}, 'charge.failed');
  expect(updatePayment).toHaveBeenCalledTimes(before); expect(notification).toHaveBeenCalledTimes(2);
});
it('F15 a notification failure rolls back receipt and payment so delivery can retry', async () => {
  notification.mockRejectedValueOnce(new Error('synthetic persistence failure'));
  expect((await webhook()).status).toBe(500);
  expect(state.payment.status).toBe('PENDING'); expect(state.appointmentStatus).toBe('SCHEDULED'); expect(receipts.size).toBe(0);
  expect((await webhook()).status).toBe(200); expect(state.payment.status).toBe('COMPLETED'); expect(receipts.size).toBe(1);
});
it('F15 provider resource ID cannot be reused for a different attempt', async () => {
  receipts.set('paystack:test:charge.success:123', { attemptId: 'another-attempt', outcome: 'APPLIED' });
  expect((await webhook()).status).toBe(400); expect(updatePayment).not.toHaveBeenCalled();
});
