import { Header } from '../components/layout/Header';
import {
  DataQualityOverview,
  KpiCard,
  L1AnomalyStatus,
  L2FaultConfidence,
  OperationalAlertsTable,
  OperationalRiskTrend,
  QualityIssueTrend,
  RiskDistribution,
  TopRiskMachines
} from '../components/dashboard';
import type { DashboardPayload } from '../types/dashboard';

interface DashboardPageProps {
  data: DashboardPayload;
  loading: boolean;
}

export function DashboardPage({ data, loading }: DashboardPageProps) {
  return (
    <>
      <Header />
      {loading ? <div className="mb-3 text-sm text-slate-400">Loading dashboard intelligence...</div> : null}
      <section className="dashboard-metrics grid gap-4">
        {data.kpis.map((metric) => <KpiCard key={metric.id} metric={metric} />)}
      </section>
      <section className="dashboard-row-primary mt-4 grid gap-4">
        <RiskDistribution data={data.riskDistribution} />
        <OperationalRiskTrend data={data.riskTrend} />
        <TopRiskMachines data={data.topMachines} />
      </section>
      <section className="dashboard-row-secondary mt-4 grid gap-4">
        <L1AnomalyStatus summary={data.l1Anomaly} />
        <L2FaultConfidence summary={data.l2FaultConfidence} />
        <QualityIssueTrend data={data.qualityIssueTrend} />
        <DataQualityOverview data={data.dataQuality} />
      </section>
      <section className="dashboard-alerts-section pb-2">
        <OperationalAlertsTable alerts={data.operationalAlerts} />
      </section>
    </>
  );
}
