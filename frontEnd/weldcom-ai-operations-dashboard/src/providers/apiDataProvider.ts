import { getDashboardOverview } from '../services/dashboardService';
import { getMachineDetail } from '../services/machineDetailService';
import { getAIModelMonitorOverview } from '../services/aiModelMonitorService';
import { loadAlerts, loadDataQuality, loadEnergyConsistency, loadExplanation, loadMachineDetail, loadMachines, loadModelMonitor, loadRiskAnalytics } from '../services/runtimeApi';
import type { DataProvider } from './types';
import { adaptApiMachineDetail } from '../mappers/machineDetailMapper';
import { adaptApiModelMonitor } from '../mappers/modelMonitorMapper';
import { mapHybridModelMonitor } from '../mappers/hybridModelMonitorMapper';

export const apiDataProvider: DataProvider = {
  kind: 'api',
  dashboard: (filters, signal) => getDashboardOverview({
    datasetMode: filters.datasetMode,
    dateFrom: filters.from,
    dateTo: filters.to,
    rangePreset: filters.rangePreset,
  }, signal),
  machines: loadMachines,
  alerts: loadAlerts,
  machineDetail: loadMachineDetail,
  machineDetailDto: async (machine, filters, signal) => adaptApiMachineDetail(await loadMachineDetail(machine.machineId, filters, signal), machine),
  explanation: loadExplanation,
  legacyMachineDetail: (machineId) => {
    if (!machineId) return Promise.reject(new Error('machineId is required for API machine detail'));
    return getMachineDetail({ machineId });
  },
  modelMonitor: loadModelMonitor,
  modelMonitorDto: async (filters, signal) => {
    const runtimeMonitor = (await loadModelMonitor(filters, signal)).data;
    return mapHybridModelMonitor(adaptApiModelMonitor(runtimeMonitor), 'api');
  },
  riskAnalytics: loadRiskAnalytics,
  dataQuality: loadDataQuality,
  energyConsistency: loadEnergyConsistency,
  legacyModelMonitor: () => getAIModelMonitorOverview(),
};
