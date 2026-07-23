import type { ReplayEvent } from '../types/replay';

const important = (event: ReplayEvent) => {
  const action = String(event.operational_action_level ?? '').toUpperCase();
  // Policy-ready is common in a healthy replay. Treating every ready event as
  // special defeats density reduction and makes live charts unreadable.
  return action === 'CRITICAL' || action === 'HIGH' || Number(event.behavior_anomaly_score ?? 0) >= 0.76 || Boolean(event.is_sensitive_warning) || Boolean(event.energy_inconsistency_flag) || Boolean(event.data_quality_issue_flag);
};

/** Bucketed downsampling keeps extrema plus every operationally important event. */
export function downsampleReplayEvents(events: ReplayEvent[], maxPoints: number): ReplayEvent[] {
  if (events.length <= maxPoints || maxPoints < 4) return events;
  const keep = new Map<string, ReplayEvent>();
  const bucketSize = Math.ceil(events.length / Math.max(1, maxPoints - 2));
  const push = (event: ReplayEvent | undefined) => { if (event) keep.set(event.event_uid, event); };
  push(events[0]); push(events[events.length - 1]);
  for (let start = 0; start < events.length; start += bucketSize) {
    const bucket = events.slice(start, start + bucketSize);
    push(bucket[0]); push(bucket[bucket.length - 1]);
    bucket.filter(important).forEach(push);
    const risk = (value: ReplayEvent) => Number(value.operational_overall_risk_score ?? Number.NEGATIVE_INFINITY);
    push(bucket.reduce((max, current) => risk(current) > risk(max) ? current : max, bucket[0]));
    push(bucket.reduce((min, current) => risk(current) < risk(min) ? current : min, bucket[0]));
  }
  return events.filter((event) => keep.has(event.event_uid));
}

export function appendReplayDelta(current: ReplayEvent[], incoming: ReplayEvent[], maxEvents = 1500): ReplayEvent[] {
  if (!incoming.length) return current;
  const seen = new Set(current.map((event) => event.event_uid));
  const fresh = incoming.filter((event) => !seen.has(event.event_uid));
  if (!fresh.length) return current;
  const merged = [...current, ...fresh]
    .sort((left, right) => left.replay_sequence - right.replay_sequence || left.event_id - right.event_id);
  return merged.slice(-maxEvents);
}
