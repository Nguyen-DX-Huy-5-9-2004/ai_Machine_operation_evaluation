import { describe, expect, it } from 'vitest';
import { appendReplayDelta, downsampleReplayEvents } from './replayDensity';

const event = (id: number, extra = {}) => ({ event_id: id, machine_id: 1, event_uid: `HISTORICAL_REPLAY:run:${id}`, replay_sequence: id, operational_overall_risk_score: id, ...extra });

describe('replay density', () => {
  it('retains anomalies and extrema while reducing ordinary points', () => {
    const rows = Array.from({ length: 100 }, (_, index) => event(index + 1));
    rows[54] = event(55, { operational_action_level: 'CRITICAL' });
    const sampled = downsampleReplayEvents(rows, 12);
    expect(sampled.some((row) => row.event_id === 55)).toBe(true);
    expect(sampled[0].event_id).toBe(1);
    expect(sampled[sampled.length - 1]?.event_id).toBe(100);
  });
  it('appends deltas without duplicate event UIDs and bounds cache length', () => {
    const result = appendReplayDelta([event(1), event(2)], [event(2), event(3)], 2);
    expect(result.map((row) => row.event_id)).toEqual([2, 3]);
  });
  it('keeps the existing reference for replay heartbeats and duplicate-only deltas', () => {
    const current = [event(1), event(2)];
    expect(appendReplayDelta(current, [])).toBe(current);
    expect(appendReplayDelta(current, [event(2)])).toBe(current);
  });
  it('does not preserve every ordinary policy-ready event', () => {
    const rows = Array.from({ length: 100 }, (_, index) => event(index + 1, { policy_ready_flag: 1 }));
    expect(downsampleReplayEvents(rows, 12).length).toBeLessThan(40);
  });
});
