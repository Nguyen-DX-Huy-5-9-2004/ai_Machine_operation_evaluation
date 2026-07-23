import { describe, expect, it, vi } from 'vitest';
import { apiGet, loadMachineDetail, queryString, riskForDisplay } from './runtimeApi';

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

  it('builds Machine Detail from bounded series without depending on the slow summary endpoint', async () => {
    const paths: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      paths.push(input);
      const path = new URL(input).pathname;
      const data = path.endsWith('/meta/filters')
        ? { availableDateRange: { from: '2025-10-01T00:00:00Z', to: '2025-10-24T13:00:00Z' } }
        : path.endsWith('/timeline') ? [{ event_uid: 'HISTORICAL_PRODUCTION_SCORE:7', event_start_time: '2025-10-24T12:00:00Z', status_id: 3 }]
          : path.endsWith('/l1-series') ? [{ event_uid: 'HISTORICAL_PRODUCTION_SCORE:7', behavior_anomaly_score: 0.4 }]
            : path.endsWith('/l2-series') ? [{ event_uid: 'HISTORICAL_PRODUCTION_SCORE:7', risk_fault_30min: 0.7, operational_action_level: 'HIGH' }]
              : path.endsWith('/events') ? [{ event_uid: 'HISTORICAL_PRODUCTION_SCORE:7', final_reason_v2: 'Review' }]
                : path.endsWith('/energy') ? { series: [] }
                  : path.endsWith('/performance') ? { eventCount: 1 }
                    : [];
      return { ok: true, json: async () => ({ data, meta: { dataMode: 'sql', isMock: false } }) };
    }));
    const detail = await loadMachineDetail(50, { datasetMode: 'historical', rangePreset: 'Last 24 Hours' });
    expect(paths.some((path) => path.includes('/summary'))).toBe(false);
    expect(detail.summary.event_uid).toBe('HISTORICAL_PRODUCTION_SCORE:7');
    expect(detail.summary.risk_fault_30min).toBe(0.7);
    vi.unstubAllGlobals();
  });
});
