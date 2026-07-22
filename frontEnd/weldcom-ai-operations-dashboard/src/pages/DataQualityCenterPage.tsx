import { useEffect, useState } from 'react';
import { dataProvider } from '@data-provider';
import type { DataQualityCenterOverview } from '../types/operationsPages';
import type { RuntimeFilters } from '../types/runtimeFilters';
import { ErrorPanel, LoadingPanel } from './RuntimeMachinesPage';

const show = (value: unknown) => value == null ? 'Not available' : typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 3 }) : String(value);
export function DataQualityCenterPage({ filters = { datasetMode: 'historical' } }: { filters?: RuntimeFilters }) {
  const [data, setData] = useState<DataQualityCenterOverview | null>(null); const [error, setError] = useState<string | null>(null); const [nonce, setNonce] = useState(0);
  useEffect(() => { const c = new AbortController(); dataProvider.dataQuality(filters, c.signal).then(setData).catch((e: Error) => { if (e.name !== 'AbortError') setError(e.message); }); return () => c.abort(); }, [filters, nonce]);
  if (error) return <ErrorPanel message={error} onRetry={() => setNonce((v) => v + 1)} />; if (!data) return <LoadingPanel label="Đang tải dữ liệu SQL..." />;
  return <section className="space-y-4"><div className="glass-panel p-5"><div className="panel-title">Data Quality Center</div><p className="mt-1 text-sm text-slate-400">Quality evidence is separate from machine fault and operational action.</p><div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{Object.entries(data.overview ?? {}).filter(([,value]) => typeof value !== 'boolean').map(([key,value]) => <article key={key} className="rounded border border-blue-200/15 p-4"><div className="text-xs text-slate-400">{key}</div><strong>{show(value)}</strong></article>)}</div></div><div className="glass-panel overflow-x-auto p-5"><table className="data-table"><thead><tr><th>Time</th><th>Time-quality issues</th><th>KWh-quality issues</th><th>Energy inconsistency</th></tr></thead><tbody>{data.issueTrend.map((row) => <tr key={row.label}><td>{row.label}</td><td>{row.time_quality_issue_flag}</td><td>{row.kwh_quality_issue_flag}</td><td>{row.energy_inconsistency_flag}</td></tr>)}</tbody></table></div></section>;
}
