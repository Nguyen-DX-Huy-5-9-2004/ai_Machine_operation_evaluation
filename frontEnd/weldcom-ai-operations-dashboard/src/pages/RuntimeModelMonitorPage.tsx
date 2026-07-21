import { useEffect, useState } from 'react';
import { loadModelMonitor, type RuntimeFilters } from '../services/runtimeApi';
import type { ModelMonitor } from '../types/runtimeApi';
import { ErrorPanel, LoadingPanel } from './RuntimeMachinesPage';

export function RuntimeModelMonitorPage({ filters }: { filters: RuntimeFilters }) {
  const [data, setData] = useState<ModelMonitor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError(null);
    loadModelMonitor(filters, controller.signal).then((response) => setData(response.data)).catch((reason: Error) => { if (reason.name !== 'AbortError') setError(reason.message); });
    return () => controller.abort();
  }, [filters, nonce]);
  if (error) return <ErrorPanel message={error} onRetry={() => setNonce((value) => value + 1)} />;
  if (!data) return <LoadingPanel label="Loading runtime and model reports..." />;
  const candidates = data.l1Candidates;
  const targets = data.l2Targets;
  const funnel = data.scoringFunnel;
  return <section className="glass-panel p-5"><div className="panel-title">AI Model Monitor</div><div className="mt-5 grid grid-cols-3 gap-4"><Status label="Runtime" value={String(data.runtimeStatus)} /><Status label="Environment" value={String(data.runtimeEnvironmentStatus ?? 'Unavailable')} /><Status label="Artifact integrity" value={String(data.artifactIntegrity ?? 'Unavailable')} /><Status label="Selected L1" value={String(candidates?.selected ?? 'Unavailable')} /><Status label="Selected L2 targets" value={targets ? String(targets.length) : 'Unavailable'} /><Status label="Policy-ready funnel" value={funnel?.length ? String(funnel[funnel.length - 1].count ?? 'Unavailable') : 'Unavailable'} /><Status label="Next scheduled retrain" value={String(data.nextScheduledRetrain ?? 'Not scheduled')} /><Status label="Automatic promotion" value="Disabled" /><Status label="Data source" value="SQL API" /></div></section>;
}
function Status({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-blue-200/15 bg-slate-950/35 p-4"><div className="text-xs uppercase text-slate-500">{label}</div><div className="mt-2 font-bold text-white">{value}</div></div>; }
