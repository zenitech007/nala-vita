const grants = jest.fn(), memberships = jest.fn(), patient = jest.fn(), log = jest.fn();
jest.mock('@/lib/prisma', () => ({ prisma: {
  recordAccessGrant: { findMany: (...a: unknown[]) => grants(...a) },
  facilityMembership: { findMany: (...a: unknown[]) => memberships(...a) },
  patient: { findUnique: (...a: unknown[]) => patient(...a) },
  recordAccessLog: { createMany: (...a: unknown[]) => log(...a) },
} }));
let visibility: typeof import('@/lib/record-visibility');
const doctor = (id: string) => ({ id: `user-${id}`, role: 'DOCTOR', isActive: true, doctor: { id, isVerified: true } });
const approved = { id: 'g', patientId: 'p', requesterDoctorId: 'b', requesterFacilityId: null, sourceDoctorId: 'a', sourceFacilityId: null, sourceUserId: null,
  scope: ['NOTES', 'PRESCRIPTIONS'], status: 'APPROVED', expiresAt: new Date(Date.now() + 3600000), revokedAt: null };
function matches(row:Record<string,unknown>,filter:object):boolean{
 return Object.entries(filter).every(([key,value]:[string,unknown])=>{
  if(key==="patient")return true;
  if(key==="OR")return Array.isArray(value)&&value.some((child:unknown)=>!!child&&typeof child==="object"&&matches(row,child));
  if(value&&typeof value==="object"&&"in" in value)return Array.isArray(value.in)&&value.in.includes(row[key]);
  return row[key]===value;
 });
}
beforeAll(async () => { visibility = await import('@/lib/record-visibility'); });
beforeEach(() => { jest.resetAllMocks(); memberships.mockResolvedValue([]); grants.mockResolvedValue([]); patient.mockResolvedValue({ id: 'p', userId: 'patient-user', createdByDoctorId: 'a', createdByFacilityId: null }); });
it('F04 author retains own records and never sees new-provider records', async () => {
  const access = await visibility.getRecordVisibility(doctor('a'), 'p');
  expect(matches({ patientId: 'p', authoredByDoctorId: 'a', isPrivate: true }, access.where('NOTES'))).toBe(true);
  expect(matches({ patientId: 'p', authoredByDoctorId: 'b', isPrivate: false }, access.where('NOTES'))).toBe(false);
});
it('F04 approval is scoped to the source and does not move or reveal unrelated records', async () => {
  grants.mockResolvedValue([approved]); const access = await visibility.getRecordVisibility(doctor('b'), 'p');
  expect(access.where('NOTES').OR).toContainEqual(expect.objectContaining({ patient: { is: { recordAccessGrants: { some: expect.objectContaining({ id: 'g', status: 'APPROVED', revokedAt: null }) } } } }));
  expect(matches({ patientId: 'p', authoredByDoctorId: 'a', isPrivate: false }, access.where('NOTES'))).toBe(true);
  expect(matches({ patientId: 'p', authoredByDoctorId: 'a', isPrivate: true }, access.where('NOTES'))).toBe(false);
  expect(matches({ patientId: 'p', authoredByDoctorId: 'c', isPrivate: false }, access.where('NOTES'))).toBe(false);
  expect(matches({ patientId: 'p', authoredByDoctorId: 'a' }, access.where('VITALS'))).toBe(false);
  expect(matches({ patientId: 'p', authoredByDoctorId: 'a', isSharedWithDoctor: false }, access.where('PRESCRIPTIONS'))).toBe(false);
});
it.each([
  { status: 'PENDING' }, { status: 'DENIED' }, { status: 'REVOKED' }, { revokedAt: new Date() },
  { expiresAt: new Date(Date.now() - 1) }, { requesterDoctorId: 'other' },
  { sourceDoctorId: null, sourceFacilityId: null, sourceUserId: null },
  { sourceUserId: 'another-patient-owner' },
])('F04 inactive/out-of-scope grant cannot expose records %j', async patch => {
  grants.mockResolvedValue([{ ...approved, ...patch }]); const access = await visibility.getRecordVisibility(doctor('b'), 'p');
  expect(matches({ patientId: 'p', authoredByDoctorId: 'a', isPrivate: false }, access.where('NOTES'))).toBe(false);
});
it('F04 patients are restricted to their own patient ID', async () => {
  await expect(visibility.getRecordVisibility({ id: 'patient-user', role: 'PATIENT', isActive: true, patient: { id: 'other' } }, 'p')).rejects.toThrow();
});
it('F04 facilities grant only active members access and every clinician read is logged', async () => {
  memberships.mockResolvedValue([{ facilityId: 'facility', isActive: true, facility: { isActive: true } }]);
  grants.mockResolvedValue([{ ...approved, requesterDoctorId: null, requesterFacilityId: 'facility' }]);
  const access = await visibility.getRecordVisibility(doctor('b'), 'p');
  expect(matches({ patientId: 'p', authoredByDoctorId: 'a', isPrivate: false }, access.where('NOTES'))).toBe(true);
  await access.log('NOTES', [{ id: 'note', authoredByDoctorId: 'a' }]);
  expect(log).toHaveBeenCalledWith({ data: [expect.objectContaining({ patientId: 'p', viewerUserId: 'user-b', viewerDoctorId: 'b', recordType: 'NOTES', recordId: 'note' })] });
});
it('F04 private notes remain author-only inside a facility while the patient retains their own record view', async () => {
  memberships.mockResolvedValue([{ facilityId: 'facility', isActive: true, facility: { isActive: true } }]);
  const access = await visibility.getRecordVisibility(doctor('b'), 'p');
  expect(matches({ patientId: 'p', authoredByDoctorId: 'a', authoredByFacilityId: 'facility', isPrivate: true }, access.where('NOTES'))).toBe(false);
  const own = await visibility.getRecordVisibility({ id: 'patient-user', role: 'PATIENT', isActive: true, patient: { id: 'p' } }, 'p');
  expect(matches({ patientId: 'p', isPrivate: true }, own.where('NOTES'))).toBe(true);
});
