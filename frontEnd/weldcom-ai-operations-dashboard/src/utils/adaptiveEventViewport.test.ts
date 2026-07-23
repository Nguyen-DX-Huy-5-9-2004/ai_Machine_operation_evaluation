import { describe, expect, it } from 'vitest';
import { deriveAdaptiveEventViewport } from './adaptiveEventViewport';

const row = (id: number, patch = {}) => ({ event_id: id, machine_id: 1, event_uid: `HISTORICAL_REPLAY:demo:${id}`, replay_sequence: id, operational_overall_risk_score: id % 100, ...patch });

describe('adaptive event viewport', () => {
  it('uses stable bounded density and retains important events', () => {
    const events = Array.from({ length: 600 }, (_, index) => row(index + 1));
    events[299] = row(300, { operational_action_level: 'CRITICAL' });
    const viewport = deriveAdaptiveEventViewport(events, 300);
    expect(viewport.maxPoints).toBe(126);
    expect(viewport.events.some((item) => item.event_id === 300)).toBe(true);
    expect(viewport.visibleRange.firstEventId).toBe(1);
    expect(viewport.visibleRange.lastEventId).toBe(600);
  });
});
