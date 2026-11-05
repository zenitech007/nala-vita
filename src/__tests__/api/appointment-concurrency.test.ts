const getUser = jest.fn(), findUser = jest.fn(), findDoctor = jest.fn();
let rows: { id: string; doctorId: string; patientId: string; scheduledAt: Date; duration: number }[] = [];
let locks: Map<string, Promise<void>>;
// A deterministic transaction/lock simulator, not a claim of real PostgreSQL verification.
async function transaction(fn: (tx: unknown) => Promise<unknown>) {
  const releases: (() => void)[] = [];
  const tx = {
    $queryRaw: async (sql: TemplateStringsArray, ...values: unknown[]) => {
      if (sql.join('').includes('pg_advisory_xact_lock')) {
        const key = String(values[0]);
        const previous = locks.get(key) ?? Promise.resolve();
        const next = new Promise<void>(resolve => releases.push(resolve));
        locks.set(key, previous.then(() => next));
        await previous; return [];
      }
      const [doctorId, patientId, end, start] = values as [string, string, Date, Date];
      return rows.filter(r => (r.doctorId === doctorId || r.patientId === patientId)
        && r.scheduledAt < end && r.scheduledAt.getTime() + r.duration * 60_000 > start.getTime());
    },
    appointment: { create: async ({ data }: { data: typeof rows[number] }) => {
      await Promise.resolve(); const row = { ...data, id: `a${rows.length}` }; rows.push(row); return row;
    } },
    payment: { create: async () => ({ id: 'payment' }) },
  };
  try { return await fn(tx); } finally { releases.forEach(release => release()); }
}
jest.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: () => ({ auth: { getUser } }) }));
jest.mock('@/lib/prisma', () => ({ prisma: {
  user: { findUnique: (...a: unknown[]) => findUser(...a) },
  doctor: { findUnique: (...a: unknown[]) => findDoctor(...a) },
  appointment: { findMany: async () => [] },
  $transaction: (...a: [Parameters<typeof transaction>[0]]) => transaction(...a),
} }));
import { POST } from '@/app/api/appointments/route';
beforeEach(() => {
  jest.resetAllMocks(); rows = []; locks = new Map();
  jest.useFakeTimers().setSystemTime(new Date('2030-01-01'));
  getUser.mockResolvedValue({ data: { user: { id: 'auth' } } });
  findUser.mockResolvedValue({ id: 'u', role: 'PATIENT', isActive: true, patient: { id: 'p' } });
  findDoctor.mockImplementation(async ({ where }) => ({ id: where.id, isVerified: true, user: { isActive: true },
    timeZone: 'UTC', availableDays: ['Monday'], availableFrom: '09:00', availableTo: '17:00', consultationFee: 10 }));
});
afterEach(() => jest.useRealTimers());
async function book(doctorId: string, scheduledAt: string, duration: number) {
  return POST(new Request('http://localhost/api/appointments', { method: 'POST', body: JSON.stringify({ doctorId, scheduledAt, duration, consultationType: 'VIDEO' }) }) as never);
}
it.each(['same doctor', 'different doctors'])('F14 admits only one parallel overlapping request with unequal durations: %s', async target => {
  if (target === 'same doctor') {
    findUser.mockResolvedValueOnce({ id: 'u1', role: 'PATIENT', isActive: true, patient: { id: 'p1' } })
      .mockResolvedValueOnce({ id: 'u2', role: 'PATIENT', isActive: true, patient: { id: 'p2' } });
  }
  const results = await Promise.all([
    book('d1', '2030-01-07T10:00:00Z', 90),
    book(target === 'same doctor' ? 'd1' : 'd2', '2030-01-07T11:00:00Z', 30),
  ]);
  expect(results.map(r => r.status).sort()).toEqual([201, 409]); expect(rows).toHaveLength(1);
});
it('F14 allows adjacent appointments without overlap', async () => {
  expect((await book('d1', '2030-01-07T10:00:00Z', 90)).status).toBe(201);
  expect((await book('d1', '2030-01-07T11:30:00Z', 30)).status).toBe(201);
});
