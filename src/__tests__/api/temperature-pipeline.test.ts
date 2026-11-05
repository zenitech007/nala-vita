let stored: Record<string, any>[] = [];
const createVital = jest.fn();
jest.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'auth' } } }) } }) }));
jest.mock('@/lib/prisma', () => ({ prisma: {
  user: { findUnique: async () => ({ id: 'u', role: 'PATIENT', isActive: true, patient: { id: 'p' } }) },
  vital: { create: (...a: unknown[]) => createVital(...a), findMany: async () => stored },
  patient: { findUnique: async () => ({ user: { firstName: 'Synthetic' }, dateOfBirth: null, gender: null, allergies: [],
    vitals: stored, prescriptions: [], labOrders: [], medicalNotes: [], appointments: [] }) },
  notification: { create: async () => ({}) }, appointment: { findMany: async () => [] },
} }));
import { POST, GET } from '@/app/api/vitals/route';
import { getPatientContext } from '@/lib/amelia/context';
import { renderContext } from '@/lib/amelia/prompts';
beforeEach(() => { stored = []; createVital.mockReset().mockImplementation(async ({ data }) => {
  const row = { id: 'v', recordedAt: new Date('2030-01-01'), ...data }; stored.push(row); return row;
}); });
const req = (body: unknown) => new Request('http://localhost/api/vitals', { method: 'POST', body: JSON.stringify(body) }) as never;
it('F21 98.6 F input survives API storage, readback, display and AI as 37 C', async () => {
  const saved = await POST(req({ temperature: 98.6, temperatureUnit: 'F' })); expect(saved.status).toBe(201);
  expect(stored[0]).toMatchObject({ temperature: 37, temperatureUnit: 'C', temperatureOriginal: 98.6, temperatureOriginalUnit: 'F' });
  const readback = await (await GET(new Request('http://localhost/api/vitals') as never)).json();
  expect(readback.vitals[0].temperature).toBe(37); expect((await saved.json()).isAbnormal).toBe(false);
  const { formatTemperature } = await import('@/lib/temperature');
  expect(formatTemperature(readback.vitals[0].temperature, 'F')).toBe('98.6°F');
  const context = await getPatientContext('p'); expect(context.recentVitals[0]).toMatchObject({ temperature: 37, temperatureUnit: 'C' });
  expect(renderContext(context)).toContain('37.0°C');
});
it('F21 refuses ambiguous temperature input without an explicit unit', async () => {
  expect((await POST(req({ temperature: 37 }))).status).toBe(422); expect(createVital).not.toHaveBeenCalled();
});
it('F21 Celsius input is not converted again and uses Celsius anomaly bounds', async () => {
  const result = await POST(req({ temperature: 37, temperatureUnit: 'C' }));
  expect(result.status).toBe(201); expect(stored[0].temperature).toBe(37); expect((await result.json()).anomalies).toEqual([]);
});
