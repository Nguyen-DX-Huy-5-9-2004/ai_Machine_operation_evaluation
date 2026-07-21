import { useEffect, useState } from 'react';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { loadMachines, riskForDisplay, type RuntimeFilters } from '../services/runtimeApi';
import type { MachineSummary } from '../types/runtimeApi';

export function RuntimeMachinesPage({ filters, onSelect }: { filters: RuntimeFilters; onSelect: (machineId: number) => void }) {
  const [rows, setRows] = useState<MachineSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null);
    loadMachines(filters, page, controller.signal).then((response) => { setRows(response.data.items); setTotal(response.data.total); })
      .catch((reason: Error) => { if (reason.name !== 'AbortError') setError(reason.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [filters, page, nonce]);
  if (loading) return <LoadingPanel label="Loading machines from SQL API..." />;
  if (error) return <ErrorPanel message={error} onRetry={() => setNonce((value) => value + 1)} />;
  return <section className="glass-panel overflow-hidden">
    <div className="flex items-center justify-between p-5"><div className="panel-title">Machines</div><span className="text-sm text-slate-400">{rows.length} shown of {total}</span></div>
    {rows.length === 0 ? <div className="p-10 text-center text-slate-400">No eligible machines in this range.</div> : <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Machine</th><th>Latest event</th><th>Risk</th><th>Action</th><th>Fault 30min</th><th>Maintenance</th><th>Quality</th><th>Readiness</th><th /></tr></thead><tbody>
      {rows.map((row) => <tr key={row.machineId}><td className="font-bold text-white">{row.displayCode}</td><td>{row.latestEventTime ?? 'Unavailable'}</td><td>{formatRisk(row.currentRisk)}</td><td>{row.currentAction ?? 'UNREADY'}</td><td>{formatRisk(row.faultRisk30min)}</td><td>{formatRisk(row.maintenanceRisk)}</td><td>{row.dataQuality ?? 'Unavailable'}</td><td>{row.readiness ?? 'Unavailable'}</td><td><button title="Open machine" onClick={() => onSelect(row.machineId)} className="p-2 text-blue-300"><ChevronRight size={18} /></button></td></tr>)}
    </tbody></table></div>}
    <div className="flex items-center justify-end gap-3 px-5 py-3 text-sm text-slate-400"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page}</span><button disabled={page * 50 >= total} onClick={() => setPage((value) => value + 1)}>Next</button></div>
  </section>;
}

export function LoadingPanel({ label }: { label: string }) { return <div className="glass-panel p-10 text-center text-slate-300">{label}</div>; }
export function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="glass-panel border-red-500/40 p-8"><div className="font-bold text-red-300">Unable to load real API data</div><div className="mt-2 text-sm text-slate-300">{message}</div><button onClick={onRetry} className="neon-button mt-4 flex items-center gap-2 px-3 py-2"><RefreshCw size={16} />Retry</button></div>; }
export function formatRisk(value: number | null | undefined) { if (value == null) return 'Unavailable'; return `${riskForDisplay(value).toFixed(1)}%`; }
