import type {ConsentRow} from "@/components/records/consent-ui";
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PatientRecordAccess from '@/components/records/PatientRecordAccess';
const originalFetch = global.fetch;
const provider = { requesterDoctor: { id: 'new', user: { firstName: 'New', lastName: 'Doctor' } }, sourceDoctor: { id: 'old', user: { firstName: 'Old', lastName: 'Doctor' } } };
let requests:(ConsentRow&{patientId?:string})[],grants:ConsentRow[],failApproval:boolean;
beforeEach(() => {
  failApproval = true; grants = [];
  requests = [{ ...provider, id: 'request', patientId: 'p', scope: ['VITALS', 'NOTES'], effectiveStatus: 'PENDING', expiresAt: '2030-01-01T00:00:00Z' }];
  global.fetch = jest.fn(async (url, init) => {
    const path = String(url);
    const json = (body: unknown, ok = true) => ({ ok, json: async () => body });
    if (path.endsWith('/otp')) return json({ challengeId: '11111111-1111-4111-8111-111111111111', message: 'Code request received.' });
    if (path.endsWith('/approve')) {
      if (failApproval) return json({ error: 'Code could not be verified. Your choices were not saved.' }, false);
      const body = JSON.parse(String(init?.body)); requests = []; grants = [{ ...provider, id: 'grant', effectiveStatus: 'APPROVED', scope: body.scope, expiresAt: '2030-01-01T00:00:00Z' }]; return json({ grant: grants[0] });
    }
    if (path.endsWith('/revoke')) { grants[0].effectiveStatus = 'REVOKED'; return json({ message: 'Future access through this grant stopped. Previously viewed data cannot be recalled.' }); }
    if (path === '/api/record-access') return json({ requests, nextCursor: null });
    if (path === '/api/record-access/grants') return json({ grants });
    if (path === '/api/record-access/sources') return json({ sources: [{ key: 'doctor:old', label: 'Dr. Old Doctor', sourceDoctorId: 'old' }], hasUnclassifiedRecords: false });
    if (path === '/api/record-access/log') return json({ logs: [], nextCursor: null });
    return json({ doctors: [] });
  }) as unknown as typeof fetch;
});
afterEach(() => { global.fetch = originalFetch; });
it('F04 requires code approval for the chosen scope, preserves failure drafts and keeps source records after revocation', async () => {
  render(<PatientRecordAccess />);
  await screen.findByText('Dr. New Doctor requests access');
  expect(screen.queryByRole('button', { name: 'Approve selected access' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Shared clinical notes'));
  fireEvent.change(screen.getByLabelText('Access duration'), { target: { value: '7' } });
  fireEvent.click(screen.getByRole('button', { name: 'Email code to approve' }));
  const code = await screen.findByLabelText('Six-digit email code');
  expect(screen.getByLabelText('Shared clinical notes')).toBeDisabled();
  fireEvent.change(code, { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Approve selected access' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Code could not be verified'); expect(code).toHaveValue('123456');
  expect(global.fetch).toHaveBeenCalledWith('/api/record-access/request/approve', expect.objectContaining({ body: JSON.stringify({ scope: ['VITALS'], durationDays: 7, challengeId: '11111111-1111-4111-8111-111111111111', code: '123456' }) }));
  failApproval = false; fireEvent.click(screen.getByRole('button', { name: 'Approve selected access' }));
  const revoke = await screen.findByRole('button', { name: 'Revoke access' }); fireEvent.click(revoke);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Revoke access' })).not.toBeInTheDocument());
  expect(screen.getByText('Dr. Old Doctor — own authored records')).toBeInTheDocument();
  expect(screen.getByText(/data already viewed or copied cannot be recalled/)).toBeInTheDocument();
});
