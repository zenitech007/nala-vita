import { Prisma } from '@prisma/client';
const getUser = jest.fn(), findUser = jest.fn(), appointment = jest.fn(), payment = jest.fn();
const createAttempt = jest.fn(), findAttempt = jest.fn(), updateAttempt = jest.fn(), legacyUpdate = jest.fn();
let transactionQueue = Promise.resolve();
async function serialTransaction(fn: (tx: unknown) => unknown) {
  const previous = transactionQueue;
  let release!: () => void;
  transactionQueue = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try { return await fn({ $queryRaw: async () => [], appointment: { findFirst: appointment }, payment: { findUnique: payment },
    paymentAttempt: { create: createAttempt, findFirst: findAttempt, updateMany: updateAttempt } }); }
  finally { release(); }
}
jest.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: () => ({ auth: { getUser } }) }));
jest.mock('@/lib/auth', () => ({ requireApiUser: async () => ({ ok: true, user: await findUser() }) }));
jest.mock('@/lib/prisma', () => ({ prisma: {
  user: { findUnique: (...a: unknown[]) => findUser(...a) },
  appointment: { findFirst: (...a: unknown[]) => appointment(...a) },
  payment: { findUnique: (...a: unknown[]) => payment(...a), update: (...a: unknown[]) => legacyUpdate(...a), create: async () => ({ id: 'legacy-created' }) },
  paymentAttempt: { create: (...a: unknown[]) => createAttempt(...a), findFirst: (...a: unknown[]) => findAttempt(...a), updateMany: (...a: unknown[]) => updateAttempt(...a) },
  $transaction: (fn: (tx: unknown) => unknown) => serialTransaction(fn),
} }));
let POST: typeof import('@/app/api/payments/route').POST;
const originalFetch = global.fetch;
const originalKey = process.env.PAYSTACK_SECRET_KEY;
let events: string[], stored: Record<string, unknown> | null;
beforeAll(async () => { process.env.PAYSTACK_SECRET_KEY = 'sk_test_unit'; POST = (await import('@/app/api/payments/route')).POST; });
beforeEach(() => {
  jest.resetAllMocks(); events = []; stored = null; transactionQueue = Promise.resolve(); process.env.PAYSTACK_SECRET_KEY = 'sk_test_unit';
  getUser.mockResolvedValue({ data: { user: { id: 'auth' } } });
  findUser.mockResolvedValue({ id: 'u', email: 'synthetic@example.test', role: 'PATIENT', isActive: true, patient: { id: 'p' } });
  const p = { id: 'pay', patientId: 'p', appointmentId: 'a', status: 'PENDING', amount: new Prisma.Decimal('10.10'), currency: 'USD' };
  appointment.mockResolvedValue({ id: 'a', patientId: 'p', status: 'SCHEDULED', payment: p }); payment.mockResolvedValue(p);
  createAttempt.mockImplementation(async ({ data }) => { events.push('persist'); stored = { ...data, id: 'attempt' }; return stored; });
  findAttempt.mockImplementation(async () => stored);
  updateAttempt.mockImplementation(async ({ where, data }) => {
    if (stored?.id !== where.id || stored?.status !== where.status) return { count: 0 };
    stored = { ...stored, ...data }; return { count: 1 };
  });
  global.fetch = jest.fn(async (_url, init) => {
    events.push('provider'); const body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ status: true, data: { reference: body.reference, authorization_url: 'https://checkout.paystack.com/synthetic', access_code: 'synthetic' } }));
  });
});
afterAll(() => { global.fetch = originalFetch; if (originalKey === undefined) delete process.env.PAYSTACK_SECRET_KEY; else process.env.PAYSTACK_SECRET_KEY = originalKey; });
const req = () => new Request('http://localhost/api/payments', { method: 'POST', body: JSON.stringify({ appointmentId: 'a' }) }) as never;
it('F16 persists the exact binding before making a provider request', async () => {
  const result = await POST(req()); expect(result.status).toBe(200);
  expect(events).toEqual(['persist', 'provider']);
  expect(createAttempt).toHaveBeenCalledWith({ data: expect.objectContaining({ paymentId: 'pay', patientId: 'p', appointmentId: 'a', amountMinor: 1010n, currency: 'USD', status: 'INITIATING', domain: 'test' }) });
  expect(legacyUpdate).not.toHaveBeenCalled();
});
it('F16 reuses initialized checkout instead of overwriting an earlier reference', async () => {
  const first = await (await POST(req())).json(); const second = await (await POST(req())).json();
  expect(second.reference).toBe(first.reference); expect(global.fetch).toHaveBeenCalledTimes(1); expect(createAttempt).toHaveBeenCalledTimes(1);
});
it('F16 rejects live credentials before calling a provider', async () => {
  process.env.PAYSTACK_SECRET_KEY = 'sk_live_blocked'; expect((await POST(req())).status).toBe(503); expect(global.fetch).not.toHaveBeenCalled();
});
it('F16 refuses checkout when no durable quoted payment exists', async () => {
  appointment.mockResolvedValue({ id: 'a', patientId: 'p', status: 'SCHEDULED', payment: null });
  expect((await POST(req())).status).toBe(409); expect(global.fetch).not.toHaveBeenCalled();
});
it('F16 retains an uncertain reference and blocks blind retry after provider timeout', async () => {
  (global.fetch as jest.Mock).mockRejectedValue(new Error('synthetic timeout'));
  expect((await POST(req())).status).toBe(502);
  expect(stored).toEqual(expect.objectContaining({ reference: expect.any(String), status: 'INITIALIZATION_UNKNOWN' }));
  expect((await POST(req())).status).toBe(409); expect(global.fetch).toHaveBeenCalledTimes(1);
});
it('F16 concurrent initializations persist and send at most one attempt', async () => {
  const results = await Promise.all([POST(req()), POST(req())]);
  expect(results.some(result => result.status === 200)).toBe(true);
  expect(createAttempt).toHaveBeenCalledTimes(1); expect(global.fetch).toHaveBeenCalledTimes(1);
});
