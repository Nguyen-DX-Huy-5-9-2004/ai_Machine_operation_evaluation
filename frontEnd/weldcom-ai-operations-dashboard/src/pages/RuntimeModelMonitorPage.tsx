import { useEffect, useState } from 'react';
import type { RuntimeFilters } from '../types/runtimeFilters';
import { dataProvider } from '@data-provider';
import type { ModelMonitor } from '../types/runtimeApi';
import { ErrorPanel, LoadingPanel } from './RuntimeMachinesPage';
import { useUiText } from '../i18n/appTranslations';

export function RuntimeModelMonitorPage({ filters }: { filters: RuntimeFilters }) {
  const t = useUiText();
  const [data, setData] = useState<ModelMonitor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError(null);
    dataProvider.modelMonitor(filters, controller.signal).then((response) => setData(response.data)).catch((reason: Error) => { if (reason.name !== 'AbortError') setError(reason.message); });
    return () => controller.abort();
  }, [filters, nonce]);
  if (error) return <ErrorPanel message={error} onRetry={() => setNonce((value) => value + 1)} />;
  if (!data) return <LoadingPanel label="Loading runtime and model reports..." />;
  const targets = data.l2Targets;
  const funnel = data.scoringFunnel;
  const reference = data.performanceReference as Record<string, unknown> | undefined;
  const referenceAvailable = reference?.availability === true;
  return <section className="glass-panel p-5"><div className="panel-title">{t('AI Model Monitor')}</div><div className="mt-2 text-sm text-slate-400">{t('Production runtime state from SQL API. No promotion or retraining is performed here.')}</div><div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4"><Status label="Runtime" value={String(data.runtimeStatus)} /><Status label="Environment" value={String(data.runtimeEnvironmentStatus ?? 'Unavailable')} /><Status label="Artifact integrity" value={String(data.artifactIntegrity ?? 'Unavailable')} /><Status label="Relocation" value={String(data.relocationStatus ?? 'Unavailable')} /><Status label="Static gate" value={String(data.staticGatePass ?? false)} /><Status label="Selected L1" value="Candidate A" /><Status label="Selected L2 targets" value={targets ? String(targets.length) : 'Not available'} /><Status label="Policy-ready funnel" value={funnel?.length ? String(funnel[funnel.length - 1].count ?? 'Not available') : 'Not available'} /><Status label="Policy version" value={String(data.policyVersion ?? 'Not available')} /><Status label="L2 run ID" value={String(data.l2RunId ?? 'Not available')} /><Status label="Lineage hash" value={String(data.lineageHash ?? 'Not available').slice(0, 12)} /><Status label="SQL write" value={data.sqlWriteEnabled ? 'Enabled' : 'Disabled'} /><Status label="Candidate B / C" value={`${String(data.candidateBPromoted ?? false)} / ${String(data.candidateCPromoted ?? false)}`} /><Status label="Automatic promotion" value="Disabled" /><Status label="Next retrain" value={String(data.nextScheduledRetrain ?? 'Not scheduled')} /><Status label="Performance reference" value={referenceAvailable ? 'Available' : 'Not available'} /></div><div className="mt-4 text-xs text-slate-500">{t('Source: validated model artifact report · Not a live SQL metric')}</div></section>;
}
function Status({ label, value }: { label: string; value: string }) { const t = useUiText(); return <div className="rounded-lg border border-blue-200/15 bg-slate-950/35 p-4"><div className="text-xs uppercase text-slate-500">{t(label)}</div><div className="mt-2 font-bold text-white">{t(value)}</div></div>; }
