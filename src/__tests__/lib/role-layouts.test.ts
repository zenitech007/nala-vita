const identity = jest.fn();
jest.mock('@/lib/auth-cache', () => ({ getAuthenticatedUserWithProfile: () => identity() }));
jest.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
jest.mock('@/components/layout/PatientSidebar', () => () => null);
jest.mock('@/components/layout/DoctorSidebar', () => () => null);
jest.mock('@/components/layout/AdminSidebar', () => () => null);
jest.mock('@/components/amelia/AmeliaLauncher', () => () => null);
import PatientLayout from '@/app/(patient)/patient/layout';
import DoctorLayout from '@/app/(doctor)/doctor/layout';
import AdminLayout from '@/app/(admin)/admin/layout';
it.each([['patient', PatientLayout], ['doctor', DoctorLayout], ['admin', AdminLayout]] as const)('F10 %s layout denies another database role despite tampered metadata', async (role, layout) => {
  identity.mockResolvedValue({ session: { user: { user_metadata: { role: role.toUpperCase() } } }, user: { role: role === 'patient' ? 'ADMIN' : 'PATIENT', isActive: true, patient: { id: 'p' }, doctor: { id: 'd', isVerified: true }, admin: { id: 'a' } } });
  await expect(layout({ children: null })).rejects.toThrow('REDIRECT:/unauthorized');
});
it.each([PatientLayout, DoctorLayout, AdminLayout])('F10 layout denies inactive database identity', async layout => {
  identity.mockResolvedValue({ session: { user: {} }, user: { role: 'ADMIN', isActive: false, admin: { id: 'a' } } });
  await expect(layout({ children: null })).rejects.toThrow('REDIRECT:/login');
});
import AmeliaLauncher from '@/components/amelia/AmeliaLauncher';

it('keeps the patient assistant out of the clinician layout', async () => {
  identity.mockResolvedValue({ session: { user: {} }, user: { role: 'DOCTOR', isActive: true, doctor: { id: 'd', isVerified: true } } });
  const layout = await DoctorLayout({ children: null });
  const children = layout.props.children as Array<{ type: unknown }>;
  expect(children.map(child => child.type)).not.toContain(AmeliaLauncher);
});

it('shows a pending doctor status without clinical children', async () => {
  identity.mockResolvedValue({ session: { user: {} }, user: { role: 'DOCTOR', isActive: true, doctor: { id: 'd', isVerified: false, verification: { status: 'PENDING' } } } });
  const layout = await DoctorLayout({ children: 'SENSITIVE_CHILD' });
  expect(JSON.stringify(layout)).not.toContain('SENSITIVE_CHILD');
  expect(JSON.stringify(layout)).toMatch(/pending/i);
});
