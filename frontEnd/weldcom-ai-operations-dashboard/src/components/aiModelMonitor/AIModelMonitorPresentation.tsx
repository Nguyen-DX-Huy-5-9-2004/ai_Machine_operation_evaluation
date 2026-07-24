import { FileWarning } from 'lucide-react';
import type { AIModelMonitorPayload, MonitorFilterState } from '../../types/aiModelMonitor';
import { DataContractPanel } from './DataContractPanel';
import { DecisionFlowPanel } from './DecisionFlowPanel';
import { DecisionTracePanel } from './DecisionTracePanel';
import { L2PredictionTrendPanel } from './L2PredictionTrendPanel';
import { L1PerformancePanel, L2PerformancePanel } from './ModelPerformancePanels';
import { MonitorHeader } from './MonitorHeader';
import { MonitorKpiCard } from './MonitorKpiCard';
import { RuntimeStatusStrip } from './RuntimeStatusStrip';
import { LatestInferenceAuditPanel } from './LatestInferenceAuditPanel';
import { ScoringFunnelPanel } from './ScoringFunnelPanel';
import { runtimeConfig } from '../../config/runtimeConfig';
import { ModelReferenceCharts } from './ModelReferenceCharts';
import { useUiText } from '../../i18n/appTranslations';

export function AIModelMonitorPresentation({ data, filters, loading, error, onFilterChange, onRefresh }: { data: AIModelMonitorPayload | null; filters: MonitorFilterState; loading: boolean; error: string | null; onFilterChange: (patch: Partial<MonitorFilterState>) => void; onRefresh: () => void }) {
  const t = useUiText();
  if (error) return <div className="amm-page"><div className="amm-fallback-banner"><FileWarning size={16} /><span>{t(runtimeConfig.isMockMode ? 'Unable to load mock demo data.' : 'Unable to load real API data.')} {error}</span><button type="button" onClick={onRefresh}>{t('Retry')}</button></div></div>;
  if (!data) return <div className="amm-page"><div className="amm-fallback-banner">{t(loading ? 'Loading monitor data...' : 'Not available')}</div></div>;
  return <div className="amm-page">
    <MonitorHeader filters={filters} options={data.filters} loading={loading} dataMode={data.mode} onChange={onFilterChange} onRefresh={onRefresh} />
    <section className="amm-kpi-grid" aria-label="AI monitor key metrics">{data.kpis.map((item) => <MonitorKpiCard key={item.id} item={item} />)}</section>
    <section className="amm-grid amm-grid--performance"><L1PerformancePanel data={data.l1Candidates} source={data.panelSources?.l1Performance} /><L2PerformancePanel data={data.l2Targets} source={data.panelSources?.l2Performance} /></section>
    <ModelReferenceCharts charts={data.charts} />
    <section className="amm-grid amm-grid--trend-funnel"><L2PredictionTrendPanel data={data.l2Trend} source={data.panelSources?.predictionRate} /><ScoringFunnelPanel stages={data.scoringFunnel} notScoredEvents={data.notScoredEvents} source={data.panelSources?.scoringFunnel} /></section>
    <section className="amm-grid amm-grid--flow-contract"><DecisionFlowPanel stages={data.decisionFlow} source={data.panelSources?.decisionFlow} /><DataContractPanel checks={data.contractChecks} source={data.panelSources?.featureHealth} /></section>
    <DecisionTracePanel trace={data.exampleTrace} source={data.panelSources?.decisionTrace} /><RuntimeStatusStrip items={data.runtimeStrip} source={data.panelSources?.runtimeStrip} />
    <LatestInferenceAuditPanel audit={data.latestInferenceAudit} source={data.panelSources?.latestAudit} />
  </div>;
}
