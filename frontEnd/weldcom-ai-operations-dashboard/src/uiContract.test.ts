import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('frontend production integration contract', () => {
  it('uses the central runtime resolver and has no App-level fixture fallback', () => {
    const app = readFileSync(resolve('src/App.tsx'), 'utf8');
    const api = readFileSync(resolve('src/services/runtimeApi.ts'), 'utf8');
    const config = readFileSync(resolve('src/config/runtimeConfig.ts'), 'utf8');
    expect(config).toContain("dataMode !== 'api' && dataMode !== 'mock'");
    expect(api).toContain('runtimeConfig.isApiMode');
    expect(app).not.toContain('mockDashboardData');
    expect(api).toContain("payload.meta.isMock");
  });

  it('does not expose MONITOR as an operational action', () => {
    const types = readFileSync(resolve('src/types/runtimeApi.ts'), 'utf8');
    expect(types).not.toMatch(/['\"]MONITOR['\"]/);
    expect(types).toContain("'LOW'");
    expect(types).toContain("'CRITICAL'");
  });

  it('routes operational screens through provider-backed shared presentations', () => {
    const app = readFileSync(resolve('src/App.tsx'), 'utf8');
    expect(app).toContain('RuntimeMachinesPage');
    expect(app).toContain('RuntimeMachineDetailWorkspace');
    expect(app).toContain('RuntimeAlertsPage');
    expect(app).toContain('AIModelMonitor');
    expect(app).toContain('RiskFaultAnalyticsPage');
    expect(app).toContain('DataQualityCenterPage');
    expect(app).toContain('EnergyConsistencyPage');
  });

  it('keeps Model Monitor evaluation status in the sidebar and out of the content strip', () => {
    const sidebar = readFileSync(resolve('src/components/Sidebar.tsx'), 'utf8');
    const presentation = readFileSync(resolve('src/components/aiModelMonitor/AIModelMonitorPresentation.tsx'), 'utf8');
    const app = readFileSync(resolve('src/App.tsx'), 'utf8');
    expect(sidebar).toContain('monitor-sidebar-status');
    expect(sidebar).toContain('Some AI Monitor charts show historical model-evaluation series');
    expect(presentation).not.toContain('SystemEvaluationStatus');
    expect(app).toContain("apiGet<ModelMonitor>(`/model-monitor/overview?datasetMode=${filters.datasetMode}`");
    expect(app).not.toContain('dataProvider.modelMonitorDto(filters, controller.signal)');
  });

  it('keeps compact KPI cards free of source badges while retaining source-aware monitor panels', () => {
    const kpi = readFileSync(resolve('src/components/aiModelMonitor/MonitorKpiCard.tsx'), 'utf8');
    const mapper = readFileSync(resolve('src/mappers/hybridModelMonitorMapper.ts'), 'utf8');
    expect(kpi).not.toContain('SourceBadge');
    expect(mapper).toContain('valueSource');
    expect(mapper).toContain('trendSource');
  });

  it('reads V3 chart labels from series configuration instead of raw camel-case keys', () => {
    const chart = readFileSync(resolve('src/components/aiModelMonitor/ModelReferenceCharts.tsx'), 'utf8');
    const reference = readFileSync(resolve('src/data/ai-model-monitor-hybrid-demo-v3.json'), 'utf8');
    expect(chart).toContain('seriesConfig');
    expect(reference).toContain('"label": "Lenient - Train"');
    expect(reference).toContain('"label": "Validation - Validated"');
  });
});
