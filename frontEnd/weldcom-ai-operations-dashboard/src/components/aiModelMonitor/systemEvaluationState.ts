import type { ModelMonitorDto } from '../../types/aiModelMonitor';

export function getSystemEvaluationState(data: ModelMonitorDto | null, loading: boolean, error: string | null) {
  const status = data?.systemStatus;
  const green = Boolean(status?.mode === 'api' && status.requiredDataLoaded && status.runtimeStatus === 'HEALTHY' && status.runtimeEnvironmentStatus === 'PASS' && status.artifactIntegrity === 'PASS' && !loading && !error);
  const red = status?.mode === 'mock';
  const tone = red ? 'red' : green ? 'green' : 'yellow';
  const label = red ? 'DEMO DATA' : green ? 'OPERATIONAL' : 'STARTING / NOT READY';
  const description = red ? 'Local fixture data' : green ? 'SQL-backed AI assessment' : 'Required monitor evidence is loading or has not passed readiness checks.';
  return { tone, label, description, red, green };
}
