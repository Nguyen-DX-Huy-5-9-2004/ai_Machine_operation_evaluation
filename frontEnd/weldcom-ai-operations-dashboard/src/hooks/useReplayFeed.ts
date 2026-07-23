import { useEffect, useMemo, useRef, useState } from 'react';
import { controlReplay, getReplayDelta, getReplayRuns, getReplayStatus, openReplayStream, replayRuntime } from '../services/replayClient';
import type { ReplayEvent, ReplayStatus } from '../types/replay';
import { appendReplayDelta } from '../utils/replayDensity';

export function useReplayFeed(machineId?: number) {
  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [status, setStatus] = useState<ReplayStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [newEventCount, setNewEventCount] = useState(0);
  const [runId, setRunId] = useState('');
  const cursor = useRef(0);
  const autoFollow = useRef(true);

  useEffect(() => {
    if (!replayRuntime.apiEnabled) return;
    const controller = new AbortController();
    void getReplayRuns(controller.signal)
      .then((runs) => {
        // Auto-discovery supports a Vite server that was already open before a
        // demo began.  Only explicit demo runs are surfaced in regular pages.
        const demoRun = runs.find((run) => run.replayRunId.startsWith('demo_tomorrow_') && run.batchSequence > 0);
        const resolvedRunId = demoRun?.replayRunId ?? replayRuntime.runId;
        if (resolvedRunId !== runId) setRunId(resolvedRunId);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [runId]);

  useEffect(() => {
    if (!runId) return;
    const controller = new AbortController();
    const accept = (delta: { data: ReplayEvent[]; cursor: { afterSequence: number } }) => {
      cursor.current = Math.max(cursor.current, delta.cursor.afterSequence);
      // SSE is run-scoped so a shared stream can update every route. Keep a
      // detail feed machine-scoped locally; otherwise another machine's batch
      // would leak into the open Machine Detail chart.
      const scoped = machineId == null ? delta.data : delta.data.filter((event) => event.machine_id === machineId);
      if (scoped.length) setEvents((current) => appendReplayDelta(current, scoped));
      if (!autoFollow.current && scoped.length) setNewEventCount((value) => value + scoped.length);
    };
    const load = async () => {
      try {
        const [initialStatus, initialDelta] = await Promise.all([
          getReplayStatus(runId, controller.signal),
          getReplayDelta(runId, 0, machineId, controller.signal, true),
        ]);
        if (controller.signal.aborted) return;
        setStatus(initialStatus); accept(initialDelta); setConnected(true);
        const stream = openReplayStream(runId, cursor.current, accept, () => setConnected(false), machineId);
        if (!stream) return;
        controller.signal.addEventListener('abort', () => stream.close(), { once: true });
      } catch {
        if (!controller.signal.aborted) setConnected(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [machineId, runId]);

  return useMemo(() => ({
    enabled: Boolean(runId),
    runId,
    events,
    status,
    connected,
    newEventCount,
    setAutoFollow: (value: boolean) => { autoFollow.current = value; if (value) setNewEventCount(0); },
    control: async (action: 'pause' | 'resume' | 'step' | 'speed', options?: { speedMultiplier?: number; realTickSeconds?: number }) => {
      if (!runId) return;
      await controlReplay(runId, action, options);
      setStatus(await getReplayStatus(runId));
    },
  }), [connected, events, newEventCount, runId, status]);
}
