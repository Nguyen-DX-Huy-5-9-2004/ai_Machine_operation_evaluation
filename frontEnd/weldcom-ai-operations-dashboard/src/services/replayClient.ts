import { runtimeConfig } from '../config/runtimeConfig';
import type { ReplayDelta, ReplayStatus } from '../types/replay';

const configuredReplayRunId = import.meta.env.VITE_REPLAY_RUN_ID?.trim() ?? '';

export const replayRuntime = {
  apiEnabled: runtimeConfig.isApiMode,
  runId: configuredReplayRunId,
};

function endpoint(path: string): string {
  const apiRoot = runtimeConfig.apiBaseUrl.endsWith('/api') ? runtimeConfig.apiBaseUrl : `${runtimeConfig.apiBaseUrl}/api`;
  return `${apiRoot}/replay${path}`;
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(endpoint(path), { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Replay API request failed (${response.status})`);
  return response.json() as Promise<T>;
}

async function command<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(endpoint(path), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Replay control failed (${response.status})`);
  return response.json() as Promise<T>;
}

export async function getReplayRuns(signal?: AbortSignal): Promise<ReplayStatus[]> {
  const payload = await request<{ data: ReplayStatus[] }>('/runs', signal);
  return payload.data;
}

export async function getReplayStatus(runId: string, signal?: AbortSignal): Promise<ReplayStatus> {
  const payload = await request<{ data: ReplayStatus }>(`/status?replay_run_id=${encodeURIComponent(runId)}`, signal);
  return payload.data;
}

export async function getReplayDelta(
  runId: string,
  afterSequence: number,
  machineId?: number,
  signal?: AbortSignal,
  initialSnapshot = false,
): Promise<ReplayDelta> {
  const query = new URLSearchParams({ replay_run_id: runId, after_sequence: String(afterSequence), limit: '300' });
  if (machineId != null) query.set('machine_id', String(machineId));
  if (initialSnapshot) query.set('initial_snapshot', 'true');
  return request<ReplayDelta>(`/events?${query.toString()}`, signal);
}

export function openReplayStream(runId: string, afterSequence: number, onDelta: (delta: ReplayDelta) => void, onError: () => void, machineId?: number): EventSource | null {
  if (!replayRuntime.apiEnabled || typeof EventSource === 'undefined') return null;
  const query = new URLSearchParams({ replay_run_id: runId, after_sequence: String(afterSequence) });
  if (machineId != null) query.set('machine_id', String(machineId));
  const stream = new EventSource(endpoint(`/stream?${query.toString()}`));
  stream.addEventListener('replay-delta', (event) => onDelta(JSON.parse((event as MessageEvent<string>).data) as ReplayDelta));
  stream.onerror = onError;
  return stream;
}

export async function controlReplay(runId: string, action: 'pause' | 'resume' | 'step' | 'speed', options?: { speedMultiplier?: number; realTickSeconds?: number }): Promise<void> {
  if (action === 'step') {
    await command('/step', { replayRunId: runId, ticks: 1 });
    return;
  }
  if (action === 'speed') {
    await command('/speed', { replayRunId: runId, speedMultiplier: options?.speedMultiplier ?? 1, realTickSeconds: options?.realTickSeconds });
    return;
  }
  await command(`/${action}`, { replayRunId: runId });
}
