import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { loadExplanation, loadMachineDetail, type RuntimeFilters } from '../services/runtimeApi';
import type { Explanation } from '../types/runtimeApi';
import { ErrorPanel, LoadingPanel, formatRisk } from './RuntimeMachinesPage';

type Tab = 'timeline' | 'analysis' | 'performance' | 'energy' | 'events';

export function RuntimeMachineDetailPage({ machineId, filters, onBack }: { machineId: number; filters: RuntimeFilters; onBack: () => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadMachineDetail>> | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [tab, setTab] = useState<Tab>('timeline');
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError(null); setData(null);
    loadMachineDetail(machineId, filters, controller.signal).then(async (value) => {
      setData(value);
      const uid = String(value.summary.event_uid ?? value.summary.eventUid ?? '');
      if (uid) setExplanation((await loadExplanation(uid, controller.signal)).data);
    }).catch((reason: Error) => { if (reason.name !== 'AbortError') setError(reason.message); });
    return () => controller.abort();
  }, [machineId, filters, nonce]);
  if (error) return <ErrorPanel message={error} onRetry={() => setNonce((value) => value + 1)} />;
  if (!data) return <LoadingPanel label={`Loading Machine ${machineId}...`} />;
  const summary = data.summary;
  const tabs: Tab[] = ['timeline', 'analysis', 'performance', 'energy', 'events'];
  return <div className="space-y-4">
    <button onClick={onBack} className="flex items-center gap-2 text-sm text-blue-300"><ArrowLeft size={16} />Back to machines</button>
    <section className="glass-panel p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><div className="text-2xl font-black">Machine {machineId}</div><div className="mt-1 text-sm text-slate-400">{String(summary.event_source ?? summary.eventSource ?? data.meta.source)}</div></div><div className="grid grid-cols-3 gap-6 text-sm"><Value label="Action" value={String(summary.operational_action_level ?? 'UNREADY')} /><Value label="Risk" value={formatRisk(toNumber(summary.operational_overall_risk_score))} /><Value label="Readiness" value={String(summary.readiness_reason ?? 'Unavailable')} /></div></div></section>
    <div className="flex gap-2 border-b border-blue-200/15">{tabs.map((name) => <button key={name} onClick={() => setTab(name)} className={`px-4 py-3 text-sm font-semibold capitalize ${tab === name ? 'border-b-2 border-blue-400 text-white' : 'text-slate-400'}`}>{name === 'analysis' ? 'AI Analysis' : name}</button>)}</div>
    {tab === 'timeline' ? <EventTable rows={data.timeline} /> : null}
    {tab === 'events' ? <EventTable rows={data.events} /> : null}
    {tab === 'analysis' ? <Analysis explanation={explanation} count={data.l2.length} /> : null}
    {tab === 'performance' ? <ObjectPanel title="Operational Performance" data={data.performance} /> : null}
    {tab === 'energy' ? <ObjectPanel title="Machine-level Event KWh" data={data.energy} /> : null}
  </div>;
}

function Value({ label, value }: { label: string; value: string }) { return <div><div className="text-xs uppercase text-slate-500">{label}</div><div className="mt-1 font-bold text-white">{value}</div></div>; }
function toNumber(value: unknown): number | undefined { const parsed = Number(value); return value == null || !Number.isFinite(parsed) ? undefined : parsed; }
function EventTable({ rows }: { rows: Array<Record<string, unknown>> }) { const columns = rows.length ? Object.keys(rows[0]).slice(0, 9) : []; return <section className="glass-panel overflow-x-auto p-4">{rows.length === 0 ? <div className="p-8 text-center text-slate-400">No events in this range.</div> : <table className="data-table"><thead><tr>{columns.map((column) => <th key={column}>{column.replace(/_/g, ' ')}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.event_uid ?? index)}>{columns.map((column) => <td key={column}>{String(row[column] ?? 'Unavailable')}</td>)}</tr>)}</tbody></table>}</section>; }
function ObjectPanel({ title, data }: { title: string; data: Record<string, unknown> }) { return <section className="glass-panel p-5"><div className="panel-title">{title}</div><div className="mt-4 grid grid-cols-3 gap-4">{Object.entries(data).filter(([key]) => key !== 'series').map(([key, value]) => <Value key={key} label={key} value={String(value ?? 'Unavailable')} />)}</div></section>; }
function Analysis({ explanation, count }: { explanation: Explanation | null; count: number }) { return <div className="grid grid-cols-2 gap-4"><section className="glass-panel p-5"><div className="panel-title">AI Decision Stack</div>{!explanation?.availability ? <div className="mt-4 text-sm text-slate-400">{explanation?.reason ?? 'Explanation unavailable.'}</div> : <div className="mt-3 space-y-2">{explanation.decisionContributions?.map((item) => <div key={item.evidence}><div className="flex justify-between text-xs"><span>{item.evidence}</span><span>{item.percent.toFixed(1)}%</span></div></div>)}</div>}</section><section className="glass-panel p-5"><div className="panel-title">L2 Risk History</div><div className="mt-4 text-sm text-slate-400">{count} selected-model policy result points.</div></section></div>; }
