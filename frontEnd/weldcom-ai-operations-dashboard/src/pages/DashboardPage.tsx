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
import { ReplayLivePanel } from '../components/replay/ReplayLivePanel';
import { useReplayFeed } from '../hooks/useReplayFeed';
import { mergeReplayDashboard } from '../mappers/replayPresentationMapper';
import { useMemo } from 'react';
import { useUiText } from '../i18n/appTranslations';

interface DashboardPageProps {
  data: DashboardPayload;
  loading: boolean;
  onMachineSelect?: (machineId: number) => void;
  rangePreset?: 'Last 24 Hours' | 'Last 7 Days' | 'Last 30 Days' | 'Last 90 Days' | 'Full Historical Range';
  onRangePresetChange?: (value: 'Last 24 Hours' | 'Last 7 Days' | 'Last 30 Days' | 'Last 90 Days' | 'Full Historical Range') => void;
  riskGranularity?: 'day' | 'hour' | 'week';
  onRiskGranularityChange?: (value: 'day' | 'hour' | 'week') => void;
  qualityRangePreset?: 'Last 7 Days' | 'Last 30 Days';
  onQualityRangePresetChange?: (value: 'Last 7 Days' | 'Last 30 Days') => void;
}

export function DashboardPage({ data, loading, onMachineSelect, rangePreset, onRangePresetChange, riskGranularity = 'hour', onRiskGranularityChange, qualityRangePreset = 'Last 7 Days', onQualityRangePresetChange }: DashboardPageProps) {
  const t = useUiText();
  const replay = useReplayFeed();
  const liveData = useMemo(() => mergeReplayDashboard(data, replay.events), [data, replay.events]);
  const datasetMode = liveData.meta?.datasetMode === 'current' ? 'current' : 'historical';
  const isMockDashboard = liveData.meta?.isMock === true || liveData.meta?.dataMode === 'mock';
  return (
    <div className={isMockDashboard ? 'dashboard-page dashboard-page--mock' : 'dashboard-page'}>
      <Header datasetMode={datasetMode} rangePreset={rangePreset} onRangePresetChange={onRangePresetChange} />
      {loading ? <div className="mb-3 text-sm text-slate-400">{t('Loading dashboard intelligence...')}</div> : null}
      <ReplayLivePanel feed={replay} />
      <section className="dashboard-metrics grid gap-4">
        {liveData.kpis.map((metric) => <KpiCard key={metric.id} metric={metric} />)}
      </section>
      <section className="dashboard-row-primary mt-4 grid gap-4">
        <RiskDistribution data={liveData.riskDistribution} compact={isMockDashboard} />
        <OperationalRiskTrend data={liveData.riskTrend} granularity={riskGranularity} onGranularityChange={onRiskGranularityChange} compact={isMockDashboard} />
        <TopRiskMachines data={liveData.topMachines} onSelect={onMachineSelect} compact={isMockDashboard} />
      </section>
      <section className="dashboard-row-secondary mt-4 grid gap-4">
        <L1AnomalyStatus summary={liveData.l1Anomaly} />
        <L2FaultConfidence summary={liveData.l2FaultConfidence} />
        <QualityIssueTrend data={liveData.qualityIssueTrend} range={qualityRangePreset} granularity={riskGranularity} onRangeChange={(value) => onQualityRangePresetChange?.(value)} />
        <DataQualityOverview data={liveData.dataQuality} />
      </section>
      <section className="dashboard-alerts-section pb-2">
        <OperationalAlertsTable alerts={liveData.operationalAlerts} datasetMode={datasetMode} onMachineSelect={onMachineSelect} />
      </section>
    </div>
  );
}

/**
 * The SQL dashboard can take longer than the bounded replay snapshot because
 * it hydrates several operational panels.  During a demo, keep the operator
 * in a useful live context instead of showing a blank loading surface.
 */
export function ReplayDashboardBootstrap() {
  const t = useUiText();
  return (
    <>
      <Header datasetMode="historical" rangePreset="Last 24 Hours" />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
        <span>{t('Preparing the SQL-backed operational overview.')}</span>
        <span className="rounded border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-xs text-cyan-100">{t('Historical replay is file-only')}</span>
      </div>
      <ReplayLivePanel />
    </>
  );
}
