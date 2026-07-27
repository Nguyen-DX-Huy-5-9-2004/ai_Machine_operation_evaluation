import { useEffect, useState } from 'react';
import type { RuntimeFilters } from '../types/runtimeFilters';
import { dataProvider } from '@data-provider';
import { ErrorPanel, LoadingPanel, formatRisk } from './RuntimeMachinesPage';
import { useUiText } from '../i18n/appTranslations';

export function RuntimeAlertsPage({ filters }: { filters: RuntimeFilters }) {
  const t = useUiText();
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
  return <section className="glass-panel overflow-x-auto p-5"><div className="panel-title mb-4">{t('Operational Events')}</div>{rows.length === 0 ? <div className="p-8 text-center text-slate-400">{t('No HIGH or CRITICAL policy-ready alerts.')}</div> : <table className="data-table"><thead><tr><th>{t('Event')}</th><th>{t('Machine')}</th><th>{t('Time')}</th><th>{t('Action')}</th><th>{t('Fault Risk 30min')}</th><th>{t('Quality')}</th><th>{t('Reason')}</th></tr></thead><tbody>{rows.map((row) => <tr key={String(row.eventUid)}><td>{String(row.eventUid)}</td><td>{String(row.displayCode ?? row.machineId)}</td><td>{String(row.eventTime)}</td><td>{t(String(row.operationalActionLevel))}</td><td>{t(formatRisk(Number(row.faultRisk30min)))}</td><td>{t(String(row.qualityActionLevel))}</td><td>{t(String(row.finalReason ?? ''))}</td></tr>)}</tbody></table>}</section>;
}
