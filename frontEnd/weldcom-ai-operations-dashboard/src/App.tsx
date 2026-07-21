import { useEffect, useMemo, useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { getDashboardOverview } from './services/dashboardService';
import type { RuntimeFilters } from './services/runtimeApi';
import type { DashboardPayload, DatasetMode } from './types/dashboard';
import { DashboardPage } from './pages/DashboardPage';
import { RuntimeMachinesPage, ErrorPanel, LoadingPanel } from './pages/RuntimeMachinesPage';
import { RuntimeMachineDetailPage } from './pages/RuntimeMachineDetailPage';
import { RuntimeAlertsPage } from './pages/RuntimeAlertsPage';
import { RuntimeModelMonitorPage } from './pages/RuntimeModelMonitorPage';
import { DataQualityCenterPage, EnergyConsistencyPage, RiskFaultAnalyticsPage } from './pages';
import type { AppPage } from './components/Sidebar';
import { AppLanguageContext, type AppLanguage } from './i18n/appTranslations';

const DEFAULT_DATASET_MODE = (import.meta.env.VITE_DEFAULT_DATASET_MODE ?? 'current') as DatasetMode;
const pagePaths: Record<AppPage, string> = {
  dashboard: '/', machines: '/machines', 'machine-detail': '/machine-detail', alerts: '/events',
  'risk-analytics': '/ai-analysis', 'data-quality': '/performance', 'energy-consistency': '/energy', 'ai-model-monitor': '/ai-model-monitor',
};

function pageFromPath(): AppPage {
  const path = window.location.pathname;
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
  const filters = useMemo<RuntimeFilters>(() => ({ datasetMode: DEFAULT_DATASET_MODE }), []);

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(null);
    getDashboardOverview({ datasetMode: DEFAULT_DATASET_MODE }, controller.signal).then(setData)
      .catch((reason: Error) => { if (reason.name !== 'AbortError') { setError(reason.message); setData(null); } })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [nonce]);
  useEffect(() => { window.localStorage.setItem('weldcom-language', language); }, [language]);

  const navigate = (page: AppPage) => {
    setActivePage(page); setSelectedMachine(null);
    window.history.pushState({}, '', pagePaths[page]);
  };
  const plantStatus = data?.plantStatus ?? { plantName: 'Weldcom Operations', status: 'Offline' as const, activeMachines: 0, totalMachines: 0, dataPipeline: 'Offline' as const };
  const lastUpdated = data?.lastUpdated ?? new Date(0).toISOString();
  let content;
  if (selectedMachine != null) content = <RuntimeMachineDetailPage machineId={selectedMachine} filters={filters} onBack={() => setSelectedMachine(null)} />;
  else if (activePage === 'machines' || activePage === 'machine-detail') content = <RuntimeMachinesPage filters={filters} onSelect={setSelectedMachine} />;
  else if (activePage === 'alerts') content = <RuntimeAlertsPage filters={filters} />;
  else if (activePage === 'ai-model-monitor') content = <RuntimeModelMonitorPage filters={filters} />;
  else if (activePage === 'risk-analytics') content = <RiskFaultAnalyticsPage />;
  else if (activePage === 'data-quality') content = <DataQualityCenterPage />;
  else if (activePage === 'energy-consistency') content = <EnergyConsistencyPage />;
  else if (loading && !data) content = <LoadingPanel label="Loading operational data from SQL API..." />;
  else if (error) content = <ErrorPanel message={error} onRetry={() => setNonce((value) => value + 1)} />;
  else content = data ? <DashboardPage data={data} loading={loading} /> : <ErrorPanel message="No API data available." onRetry={() => setNonce((value) => value + 1)} />;

  return <AppLanguageContext.Provider value={language}>
    <div className={['dashboard-shell', sidebarCollapsed ? 'sidebar-collapsed' : ''].join(' ')}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} activePage={activePage} onNavigate={navigate} plantStatus={plantStatus} lastUpdated={lastUpdated} language={language} onLanguageChange={setLanguage} />
      <main className="main-content">{content}</main>
    </div>
  </AppLanguageContext.Provider>;
}
