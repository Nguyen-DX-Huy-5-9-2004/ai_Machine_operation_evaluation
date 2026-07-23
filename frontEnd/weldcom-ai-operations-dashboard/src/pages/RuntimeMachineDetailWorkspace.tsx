import { useEffect, useMemo, useState } from 'react';
import { dataProvider } from '@data-provider';
import type { MachineSummary } from '../types/runtimeApi';
import type { RuntimeFilters } from '../types/runtimeFilters';
import { ErrorPanel, LoadingPanel } from './RuntimeMachinesPage';
import type { MachineDetailResponse } from '../types/machineDetail';
import { MachineDetailPresentation } from '../components/machineDetail/MachineDetailPresentation';
import { ReplayLivePanel } from '../components/replay/ReplayLivePanel';
import { useReplayFeed } from '../hooks/useReplayFeed';
import { mergeReplayMachineDetail } from '../mappers/replayPresentationMapper';
import '../styles/machine-detail.css';

// Bounded SQL detail responses are reused while a range is refreshed. This
// keeps the operator's current evidence visible instead of remounting the page.
const detailCache = new Map<string, MachineDetailResponse>();

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
  const [detailLoading, setDetailLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [detailRange, setDetailRange] = useState<NonNullable<RuntimeFilters['rangePreset']>>(filters.rangePreset ?? 'Last 24 Hours');
  const replay = useReplayFeed(machineId ?? undefined);
  const liveDetail = useMemo(() => detail ? mergeReplayMachineDetail(detail, replay.events) : null, [detail, replay.events]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    dataProvider.machines(filters, 1, controller.signal)
      .then((response) => {
        const sorted = [...response.data.items].sort((left, right) => left.displayCode.localeCompare(right.displayCode) || left.machineId - right.machineId);
        setMachines(sorted);
        const selected = machineId != null && sorted.some((row) => row.machineId === machineId) ? machineId : sorted[0]?.machineId ?? null;
        setMachineId(selected);
        if (selected != null) window.history.replaceState({}, '', `/machine-detail?machineId=${selected}`);
      })
      .catch((reason: Error) => { if (reason.name !== 'AbortError') setError(reason.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [filters, nonce]);

  const selected = useMemo<MachineSummary | undefined>(() => {
    const resolved = machines.find((row) => row.machineId === machineId);
    if (resolved) return resolved;
    // A URL from the alert table already has a trusted machine identifier.
    // Start bounded L1/L2/detail requests immediately; the selector metadata
    // upgrades this provisional label as soon as the machines query completes.
    return machineId != null ? { machineId, displayCode: `Machine ${machineId}` } : undefined;
  }, [machines, machineId]);
  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    const cacheKey = `${selected.machineId}|${filters.datasetMode}|${detailRange}|${filters.from ?? ''}|${filters.to ?? ''}`;
    const cached = detailCache.get(cacheKey);
    if (cached) setDetail(cached);
    else setDetail((current) => current?.machine.machineId === String(selected.machineId) ? current : null);
    setDetailLoading(true);
    setError(null);
    dataProvider.machineDetailDto(selected, { ...filters, rangePreset: detailRange }, controller.signal)
      .then((next) => { detailCache.set(cacheKey, next); setDetail(next); })
      .catch((reason: Error) => { if (reason.name !== 'AbortError') setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  // Include the retry nonce here as well.  A detail failure must retry its
  // own bounded L1/L2/KWh requests, not only refresh the machine selector.
  }, [selected, filters, detailRange, nonce]);

  if (error && !detail) return <ErrorPanel message={error} onRetry={() => setNonce((value) => value + 1)} />;
  if (loading && machineId == null && !detail) return <LoadingPanel label="Loading available machines from the SQL API..." />;
  if (!machines.length && !machineId) return <section className="glass-panel p-8"><h2 className="text-xl font-bold">No machine is available</h2><p className="mt-2 text-slate-400">The selected historical dataset does not contain a machine in this range.</p></section>;
  // React can render once between the selector response and the selected-machine
  // state update. Keep the shell loading briefly rather than flashing an
  // incorrect empty-state while a valid query-string machine is resolving.
  if (!machineId || !selected) return <LoadingPanel label="Resolving the selected machine..." />;

  return <div className="space-y-3">
    <section className="glass-panel flex flex-wrap items-center gap-3 p-4">
      <button type="button" className="neon-button px-3 py-2" onClick={onBack}>Back to machines</button>
      <label htmlFor="machine-selector" className="text-sm font-semibold text-slate-300">Machine</label>
      <select id="machine-selector" className="min-w-64 rounded border border-blue-300/20 bg-slate-950 px-3 py-2" value={machineId} onChange={(event) => { const next = Number(event.target.value); setMachineId(next); window.history.pushState({}, '', `/machine-detail?machineId=${next}`); }}>
        {!machines.some((row) => row.machineId === machineId) && <option value={machineId}>{selected.displayCode} - #{machineId}</option>}
        {machines.map((row) => <option key={row.machineId} value={row.machineId}>{row.displayCode} - #{row.machineId}{row.locationId != null ? ` - Location ${row.locationId}` : ''}{row.currentAction ? ` - ${row.currentAction}` : ''}</option>)}
      </select>
      {loading && <span className="text-xs text-slate-400">Loading machine directory...</span>}
    </section>
    <ReplayLivePanel machineId={machineId} compact feed={replay} />
    {liveDetail ? <MachineDetailPresentation data={liveDetail} refreshing={detailLoading} timeRange={detailRange} onTimeRangeChange={(value) => setDetailRange(value as NonNullable<RuntimeFilters['rangePreset']>)} /> : <LoadingPanel label="Loading machine evidence, L1, L2, and policy results..." />}
  </div>;
}
