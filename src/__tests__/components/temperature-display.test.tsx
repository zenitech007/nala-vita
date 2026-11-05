import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PatientVitalsPage from '@/app/(patient)/patient/vitals/page';
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  LineChart: ({ data }: { data: unknown }) => <div data-testid="temperature-chart">{JSON.stringify(data)}</div>,
  Line: () => null, XAxis: () => null, YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null, ReferenceLine: () => null,
}));
const originalFetch = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ vitals: [{ id: 'v', temperature: 37,
    temperatureUnit: 'C', recordedAt: '2030-01-01T00:00:00Z' }] }) })) as unknown as typeof fetch;
});
afterEach(() => { global.fetch = originalFetch; });
it('F21 displays stored Celsius as Fahrenheit in the card/chart and submits an explicit input unit', async () => {
  render(<PatientVitalsPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Temperature 98.6/ }));
  expect(screen.getByTestId('temperature-chart')).toHaveTextContent('"value":98.6');
  expect(screen.getByText('Latest: 98.6 °F')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Record Vital/ }));
  fireEvent.change(screen.getByPlaceholderText('98.6'), { target: { value: '98.6' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Reading' }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/vitals', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ source: 'manual', temperature: 98.6, temperatureUnit: 'F' }),
  })));
});
