import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { RuntimeFilters } from '../types/runtimeFilters';
import { dataProvider } from '@data-provider';
import type { ApiMeta } from '../types/dashboard';
import type { Explanation } from '../types/runtimeApi';
import { ErrorPanel, LoadingPanel, formatRisk } from './RuntimeMachinesPage';
import { useUiText } from '../i18n/appTranslations';

type Tab = 'timeline' | 'analysis' | 'performance' | 'energy' | 'events';
type RuntimeMachineDetail = { meta: ApiMeta; summary: Record<string, unknown>; timeline: Array<Record<string, unknown>>; l1: Array<Record<string, unknown>>; l2: Array<Record<string, unknown>>; energy: Record<string, unknown>; analysis: Record<string, unknown>; performance: Record<string, unknown>; events: Array<Record<string, unknown>> };

export function RuntimeMachineDetailPage({ machineId, filters, onBack }: { machineId: number; filters: RuntimeFilters; onBack: () => void }) {
  const t = useUiText();
  const [data, setData] = useState<RuntimeMachineDetail | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [tab, setTab] = useState<Tab>('timeline');
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError(null); setData(null);
    dataProvider.machineDetail(machineId, filters, controller.signal).then(async (rawValue) => {
      const value = rawValue as RuntimeMachineDetail;
      setData(value);
      const uid = String(value.summary.event_uid ?? value.summary.eventUid ?? '');
      if (uid) setExplanation((await dataProvider.explanation(uid, controller.signal)).data);
    }).catch((reason: Error) => { if (reason.name !== 'AbortError') setError(reason.message); });
    return () => controller.abort();
  }, [machineId, filters, nonce]);
  if (error) return <ErrorPanel message={error} onRetry={() => setNonce((value) => value + 1)} />;
  if (!data) return <LoadingPanel label="Loading machine detail..." />;
  const summary = data.summary;
  const tabs: Tab[] = ['timeline', 'analysis', 'performance', 'energy', 'events'];
  const display = String(summary.display_code ?? summary.displayCode ?? summary.machine_name ?? summary.machineName ?? `Machine ${machineId}`);
  const readiness = String(summary.readiness_reason ?? summary.readinessReason ?? 'Unavailable');
  return <div className="space-y-4">
    <button onClick={onBack} className="flex items-center gap-2 text-sm text-blue-300"><ArrowLeft size={16} />{t('Back to machines')}</button>
    <section className="glass-panel p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><div className="text-2xl font-black">{display}</div><div className="mt-1 text-sm text-slate-400">{t(String(data.meta.datasetMode ?? ''))} · {t(String(data.meta.source ?? ''))}</div></div><div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-5"><Value label="Action" value={t(String(summary.operational_action_level ?? 'UNREADY'))} /><Value label="Overall risk" value={t(formatRisk(toNumber(summary.operational_overall_risk_score)))} /><Value label="Latest event" value={t(formatDate(summary.event_start_time))} /><Value label="L1 readiness" value={t(friendlyReadiness(readiness))} title={readiness} /><Value label="Location / group" value={`${summary.location_id ?? '—'} / ${summary.machine_group_id ?? '—'}`} /></div></div></section>
    <div className="flex gap-2 border-b border-blue-200/15">{tabs.map((name) => { const label = name === 'analysis' ? 'AI Analysis' : `${name[0].toUpperCase()}${name.slice(1)}`; return <button key={name} onClick={() => setTab(name)} className={`px-4 py-3 text-sm font-semibold capitalize ${tab === name ? 'border-b-2 border-blue-400 text-white' : 'text-slate-400'}`}>{t(label)}</button>; })}</div>
    {tab === 'timeline' ? <Timeline rows={data.timeline} /> : null}
    {tab === 'events' ? <EventTable rows={data.events} /> : null}
    {tab === 'analysis' ? <Analysis explanation={explanation} count={data.l2.length} /> : null}
    {tab === 'performance' ? <ObjectPanel title="Operational Performance" data={data.performance} /> : null}
    {tab === 'energy' ? <ObjectPanel title="Machine-level Event KWh" data={data.energy} /> : null}
  </div>;
}

function Value({ label, value, title }: { label: string; value: string; title?: string }) { const t = useUiText(); return <div title={title}><div className="text-xs uppercase text-slate-500">{t(label)}</div><div className="mt-1 font-bold text-white">{value}</div></div>; }
function toNumber(value: unknown): number | undefined { const parsed = Number(value); return value == null || !Number.isFinite(parsed) ? undefined : parsed; }
function formatDate(value: unknown) { const date = value ? new Date(String(value)) : null; return date && !Number.isNaN(date.valueOf()) ? date.toLocaleString() : 'Unavailable'; }
function friendlyReadiness(value: string) { return value === 'READY' ? 'Ready' : value === 'HISTORICAL_L1_WINDOW_UNAVAILABLE_L2_RESULT_EXPORTED' ? 'Historical L1 window unavailable; exported L2 result available' : value; }
function badge(value: unknown, t: (value: string) => string) { return <span className="chip">{t(String(value ?? 'UNREADY'))}</span>; }
function Timeline({ rows }: { rows: Array<Record<string, unknown>> }) { const t = useUiText(); return <section className="glass-panel p-5"><div className="panel-title">{t('Operational Timeline')}</div><div className="mt-4 space-y-3">{rows.slice(0, 12).map((row, index) => <div key={String(row.event_uid ?? index)} className="flex items-center justify-between border-b border-blue-200/10 pb-3 text-sm"><div><strong>{t(formatDate(row.event_start_time ?? row.eventTime))}</strong><div className="text-slate-400">{t('Status')} {t(String(row.status_id ?? '—'))} · {String(row.location_id ?? t('Location unavailable'))}</div></div>{badge(row.operational_action_level, t)}</div>)}</div></section>; }
function EventTable({ rows }: { rows: Array<Record<string, unknown>> }) { const t = useUiText(); return <section className="glass-panel overflow-x-auto p-4">{rows.length === 0 ? <div className="p-8 text-center text-slate-400">{t('No data in selected range.')}</div> : <table className="data-table"><thead><tr><th>{t('Event')}</th><th>{t('Time')}</th><th>{t('Status')}</th><th>{t('Duration')}</th><th>{t('Action')}</th><th>{t('Readiness')}</th><th>{t('Reason')}</th></tr></thead><tbody>{rows.map((row, index) => { const reason=String(row.readiness_reason ?? 'Unavailable'); return <tr key={String(row.event_uid ?? index)}><td title={String(row.event_uid ?? '')}><strong>{String(row.event_id ?? '—')}</strong><div className="text-xs text-slate-500">{String(row.event_uid ?? '').slice(0, 28)}</div></td><td>{t(formatDate(row.event_start_time ?? row.eventTime))}</td><td>{t(String(row.status_id ?? '—'))}</td><td>{row.duration_sec == null ? '—' : `${Math.round(Number(row.duration_sec) / 60)} ${t('min')}`}</td><td>{badge(row.operational_action_level, t)}</td><td title={reason}>{t(friendlyReadiness(reason))}</td><td title={String(row.final_reason_v2 ?? '')}>{t(String(row.final_reason_v2 ?? '—').slice(0, 72))}</td></tr>; })}</tbody></table>}</section>; }
function ObjectPanel({ title, data }: { title: string; data: Record<string, unknown> }) { const t = useUiText(); return <section className="glass-panel p-5"><div className="panel-title">{t(title)}</div><div className="mt-4 grid grid-cols-3 gap-4">{Object.entries(data).filter(([key]) => key !== 'series').map(([key, value]) => <Value key={key} label={key} value={t(String(value ?? 'Unavailable'))} />)}</div></section>; }
function Analysis({ explanation, count }: { explanation: Explanation | null; count: number }) { const t = useUiText(); return <div className="grid grid-cols-2 gap-4"><section className="glass-panel p-5"><div className="panel-title">{t('AI Decision Stack')}</div>{!explanation?.availability ? <div className="mt-4 text-sm text-slate-400">{t(explanation?.reason ?? 'Explanation unavailable.')}</div> : <div className="mt-3 space-y-2">{explanation.decisionContributions?.map((item) => <div key={item.evidence}><div className="flex justify-between text-xs"><span>{t(item.evidence)}</span><span>{item.percent.toFixed(1)}%</span></div></div>)}</div>}</section><section className="glass-panel p-5"><div className="panel-title">{t('L2 Risk History')}</div><div className="mt-4 text-sm text-slate-400">{count} {t('selected-model policy result points.')}</div></section></div>; }
