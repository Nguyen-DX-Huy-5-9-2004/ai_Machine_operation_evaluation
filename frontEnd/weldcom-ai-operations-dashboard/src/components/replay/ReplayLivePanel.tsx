import { useEffect, useMemo, useRef, useState } from 'react';
import { Brush, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useReplayFeed } from '../../hooks/useReplayFeed';
import { useAdaptiveEventViewport } from '../../hooks/useAdaptiveEventViewport';
import type { SpacingMode } from '../../types/replay';

export type ReplayFeed = ReturnType<typeof useReplayFeed>;

interface Props { machineId?: number; compact?: boolean; feed?: ReplayFeed; }
type BrushRange = { startIndex: number; endIndex: number };

function formatTime(value: number) {
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ReplayLivePanel(props: Props) {
  // Hooks cannot be called conditionally. Split the owner from the view so a
  // supplied feed never opens a second SSE connection on Dashboard/Detail.
  return props.feed
    ? <ReplayLivePanelView compact={props.compact} feed={props.feed} />
    : <OwnedReplayLivePanel machineId={props.machineId} compact={props.compact} />;
}

function OwnedReplayLivePanel({ machineId, compact }: Omit<Props, 'feed'>) {
  const feed = useReplayFeed(machineId);
  return <ReplayLivePanelView compact={compact} feed={feed} />;
}

function ReplayLivePanelView({ compact = false, feed }: { compact?: boolean; feed: ReplayFeed }) {
  const [spacing, setSpacing] = useState<SpacingMode>('event');
  const [follow, setFollow] = useState(true);
  const [range, setRange] = useState<BrushRange>({ startIndex: 0, endIndex: 0 });
  const [busy, setBusy] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);
  const chartHost = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(compact ? 640 : 1000);

  useEffect(() => {
    const node = chartHost.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setChartWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const viewport = useAdaptiveEventViewport(feed.events, chartWidth);
  const chartData = useMemo(() => viewport.events.map((event, index) => ({
    ...event,
    eventIndex: index + 1,
    timeMs: event.source_event_start_time ? new Date(event.source_event_start_time).getTime() : index,
    timestamp: event.source_event_start_time ? new Date(event.source_event_start_time).toLocaleString() : 'Unknown time',
    risk: Number(event.operational_overall_risk_score ?? 0),
  })), [viewport.events]);
  const windowSize = Math.max(24, Math.min(compact ? 64 : 120, chartData.length));

  useEffect(() => {
    setRange((current) => {
      if (!chartData.length) return { startIndex: 0, endIndex: 0 };
      if (follow || current.endIndex >= chartData.length - 2) {
        return { startIndex: Math.max(0, chartData.length - windowSize), endIndex: chartData.length - 1 };
      }
      const endIndex = Math.min(current.endIndex, chartData.length - 1);
      return { startIndex: Math.min(current.startIndex, endIndex), endIndex };
    });
  }, [chartData.length, follow, windowSize]);

  const setFollowMode = (value: boolean) => {
    setFollow(value);
    feed.setAutoFollow(value);
    if (value) setRange({ startIndex: Math.max(0, chartData.length - windowSize), endIndex: Math.max(0, chartData.length - 1) });
  };
  const changeRange = (next: BrushRange) => {
    setRange(next);
    // A dragged Brush is an explicit operator viewport. Even when its right
    // edge happens to be at "latest", do not move it again on the next delta.
    // Auto-follow is restored only through the visible toggle or jump action.
    setFollow(false);
    feed.setAutoFollow(false);
  };
  const command = async (action: 'pause' | 'resume' | 'step') => {
    setBusy(true); setControlError(null);
    try { await feed.control(action); } catch (error) { setControlError(error instanceof Error ? error.message : 'Replay control failed'); } finally { setBusy(false); }
  };

  if (!feed.enabled) return null;
  const isPaused = feed.status?.replayState === 'PAUSED';
  const xDataKey = spacing === 'event' ? 'eventIndex' : 'timeMs';
  return <section className="glass-panel replay-live-panel p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="panel-title">Historical Replay</div>
        <div className="mt-1 text-xs text-slate-400">
          <span className={feed.connected ? 'text-emerald-300' : 'text-amber-300'}>{feed.connected ? 'Live delta connected' : 'Reconnecting'}</span>
          {' | '}virtual {feed.status?.virtualTime ? formatTime(new Date(feed.status.virtualTime).getTime()) : 'not started'}
          {' | '}batch {feed.status?.batchSequence ?? 0}
        </div>
      </div>
      <div className="replay-controls">
        <button className={spacing === 'event' ? 'replay-toggle is-active' : 'replay-toggle'} onClick={() => setSpacing('event')}>Event spacing</button>
        <button className={spacing === 'time' ? 'replay-toggle is-active' : 'replay-toggle'} onClick={() => setSpacing('time')}>Time spacing</button>
        <button className={follow ? 'replay-toggle is-active' : 'replay-toggle'} onClick={() => setFollowMode(!follow)}>{follow ? 'Auto-follow on' : 'Auto-follow off'}</button>
        <button className="replay-command" disabled={busy} onClick={() => void command(isPaused ? 'resume' : 'pause')}>{isPaused ? 'Resume' : 'Pause'}</button>
        <button className="replay-command" disabled={busy || !isPaused} onClick={() => void command('step')}>Step</button>
        <span className="replay-cadence">5s real = 5m source</span>
      </div>
    </div>
    {feed.newEventCount ? <button className="replay-new-events" onClick={() => setFollowMode(true)}>{feed.newEventCount} new events | Jump to latest</button> : null}
    {controlError ? <div className="mt-2 text-xs text-red-300">{controlError}</div> : null}
    <div ref={chartHost} className={compact ? 'mt-3 h-48' : 'mt-3 h-72'}>
      <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 8, right: 16, left: -12, bottom: compact ? 0 : 10 }}>
        <CartesianGrid stroke="rgba(87,155,220,.16)" vertical={false} />
        <XAxis type="number" dataKey={xDataKey} scale={spacing === 'time' ? 'time' : 'auto'} domain={spacing === 'time' ? ['dataMin', 'dataMax'] : ['dataMin', 'dataMax']} tickFormatter={(value) => spacing === 'time' ? formatTime(Number(value)) : `#${value}`} minTickGap={42} tick={{ fill: '#91abc8', fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fill: '#91abc8', fontSize: 11 }} />
        <Tooltip cursor={false} contentStyle={{ background: '#061426', border: '1px solid #238ce8', borderRadius: 8 }} labelFormatter={(_, payload) => payload?.[0]?.payload?.timestamp ?? ''} formatter={(value) => [`${Number(value ?? 0).toFixed(1)}/100`, 'Operational risk']} />
        <Line type="monotone" dataKey="risk" stroke="#a855f7" strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: '#fff' }} isAnimationActive={false} />
        <Brush dataKey={xDataKey} height={24} stroke="#1d83d7" travellerWidth={8} startIndex={range.startIndex} endIndex={range.endIndex} onChange={(value) => changeRange({ startIndex: value.startIndex ?? 0, endIndex: value.endIndex ?? Math.max(0, chartData.length - 1) })} tickFormatter={() => ''} />
      </LineChart></ResponsiveContainer>
    </div>
    <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-400">
      <span>Showing {chartData.length} / {feed.events.length} cached events{viewport.hiddenPointCount ? ` | ${viewport.hiddenPointCount} density-reduced` : ''}</span>
      <span>AI: L1 {feed.status?.l1ReadyCount ?? 0} ready | L2 {feed.status?.l2ReadyCount ?? 0} ready | Policy {feed.status?.policyReadyCount ?? 0} ready | SQL writes: 0</span>
    </div>
  </section>;
}
