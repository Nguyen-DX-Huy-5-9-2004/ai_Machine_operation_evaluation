import { useEffect, useState } from 'react';
import type { RuntimeFilters } from '../types/runtimeFilters';
import { dataProvider } from '@data-provider';
import { ErrorPanel, LoadingPanel, formatRisk } from './RuntimeMachinesPage';

export function RuntimeAlertsPage({ filters }: { filters: RuntimeFilters }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(null);
    dataProvider.alerts(filters, 1, 50, controller.signal).then((result) => setRows(result.data.items)).catch((reason: Error) => { if (reason.name !== 'AbortError') setError(reason.message); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [filters, nonce]);
  if (loading) return <LoadingPanel label="Loading operational alerts..." />;
  if (error) return <ErrorPanel message={error} onRetry={() => setNonce((value) => value + 1)} />;
  return <section className="glass-panel overflow-x-auto p-5"><div className="panel-title mb-4">Operational Events</div>{rows.length === 0 ? <div className="p-8 text-center text-slate-400">No HIGH or CRITICAL policy-ready alerts.</div> : <table className="data-table"><thead><tr><th>Event</th><th>Machine</th><th>Time</th><th>Action</th><th>Fault 30min</th><th>Quality</th><th>Reason</th></tr></thead><tbody>{rows.map((row) => <tr key={String(row.eventUid)}><td>{String(row.eventUid)}</td><td>{String(row.displayCode ?? row.machineId)}</td><td>{String(row.eventTime)}</td><td>{String(row.operationalActionLevel)}</td><td>{formatRisk(Number(row.faultRisk30min))}</td><td>{String(row.qualityActionLevel)}</td><td>{String(row.finalReason ?? '')}</td></tr>)}</tbody></table>}</section>;
}
