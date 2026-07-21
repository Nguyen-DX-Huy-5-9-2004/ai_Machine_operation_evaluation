import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('frontend production integration contract', () => {
  it('uses API by default and has no App-level mock fallback', () => {
    const app = readFileSync(resolve('src/App.tsx'), 'utf8');
    const api = readFileSync(resolve('src/services/runtimeApi.ts'), 'utf8');
    expect(api).toContain("VITE_DATA_MODE ?? 'api'");
    expect(app).not.toContain('mockDashboardData');
    expect(api).toContain("payload.meta.isMock");
  });

  it('does not expose MONITOR as an operational action', () => {
    const types = readFileSync(resolve('src/types/runtimeApi.ts'), 'utf8');
    expect(types).not.toMatch(/['\"]MONITOR['\"]/);
    expect(types).toContain("'LOW'");
    expect(types).toContain("'CRITICAL'");
  });

  it('routes every operational screen through real API-backed views', () => {
    const app = readFileSync(resolve('src/App.tsx'), 'utf8');
    expect(app).toContain('RuntimeMachinesPage');
    expect(app).toContain('RuntimeMachineDetailPage');
    expect(app).toContain('RuntimeAlertsPage');
    expect(app).toContain('RuntimeModelMonitorPage');
  });
});
