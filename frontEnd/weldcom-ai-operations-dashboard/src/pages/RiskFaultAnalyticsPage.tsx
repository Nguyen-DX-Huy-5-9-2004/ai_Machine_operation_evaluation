import { useEffect, useState } from 'react';
import { dataProvider } from '@data-provider';
import type { RiskFaultAnalyticsOverview } from '../types/operationsPages';
import type { RuntimeFilters } from '../types/runtimeFilters';
import { ErrorPanel, LoadingPanel } from './RuntimeMachinesPage';

const show = (value: number | null) => value == null ? 'Not available' : `${(value <= 1 ? value * 100 : value).toFixed(2)}%`;
export function RiskFaultAnalyticsPage({ filters = { datasetMode: 'historical' } }: { filters?: RuntimeFilters }) {
  const [data, setData] = useState<RiskFaultAnalyticsOverview | null>(null); const [error, setError] = useState<string | null>(null); const [nonce, setNonce] = useState(0);
  useEffect(() => { const c = new AbortController(); setError(null); dataProvider.riskAnalytics(filters, c.signal).then(setData).catch((e: Error) => { if (e.name !== 'AbortError') setError(e.message); }); return () => c.abort(); }, [filters, nonce]);
  if (error) return <ErrorPanel message={error} onRetry={() => setNonce((v) => v + 1)} />; if (!data) return <LoadingPanel label="Đang tải dữ liệu SQL..." />;
  return <section className="space-y-4"><div className="glass-panel p-5"><div className="panel-title">Risk & Fault Analytics</div><p className="mt-1 text-sm text-slate-400">Stored policy actions and L2 risk outputs. No policy is recalculated in the browser.</p><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">{data.actionDistribution?.map((row) => <article key={row.level} className="rounded border border-blue-200/15 p-4"><div className="text-xs text-slate-400">{row.level}</div><strong className="text-2xl">{row.count.toLocaleString()}</strong></article>)}</div></div><div className="glass-panel overflow-x-auto p-5"><table className="data-table"><thead><tr><th>Machine</th><th>Fault 30 min</th><th>Maintenance 30 events</th><th>Repair 30 events</th></tr></thead><tbody>{data.riskWindows.map((row) => <tr key={row.machine_id}><td>{row.machine_id}</td><td>{show(row.risk_fault_30min)}</td><td>{show(row.risk_maintenance_30_events)}</td><td>{show(row.risk_repair_30_events)}</td></tr>)}</tbody></table></div></section>;
}
