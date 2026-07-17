import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { MetricCard } from './components/MetricCard';
import { AlertsTable } from './components/AlertsTable';
import { DataQualityOverviewCard, OperationalRiskChart, QualityIssueTrend, RiskDistributionChart, StatusDonut, TopMachinesChart } from './components/Charts';
import { loadDashboard } from './services/dashboardApi';
import type { DashboardPayload } from './types/dashboard';
import { dashboardMock } from './data/mockDashboard';

export default function App() {
  const [data, setData] = useState<DashboardPayload>(dashboardMock);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadDashboard().then((payload) => {
      if (mounted) setData(payload);
    }).catch(() => {
      if (mounted) setData(dashboardMock);
    }).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  return (
    <div className="dashboard-shell">
      <Sidebar />
      <main className="main-content">
        <TopBar />
        {loading ? <div className="mb-3 text-sm text-slate-400">Loading dashboard intelligence...</div> : null}

        <section className="grid grid-cols-5 gap-4">
          {data.metrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}
        </section>

        <section className="mt-4 grid grid-cols-[1.02fr_1.35fr_1.18fr] gap-4">
          <RiskDistributionChart data={data.riskDistribution} />
          <OperationalRiskChart data={data.operationalRiskTrend} />
          <TopMachinesChart data={data.topMachines} />
        </section>

        <section className="mt-4 grid grid-cols-[.92fr_.92fr_1.12fr_.98fr] gap-4">
          <StatusDonut title="L1 Anomaly Status" value="96%" summary={data.l1Status} color="#00e889" />
          <StatusDonut title="L2 Fault Confidence" value="87%" summary={data.l2Confidence} color="#1677ff" />
          <QualityIssueTrend data={data.qualityIssueTrend} />
          <DataQualityOverviewCard data={data.dataQuality} />
        </section>

        <section className="mt-4 pb-2">
          <AlertsTable alerts={data.liveAlerts} />
        </section>
      </main>
    </div>
  );
}
