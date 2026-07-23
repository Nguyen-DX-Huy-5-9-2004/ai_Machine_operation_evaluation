import type { ReplayEvent } from '../types/replay';
import { downsampleReplayEvents } from './replayDensity';

export interface AdaptiveViewport {
  events: ReplayEvent[];
  maxPoints: number;
  hiddenPointCount: number;
  latestEvent: ReplayEvent | null;
  visibleRange: { firstEventId: number | null; lastEventId: number | null };
}

export function deriveAdaptiveEventViewport(events: ReplayEvent[], chartWidth: number, densityPerPixel = 0.42): AdaptiveViewport {
  const maxPoints = Math.max(24, Math.floor(Math.max(chartWidth, 240) * densityPerPixel));
  const visible = downsampleReplayEvents(events, maxPoints);
  return {
    events: visible,
    maxPoints,
    hiddenPointCount: Math.max(0, events.length - visible.length),
    latestEvent: events.length ? events[events.length - 1] : null,
    visibleRange: { firstEventId: visible[0]?.event_id ?? null, lastEventId: visible[visible.length - 1]?.event_id ?? null },
  };
}
