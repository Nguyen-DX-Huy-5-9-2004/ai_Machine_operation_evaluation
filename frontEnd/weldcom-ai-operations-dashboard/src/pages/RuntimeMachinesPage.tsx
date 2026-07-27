import { useEffect, useState } from 'react';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { riskForDisplay, type RuntimeFilters } from '../types/runtimeFilters';
import { dataProvider } from '@data-provider';
import type { MachineSummary } from '../types/runtimeApi';
import { runtimeConfig } from '../config/runtimeConfig';
import { useUiText } from '../i18n/appTranslations';

export function RuntimeMachinesPage({ filters, onSelect }: { filters: RuntimeFilters; onSelect: (machineId: number) => void }) {
  const t = useUiText();
  const [rows, setRows] = useState<MachineSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null);
    dataProvider.machines(filters, page, controller.signal).then((response) => { setRows(response.data.items); setTotal(response.data.total); })
      .catch((reason: Error) => { if (reason.name !== 'AbortError') setError(reason.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [filters, page, nonce]);
  if (loading) return <LoadingPanel label="Loading machines from SQL API..." />;
  if (error) return <ErrorPanel message={error} onRetry={() => setNonce((value) => value + 1)} />;
  return <section className="glass-panel overflow-hidden">
    <div className="flex items-center justify-between p-5"><div className="panel-title">{t('Machines')}</div><span className="text-sm text-slate-400">{rows.length} {t('shown of')} {total}</span></div>
    {rows.length === 0 ? <div className="p-10 text-center text-slate-400">{t('No eligible machines in this range.')}</div> : <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>{t('Machine')}</th><th>{t('Latest event')}</th><th>{t('Risk')}</th><th>{t('Action')}</th><th>{t('Fault Risk 30min')}</th><th>{t('Maintenance')}</th><th>{t('Quality')}</th><th>{t('Readiness')}</th><th /></tr></thead><tbody>
      {rows.map((row) => <tr key={row.machineId}><td className="font-bold text-white">{row.displayCode}</td><td>{row.latestEventTime ?? t('Unavailable')}</td><td>{t(formatRisk(row.currentRisk))}</td><td>{t(row.currentAction ?? 'UNREADY')}</td><td>{t(formatRisk(row.faultRisk30min))}</td><td>{t(formatRisk(row.maintenanceRisk))}</td><td>{t(row.dataQuality ?? 'Unavailable')}</td><td>{t(row.readiness ?? 'Unavailable')}</td><td><button title={t('Open machine')} onClick={() => onSelect(row.machineId)} className="p-2 text-blue-300"><ChevronRight size={18} /></button></td></tr>)}
    </tbody></table></div>}
    <div className="flex items-center justify-end gap-3 px-5 py-3 text-sm text-slate-400"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t('Previous')}</button><span>{t('Page')} {page}</span><button disabled={page * 50 >= total} onClick={() => setPage((value) => value + 1)}>{t('Next')}</button></div>
  </section>;
}

export function LoadingPanel({ label }: { label: string }) { const t = useUiText(); return <div className="glass-panel min-h-48 p-10 text-center text-slate-300">{runtimeConfig.isMockMode ? t('Loading demo data...') : t(label)}</div>; }
export function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) { const t = useUiText(); return <div className="glass-panel border-red-500/40 p-8"><div className="font-bold text-red-300">{t(runtimeConfig.isMockMode ? 'Unable to load mock demo data' : 'Unable to load real API data')}</div>{runtimeConfig.isApiMode ? <div className="mt-3 grid gap-1 text-xs text-slate-400"><span>{t('Data source: REAL SQL API')}</span><span>{t('Browser origin')}: {window.location.origin}</span><span>{t('API base URL')}: {runtimeConfig.apiBaseUrl}</span></div> : null}<div className="mt-2 text-sm text-slate-300">{t(message)}</div><button onClick={onRetry} className="neon-button mt-4 flex items-center gap-2 px-3 py-2"><RefreshCw size={16} />{t('Retry')}</button></div>; }
export function formatRisk(value: number | null | undefined) { if (value == null) return 'Unavailable'; return `${riskForDisplay(value).toFixed(1)}%`; }
