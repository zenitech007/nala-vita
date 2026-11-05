import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EmailProofForm from '@/components/auth/EmailProofForm';
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
it('F01 keeps claim entries after failure and reports success only after confirmation', async () => {
  const fetchMock = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ challengeId: '11111111-1111-4111-8111-111111111111', message: 'If eligible, a code will be sent.' }) })
    .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Code expired. Request a new code.' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Your record has been claimed.' }) });
  global.fetch = fetchMock;
  render(<EmailProofForm mode="claim" />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'synthetic@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send email code' }));
  fireEvent.change(await screen.findByLabelText('Six-digit email code'), { target: { value: '123456' } });
  fireEvent.change(screen.getByLabelText('Create a password'), { target: { value: 'Synthetic-password-123!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify and claim record' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Code expired');
  expect(screen.getByLabelText('Six-digit email code')).toHaveValue('123456');
  expect(screen.getByLabelText('Create a password')).toHaveValue('Synthetic-password-123!');
  fireEvent.click(screen.getByRole('button', { name: 'Verify and claim record' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Your record has been claimed.'));
  expect(screen.queryByLabelText('Create a password')).not.toBeInTheDocument();
});
