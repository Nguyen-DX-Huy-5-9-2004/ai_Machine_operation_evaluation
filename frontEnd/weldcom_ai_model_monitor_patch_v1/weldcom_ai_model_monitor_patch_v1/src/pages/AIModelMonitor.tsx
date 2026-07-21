import { useCallback, useEffect, useState } from 'react';
import { FileWarning } from 'lucide-react';
import { DataContractPanel } from '../components/aiModelMonitor/DataContractPanel';
import { DecisionFlowPanel } from '../components/aiModelMonitor/DecisionFlowPanel';
import { DecisionTracePanel } from '../components/aiModelMonitor/DecisionTracePanel';
import { L2PredictionTrendPanel } from '../components/aiModelMonitor/L2PredictionTrendPanel';
import { L1PerformancePanel, L2PerformancePanel } from '../components/aiModelMonitor/ModelPerformancePanels';
import { MonitorHeader } from '../components/aiModelMonitor/MonitorHeader';
import { MonitorKpiCard } from '../components/aiModelMonitor/MonitorKpiCard';
import { RuntimeStatusStrip } from '../components/aiModelMonitor/RuntimeStatusStrip';
import { ScoringFunnelPanel } from '../components/aiModelMonitor/ScoringFunnelPanel';
import { mockAIModelMonitor } from '../data/mockAIModelMonitor';
import { getAIModelMonitorOverview } from '../services/aiModelMonitorService';
import type { AIModelMonitorPayload, MonitorFilterState } from '../types/aiModelMonitor';
import '../styles/ai-model-monitor.css';

export default function AIModelMonitor() {
  const [data, setData] = useState<AIModelMonitorPayload>(mockAIModelMonitor);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MonitorFilterState>({
    dateRange: mockAIModelMonitor.filters.dateRanges[0],
    modelVersion: mockAIModelMonitor.filters.modelVersions[0],
    runScope: mockAIModelMonitor.filters.runScopes[0],
  });

  const load = useCallback(async () => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const payload = await getAIModelMonitorOverview(filters, controller.signal);
      setData(payload);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setData(mockAIModelMonitor);
      setError(reason instanceof Error ? reason.message : 'Unable to load AI Model Monitor data.');
    } finally {
      setLoading(false);
    }
    return () => controller.abort();
  }, [filters]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="amm-page">
      <MonitorHeader
        filters={filters}
        options={data.filters}
        loading={loading}
        dataMode={data.mode}
        onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
        onRefresh={() => void load()}
      />

      {error ? <div className="amm-fallback-banner"><FileWarning size={16} /><span>API unavailable; showing mock data. {error}</span></div> : null}

      <section className="amm-kpi-grid" aria-label="AI monitor key metrics">
        {data.kpis.map((item) => <MonitorKpiCard key={item.id} item={item} />)}
      </section>

      <section className="amm-grid amm-grid--performance">
        <L1PerformancePanel data={data.l1Candidates} />
        <L2PerformancePanel data={data.l2Targets} />
      </section>

      <section className="amm-grid amm-grid--trend-funnel">
        <L2PredictionTrendPanel data={data.l2Trend} />
        <ScoringFunnelPanel stages={data.scoringFunnel} notScoredEvents={data.notScoredEvents} />
      </section>

      <section className="amm-grid amm-grid--flow-contract">
        <DecisionFlowPanel stages={data.decisionFlow} />
        <DataContractPanel checks={data.contractChecks} />
      </section>

      <DecisionTracePanel trace={data.exampleTrace} />

      <RuntimeStatusStrip items={data.runtimeStrip} />
    </div>
  );
}
