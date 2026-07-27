import { useEffect, useState } from 'react';
import { dataProvider } from '@data-provider';
import type { EnergyConsistencyOverview } from '../types/operationsPages';
import type { RuntimeFilters } from '../types/runtimeFilters';
import { ErrorPanel, LoadingPanel } from './RuntimeMachinesPage';
import { useUiText } from '../i18n/appTranslations';

const show = (value: number | null) => value == null ? 'Not available' : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
export function EnergyConsistencyPage({ filters = { datasetMode: 'historical' } }: { filters?: RuntimeFilters }) {
  const t = useUiText();
  const [data, setData] = useState<EnergyConsistencyOverview | null>(null); const [error, setError] = useState<string | null>(null); const [nonce, setNonce] = useState(0);
  useEffect(() => { const c = new AbortController(); dataProvider.energyConsistency(filters, c.signal).then(setData).catch((e: Error) => { if (e.name !== 'AbortError') setError(e.message); }); return () => c.abort(); }, [filters, nonce]);
  if (error) return <ErrorPanel message={error} onRetry={() => setNonce((v) => v + 1)} />; if (!data) return <LoadingPanel label="Loading SQL data..." />;
  return <section className="space-y-4"><div className="glass-panel p-5"><div className="panel-title">{t('Energy Consistency')}</div><p className="mt-2 text-sm text-slate-400">{t(data.note)}</p></div><div className="glass-panel overflow-x-auto p-5"><table className="data-table"><thead><tr><th>{t('Machine')}</th><th>{t('Scope')}</th><th>{t('KWh delta')}</th><th>{t('KWh rate/hour')}</th><th>{t('Loaded zero')}</th><th>{t('Loaded without KWh')}</th><th>{t('Energy issue')}</th></tr></thead><tbody>{data.issues.map((row) => <tr key={row.machine_id}><td>{row.machine_id}</td><td>{row.location_name}</td><td>{t(show(row.kwh_delta_model_value))}</td><td>{t(show(row.kwh_rate_per_hour))}</td><td>{t(row.loaded_zero_kwh_flag ? 'Yes' : 'No')}</td><td>{t(row.loaded_without_kwh_flag ? 'Yes' : 'No')}</td><td>{t(row.energy_inconsistency_flag ? 'Review' : 'No issue')}</td></tr>)}</tbody></table></div></section>;
}
