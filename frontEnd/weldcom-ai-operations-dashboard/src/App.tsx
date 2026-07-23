import { useEffect, useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import type { RuntimeFilters } from './types/runtimeFilters';
import type { DashboardPayload, DatasetMode } from './types/dashboard';
import { DashboardPage, ReplayDashboardBootstrap } from './pages/DashboardPage';
import { RuntimeMachinesPage, ErrorPanel, LoadingPanel } from './pages/RuntimeMachinesPage';
import { RuntimeMachineDetailWorkspace } from './pages/RuntimeMachineDetailWorkspace';
import { RuntimeAlertsPage } from './pages/RuntimeAlertsPage';
import MachineDetail from './pages/MachineDetail';
import AIModelMonitor from './pages/AIModelMonitor';
import { DataQualityCenterPage, EnergyConsistencyPage, RiskFaultAnalyticsPage } from './pages';
import type { AppPage } from './components/Sidebar';
import { runtimeConfig } from './config/runtimeConfig';
import { dataProvider } from '@data-provider';
import { AppLanguageContext, type AppLanguage } from './i18n/appTranslations';
import type { ModelMonitorDto } from './types/aiModelMonitor';
import { apiGet } from './services/runtimeApi';
import type { ModelMonitor } from './types/runtimeApi';

const DEFAULT_DATASET_MODE = runtimeConfig.defaultDatasetMode as DatasetMode;
const pagePaths: Record<AppPage, string> = {
  dashboard: '/', 'control-room': '/control-room', machines: '/machines', 'machine-detail': '/machine-detail', alerts: '/events',
  'risk-analytics': '/ai-analysis', 'data-quality': '/performance', 'energy-consistency': '/energy', 'ai-model-monitor': '/ai-model-monitor',
};

function pageFromPath(): AppPage {
  const path = window.location.pathname;
  if (/^\/machines\/\d+$/.test(path)) return 'machine-detail';
  return (Object.entries(pagePaths).find(([, value]) => value !== '/' && path.startsWith(value))?.[0] as AppPage | undefined) ?? 'dashboard';
}

export default function App() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [selectedMachine, setSelectedMachine] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>(() => window.localStorage.getItem('weldcom-language') === 'vi' ? 'vi' : 'en');
  const [activePage, setActivePage] = useState<AppPage>(pageFromPath);
  const [modelMonitorStatus, setModelMonitorStatus] = useState<{ data: Pick<ModelMonitorDto, 'systemStatus'> | null; loading: boolean; error: string | null }>({ data: null, loading: false, error: null });
  const [filters, setFilters] = useState<RuntimeFilters>({ datasetMode: DEFAULT_DATASET_MODE, rangePreset: 'Last 30 Days', riskGranularity: 'hour', qualityRangePreset: 'Last 7 Days' });

  useEffect(() => {
    if (activePage !== 'dashboard' && activePage !== 'control-room') {
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController(); setLoading(true); setError(null);
    dataProvider.dashboard(filters, controller.signal).then(setData)
      .catch((reason: Error) => { if (reason.name !== 'AbortError') { setError(reason.message); setData(null); } })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [activePage, filters, nonce]);
  useEffect(() => {
    if (runtimeConfig.isMockMode) {
      setModelMonitorStatus({ data: { systemStatus: { mode: 'mock', requiredDataLoaded: true } }, loading: false, error: null });
      return undefined;
    }
    const controller = new AbortController();
    setModelMonitorStatus((current) => ({ ...current, loading: true, error: null }));
    // Sidebar status must remain accurate on every route, but loading the full
    // Monitor payload here made Machine Detail compete with nine unrelated API
    // calls. The lightweight overview carries only runtime readiness.
    apiGet<ModelMonitor>(`/model-monitor/overview?datasetMode=${filters.datasetMode}`, controller.signal)
      .then(({ data: runtime }) => setModelMonitorStatus({
        data: {
          systemStatus: {
            mode: 'api',
            runtimeStatus: runtime.runtimeStatus,
            runtimeEnvironmentStatus: runtime.runtimeEnvironmentStatus,
            artifactIntegrity: runtime.artifactIntegrity,
            requiredDataLoaded: Boolean(runtime.runtimeStatus && runtime.runtimeEnvironmentStatus && runtime.artifactIntegrity),
          },
        },
        loading: false,
        error: null,
      }))
      .catch((reason: Error) => {
        if (reason.name !== 'AbortError') setModelMonitorStatus({ data: null, loading: false, error: reason.message });
      });
    return () => controller.abort();
  }, [filters]);
  useEffect(() => { window.localStorage.setItem('weldcom-language', language); }, [language]);

  const navigate = (page: AppPage) => {
    setActivePage(page); setSelectedMachine(null);
    window.history.pushState({}, '', pagePaths[page]);
  };
  const openMachineDetail = (machineId: number) => {
    setSelectedMachine(machineId);
    setActivePage('machine-detail');
    window.history.pushState({}, '', `/machine-detail?machineId=${machineId}`);
  };
  const plantStatus = data?.plantStatus ?? { plantName: 'Weldcom Operations', status: 'Offline' as const, activeMachines: 0, totalMachines: 0, dataPipeline: 'Offline' as const };
  const lastUpdated = data?.lastUpdated ?? new Date(0).toISOString();
  let content;
  if (selectedMachine != null) content = runtimeConfig.isMockMode ? <MachineDetail /> : <RuntimeMachineDetailWorkspace filters={filters} onBack={() => { setSelectedMachine(null); navigate('machines'); }} />;
  else if (activePage === 'machine-detail' && runtimeConfig.isMockMode) content = <MachineDetail />;
  else if (activePage === 'machine-detail') content = <RuntimeMachineDetailWorkspace filters={filters} onBack={() => navigate('machines')} />;
  else if (activePage === 'machines') content = <RuntimeMachinesPage filters={filters} onSelect={openMachineDetail} />;
  else if (activePage === 'alerts') content = <RuntimeAlertsPage filters={filters} />;
  else if (activePage === 'ai-model-monitor') content = <AIModelMonitor runtimeFilters={filters} onStatusChange={setModelMonitorStatus} />;
  else if (activePage === 'risk-analytics') content = <RiskFaultAnalyticsPage filters={filters} />;
  else if (activePage === 'data-quality') content = <DataQualityCenterPage filters={filters} />;
  else if (activePage === 'energy-consistency') content = <EnergyConsistencyPage filters={filters} />;
  else if (!data && runtimeConfig.isApiMode) content = <ReplayDashboardBootstrap />;
  else if (loading && !data) content = <LoadingPanel label="Loading operational data from SQL API..." />;
  else if (error) content = <ErrorPanel message={error} onRetry={() => setNonce((value) => value + 1)} />;
  else content = data ? <DashboardPage data={data} loading={loading} rangePreset={filters.rangePreset} onRangePresetChange={(rangePreset) => setFilters((current) => ({ ...current, rangePreset }))} riskGranularity={filters.riskGranularity ?? 'hour'} onRiskGranularityChange={(riskGranularity) => setFilters((current) => ({ ...current, riskGranularity }))} qualityRangePreset={filters.qualityRangePreset ?? 'Last 7 Days'} onQualityRangePresetChange={(qualityRangePreset) => setFilters((current) => ({ ...current, qualityRangePreset }))} onMachineSelect={openMachineDetail} /> : <ErrorPanel message="No API data available." onRetry={() => setNonce((value) => value + 1)} />;

  return <AppLanguageContext.Provider value={language}>
    <div className={['dashboard-shell', sidebarCollapsed ? 'sidebar-collapsed' : ''].join(' ')}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} activePage={activePage} onNavigate={navigate} plantStatus={plantStatus} lastUpdated={lastUpdated} language={language} onLanguageChange={setLanguage} modelMonitor={modelMonitorStatus} />
      <main className="main-content">{content}</main>
    </div>
  </AppLanguageContext.Provider>;
}
