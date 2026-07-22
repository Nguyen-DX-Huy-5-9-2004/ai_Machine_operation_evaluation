import { mockDashboardData } from '../data/mockDashboardData';
import { mockMachineDetail } from '../data/mockMachineDetail';
import { mockAIModelMonitor } from '../data/mockAIModelMonitor';
import type { ApiEnvelope, MachineSummary, ModelMonitor } from '../types/runtimeApi';
import type { DataProvider } from './types';
import { mockDataQualityCenter, mockEnergyConsistency, mockRiskFaultAnalytics } from '../data/mockOperationsPages';
import { buildMockHybridModelMonitor } from '../mappers/hybridModelMonitorMapper';

const meta = { dataMode: 'mock' as const, datasetMode: 'historical' as const, source: 'LOCAL_FIXTURE_DATA', generatedAt: mockDashboardData.lastUpdated, timezone: 'Asia/Ho_Chi_Minh', isMock: true, policyVersion: null, l2RunId: null, lineageHash: null, latestRuntimeRunId: null, dataFreshnessSeconds: null, requestId: 'mock-demo' };
const machines: MachineSummary[] = mockDashboardData.topMachines.map((row, index) => ({ machineId: index + 1, displayCode: row.machineId, latestEventTime: mockDashboardData.lastUpdated, currentRisk: row.riskScore, currentAction: row.operationalActionLevel.toUpperCase() as MachineSummary['currentAction'], faultRisk30min: row.riskScore, maintenanceRisk: row.maintenanceRisk, dataQuality: String(row.dataQualityIssueScore), readiness: 'READY', source: 'LOCAL_FIXTURE_DATA' }));

export const mockDataProvider: DataProvider = {
  kind: 'mock',
  dashboard: async () => ({ ...mockDashboardData, meta }),
  machines: async (_filters, page = 1) => ({ data: { items: machines, page, pageSize: 50, total: machines.length }, meta }),
  alerts: async (_filters, page = 1, pageSize = 50) => ({ data: { items: mockDashboardData.operationalAlerts as unknown as Record<string, unknown>[], page, pageSize, total: mockDashboardData.operationalAlerts.length }, meta }),
  machineDetail: async () => ({ meta, summary: { displayCode: mockMachineDetail.machine.machineId, machineName: mockMachineDetail.machine.machineName, operational_action_level: mockMachineDetail.finalReason.actionLevel, operational_overall_risk_score: (mockMachineDetail.finalReason.confidencePct ?? 0) / 100, event_start_time: mockMachineDetail.machine.lastUpdated, readiness_reason: 'READY', event_uid: 'MOCK:1' }, timeline: mockMachineDetail.recentEvents, l1: mockMachineDetail.l1Series, l2: mockMachineDetail.riskSeries, energy: mockMachineDetail.energySummary, analysis: {}, performance: mockMachineDetail.performanceSummary, events: mockMachineDetail.recentEvents }),
  machineDetailDto: async () => mockMachineDetail,
  explanation: async () => ({ data: { availability: true, methodology: 'Local fixture explanation', decisionContributions: [] }, meta }),
  legacyMachineDetail: async () => mockMachineDetail,
  modelMonitor: async () => ({ data: { runtimeStatus: 'MOCK DEMO', runtimeEnvironmentStatus: 'Local Fixture Data', artifactIntegrity: 'Not applicable', l1Candidates: { selected: 'Candidate A demo fixture' }, l2Targets: mockAIModelMonitor.l2Targets as unknown as Array<Record<string, unknown>>, scoringFunnel: mockAIModelMonitor.scoringFunnel as unknown as Array<Record<string, unknown>>, nextScheduledRetrain: null } as ModelMonitor, meta } as ApiEnvelope<ModelMonitor>),
  modelMonitorDto: async () => buildMockHybridModelMonitor(mockAIModelMonitor),
  riskAnalytics: async () => mockRiskFaultAnalytics,
  dataQuality: async () => mockDataQualityCenter,
  energyConsistency: async () => mockEnergyConsistency,
  legacyModelMonitor: async () => mockAIModelMonitor,
};
