import { useMemo } from 'react';
import type { ReplayEvent } from '../types/replay';
import { deriveAdaptiveEventViewport } from '../utils/adaptiveEventViewport';

export function useAdaptiveEventViewport(events: ReplayEvent[], chartWidth: number, densityPerPixel?: number) {
  return useMemo(() => deriveAdaptiveEventViewport(events, chartWidth, densityPerPixel), [chartWidth, densityPerPixel, events]);
}
