import { useEffect, useMemo, useState } from 'react';
import { dataProvider } from '@data-provider';
import type { MachineSummary } from '../types/runtimeApi';
import type { RuntimeFilters } from '../types/runtimeFilters';
import { ErrorPanel, LoadingPanel } from './RuntimeMachinesPage';
import type { MachineDetailResponse } from '../types/machineDetail';
import { MachineDetailPresentation } from '../components/machineDetail/MachineDetailPresentation';
import '../styles/machine-detail.css';

function machineFromUrl(): number | null {
  const match = window.location.pathname.match(/^\/machines\/(\d+)$/);
  const raw = match?.[1] ?? new URLSearchParams(window.location.search).get('machineId');
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function RuntimeMachineDetailWorkspace({ filters, onBack }: { filters: RuntimeFilters; onBack: () => void }) {
  const [machines, setMachines] = useState<MachineSummary[]>([]);
  const [machineId, setMachineId] = useState<number | null>(machineFromUrl);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<MachineDetailResponse | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null);
    dataProvider.machines(filters, 1, controller.signal).then((response) => {
      const sorted = [...response.data.items].sort((a, b) => a.displayCode.localeCompare(b.displayCode) || a.machineId - b.machineId);
      setMachines(sorted);
      const selected = machineId != null && sorted.some((row) => row.machineId === machineId) ? machineId : sorted[0]?.machineId ?? null;
      setMachineId(selected);
      if (selected != null) window.history.replaceState({}, '', `/machine-detail?machineId=${selected}`);
    }).catch((reason: Error) => { if (reason.name !== 'AbortError') setError(reason.message); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [filters, nonce]);
  const selected = useMemo(() => machines.find((row) => row.machineId === machineId), [machines, machineId]);
  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    const controller = new AbortController(); setDetail(null); setError(null);
    dataProvider.machineDetailDto(selected, filters, controller.signal).then(setDetail).catch((reason: Error) => { if (reason.name !== 'AbortError') setError(reason.message); });
    return () => controller.abort();
  }, [selected, filters]);
  if (error) return <ErrorPanel message={error} onRetry={() => setNonce((value) => value + 1)} />;
  if (loading) return <LoadingPanel label="Đang tải danh sách máy từ SQL..." />;
  if (!machineId || !selected) return <section className="glass-panel p-8"><h2 className="text-xl font-bold">Chưa có kết quả online</h2><p className="mt-2 text-slate-400">Không có máy trong dataset đã chọn. Dữ liệu historical không được tự động thay thế.</p></section>;
  return <div className="space-y-3">
    <section className="glass-panel flex flex-wrap items-center gap-3 p-4">
      <button type="button" className="neon-button px-3 py-2" onClick={onBack}>Back to machines</button>
      <label htmlFor="machine-selector" className="text-sm font-semibold text-slate-300">Machine</label>
      <select id="machine-selector" className="min-w-64 rounded border border-blue-300/20 bg-slate-950 px-3 py-2" value={machineId} onChange={(event) => { const next = Number(event.target.value); setMachineId(next); window.history.pushState({}, '', `/machine-detail?machineId=${next}`); }}>
        {machines.map((row) => <option key={row.machineId} value={row.machineId}>{row.displayCode} · #{row.machineId}{row.locationId != null ? ` · Location ${row.locationId}` : ''}{row.currentAction ? ` · ${row.currentAction}` : ''}</option>)}
      </select>
    </section>
    {detail ? <MachineDetailPresentation data={detail} /> : <LoadingPanel label="Đang tải dữ liệu SQL..." />}
  </div>;
}
