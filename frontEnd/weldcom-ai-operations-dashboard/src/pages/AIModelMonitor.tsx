import { useCallback, useEffect, useState } from 'react';
import { AIModelMonitorPresentation } from '../components/aiModelMonitor/AIModelMonitorPresentation';
import { dataProvider } from '@data-provider';
import type { AIModelMonitorPayload, ModelMonitorDto, MonitorFilterState } from '../types/aiModelMonitor';
import type { RuntimeFilters } from '../types/runtimeFilters';
import '../styles/ai-model-monitor.css';

export default function AIModelMonitor({ runtimeFilters = { datasetMode: 'historical' }, onStatusChange }: { runtimeFilters?: RuntimeFilters; onStatusChange?: (status: { data: ModelMonitorDto | null; loading: boolean; error: string | null }) => void }) {
  const [data, setData] = useState<AIModelMonitorPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MonitorFilterState>({
    dateRange: 'current',
    modelVersion: 'production',
    runScope: 'latest',
  });

  const load = useCallback(async () => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const payload = await dataProvider.modelMonitorDto(runtimeFilters, controller.signal);
      setData(payload);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : 'Unable to load AI Model Monitor data.');
    } finally {
      setLoading(false);
    }
    return () => controller.abort();
  }, [filters, runtimeFilters]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { onStatusChange?.({ data, loading, error }); }, [data, loading, error, onStatusChange]);

  return <AIModelMonitorPresentation data={data} filters={filters} loading={loading} error={error} onFilterChange={(patch) => setFilters((current) => ({ ...current, ...patch }))} onRefresh={() => void load()} />;
}
