import { describe, expect, it, vi } from 'vitest';
import { apiGet, queryString, riskForDisplay } from './runtimeApi';

describe('real runtime API contract', () => {
  it('keeps dataset source mode explicit', () => {
    const query = new URLSearchParams(queryString({ datasetMode: 'current', machineIds: [11, 12] }));
    expect(query.get('datasetMode')).toBe('current');
    expect(query.getAll('machineIds')).toEqual(['11', '12']);
  });

  it('does not multiply an already percentage-scaled risk twice', () => {
    expect(riskForDisplay(0.42)).toBe(42);
    expect(riskForDisplay(42)).toBe(42);
  });

  it('rejects mock API envelopes instead of silently displaying them', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {}, meta: { dataMode: 'mock', isMock: true } }) }));
    await expect(apiGet('/dashboard/overview')).rejects.toThrow('source contract rejected');
    vi.unstubAllGlobals();
  });

  it('surfaces transport failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('SQL unavailable')));
    await expect(apiGet('/dashboard/overview')).rejects.toThrow('SQL unavailable');
    vi.unstubAllGlobals();
  });
});
