import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveRuntimeConfig } from '../config/runtimeConfig';
import { createDataProvider } from './index';

describe('runtime data provider selection', () => {
  it('selects mock explicitly and never calls fetch', async () => {
    const config = resolveRuntimeConfig({ VITE_DATA_MODE: 'mock', VITE_DEFAULT_DATASET_MODE: 'historical' });
    expect(config.isMockMode).toBe(true);
    expect(config.apiBaseUrl).toBe('');
    const provider = createDataProvider(config);
    expect(provider.kind).toBe('mock');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fetch forbidden in mock mode'));
    const filters = { datasetMode: 'historical' as const };
    const [dashboard, machines, detail, monitor, risk, quality, energy] = await Promise.all([
      provider.dashboard(filters), provider.machines(filters), provider.legacyMachineDetail(), provider.modelMonitorDto(filters),
      provider.riskAnalytics(filters), provider.dataQuality(filters), provider.energyConsistency(filters),
    ]);
    expect(dashboard.kpis.length).toBeGreaterThan(0);
    expect(machines.data.items.length).toBeGreaterThan(0);
    expect(detail.timeline.length).toBeGreaterThan(0);
    expect(monitor.kpis.length).toBeGreaterThan(0);
    expect(risk.riskWindows.length).toBeGreaterThan(0);
    expect(quality.issueTrend.length).toBeGreaterThan(0);
    expect(energy.issues.length).toBeGreaterThan(0);
    await provider.machineDetailDto(machines.data.items[0], filters);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('selects api only for explicit api mode', () => {
    const config = resolveRuntimeConfig({ VITE_DATA_MODE: 'api', VITE_API_BASE_URL: 'http://127.0.0.1:8000/api', VITE_DEFAULT_DATASET_MODE: 'historical' });
    expect(config.isApiMode).toBe(true);
    expect(createDataProvider(config).kind).toBe('api');
  });

  it('fails fast for an unknown mode', () => {
    expect(() => resolveRuntimeConfig({ VITE_DATA_MODE: 'demo' })).toThrow(/Expected api or mock/);
  });

  it('keeps provider implementations isolated and removes hard-coded machine selection', () => {
    const api = readFileSync(resolve('src/providers/apiDataProvider.ts'), 'utf8');
    const mock = readFileSync(resolve('src/providers/mockDataProvider.ts'), 'utf8');
    const workspace = readFileSync(resolve('src/pages/RuntimeMachineDetailWorkspace.tsx'), 'utf8');
    expect(api).not.toMatch(/mockDashboard|mockMachine|mockAIModel/);
    expect(mock).not.toMatch(/services\/runtimeApi|apiClient|fetch\(/);
    expect(workspace).toContain('dataProvider.machines');
    expect(workspace).toContain("window.history.replaceState");
    expect(workspace).not.toContain('machineId = 11');
  });

  it('shares Machine Detail and Model Monitor presentation components across modes', () => {
    const machineMockLoader = readFileSync(resolve('src/pages/MachineDetail.tsx'), 'utf8');
    const machineApiLoader = readFileSync(resolve('src/pages/RuntimeMachineDetailWorkspace.tsx'), 'utf8');
    const monitorLoader = readFileSync(resolve('src/pages/AIModelMonitor.tsx'), 'utf8');
    const metrics = readFileSync(resolve('src/components/aiModelMonitor/ModelPerformancePanels.tsx'), 'utf8');
    expect(machineMockLoader).toContain('MachineDetailPresentation');
    expect(machineApiLoader).toContain('MachineDetailPresentation');
    expect(monitorLoader).toContain('AIModelMonitorPresentation');
    expect(monitorLoader).toContain('dataProvider.modelMonitorDto');
    expect(metrics).toContain('Not available');
  });
});
