import type { ContractCheck, HealthTone, ModelMonitorDto, PerformanceMetricSet } from '../types/aiModelMonitor';
import type { ModelMonitor } from '../types/runtimeApi';

type Row = Record<string, unknown>;
const n = (value: unknown): number | null => value == null || !Number.isFinite(Number(value)) ? null : Number(value);
const row = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object') : [];
const pct = (value: unknown): number | null => { const result = n(value); return result == null ? null : result <= 1 ? result * 100 : result; };
const text = (value: unknown, fallback = 'Not calculated') => value == null || value === '' ? fallback : String(value);
const metricSet = (values: Partial<PerformanceMetricSet> = {}): PerformanceMetricSet => ({ normalFpr: null, knownFaultRecall: null, precision: null, f1: null, accuracy: null, ...values });
const statusText = (value: unknown) => String(value ?? '').toUpperCase();
const healthTone = (value: unknown): HealthTone => statusText(value).includes('PASS') || statusText(value) === 'HEALTHY' ? 'healthy' : statusText(value).includes('FAIL') || statusText(value).includes('NOT_READY') ? 'danger' : statusText(value).includes('WARN') ? 'warning' : 'neutral';
const contractStatus = (value: unknown): ContractCheck['status'] => statusText(value).includes('PASS') || statusText(value) === 'HEALTHY' ? 'PASS' : statusText(value).includes('FAIL') ? 'FAIL' : statusText(value).includes('WARN') || statusText(value).includes('NOT_READY') ? 'WARNING' : 'NOT_CHECKED';
const percentageLabel = (value: number | null) => value == null ? 'Not calculated' : `${value.toFixed(1)}%`;
const friendly = (value: unknown) => text(value, 'Not calculated').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

function auditOf(data: ModelMonitor) { return row(data.latestInferenceAudit); }

function mapL2Trend(source: Row[]): ModelMonitorDto['l2Trend'] {
  // The existing endpoint is only accepted when it returns per-target series.
  return source.flatMap((point) => {
    const fault30m = pct(point.fault30m ?? point.riskFault30min);
    const fault60m = pct(point.fault60m ?? point.riskFault60min);
    const maintenance30e = pct(point.maintenance30e ?? point.riskMaintenance30Events);
    const repair30e = pct(point.repair30e ?? point.riskRepair30Events);
    if ([fault30m, fault60m, maintenance30e, repair30e].some((value) => value == null)) return [];
    return [{ timestamp: text(point.timestamp ?? point.date), fault30m: fault30m!, fault60m: fault60m!, maintenance30e: maintenance30e!, repair30e: repair30e! }];
  });
}

function traceFromAudit(audit: Row): ModelMonitorDto['exampleTrace'] {
  const sample = row(audit.sample);
  if (!Object.keys(sample).length) return { eventId: 'Not available', machineId: 'No bounded inference sample available.', eventTime: '', inputEvidence: [], l1: [], l2: [], policy: [], finalReason: 'No bounded inference sample available.' };
  const input = row(sample.input);
  const l1 = row(sample.l1);
  const l2 = row(sample.l2);
  const policy = row(sample.policy);
  return {
    eventId: text(sample.eventId), machineId: text(sample.machineId), eventTime: text(sample.eventTime),
    inputEvidence: Object.entries(input).map(([label, value]) => ({ label: friendly(label), value: text(value), tone: 'info' })),
    l1: Object.entries(l1).map(([label, value]) => ({ label: friendly(label), value: text(value), tone: 'info' })),
    l2: Object.entries(l2).map(([label, value]) => ({ label: friendly(label), value: text(value), tone: 'healthy' })),
    policy: Object.entries(policy).map(([label, value]) => ({ label: friendly(label), value: text(value), tone: 'warning' })),
    finalReason: text(sample.explanation, 'No bounded inference sample available.'),
  };
}

export function adaptApiModelMonitor(data: ModelMonitor): ModelMonitorDto {
  const metadata = row(data.modelMetadata);
  const reference = row(data.performanceReference);
  const referenceL1 = row(reference.l1);
  const referenceL2 = row(reference.l2);
  const production = row(metadata.production);
  const l1Profiles = rows(metadata.l1Profiles).length ? rows(metadata.l1Profiles) : rows(referenceL1.profiles);
  const l2Targets = rows(metadata.l2Targets).length ? rows(metadata.l2Targets) : rows(referenceL2.targets);
  const funnelRows = rows(data.scoringFunnel);
  const funnelByStage = new Map(funnelRows.map((item) => [String(item.stage), item]));
  const audit = auditOf(data);
  const inputRows = n(audit.inputRows);
  const l1Ready = n(audit.l1ReadyCount);
  const anomaly = n(audit.behaviorAnomalyCount);
  const strictWarning = n(audit.strictOnlyCount);
  const l2Trend = mapL2Trend(rows(data.predictionRate));
  const l2Rate = l2Trend.length ? (l2Trend.reduce((sum, item) => sum + item.fault30m + item.fault60m + item.maintenance30e + item.repair30e, 0) / (l2Trend.length * 4)) : null;
  const auditPassed = statusText(audit.result).includes('PASS');
  const requiredDataLoaded = Boolean(metadata.availability !== false && Object.keys(metadata).length && Object.keys(audit).length && data.runtimeStatus);
  const funnelStage = (id: string, label: string, tone: HealthTone) => {
    const source = funnelByStage.get(id);
    const count = n(source?.count);
    const conversion = pct(source?.conversionRate);
    return { id, label, events: count, conversion, tone };
  };

  return {
    generatedAt: text(metadata.updatedAt ?? reference.generatedAt ?? audit.generatedAt, new Date().toISOString()),
    mode: 'api',
    filters: { dateRanges: ['Historical Production Range'], modelVersions: [`Candidate ${text(production.l1Candidate, 'A')} / selected L2`], runScopes: ['Validated artifact metadata'] },
    systemStatus: { mode: 'api', runtimeStatus: text(data.runtimeStatus), runtimeEnvironmentStatus: text(data.runtimeEnvironmentStatus), artifactIntegrity: text(data.artifactIntegrity), requiredDataLoaded },
    kpis: [
      { id: 'runtime', label: 'AI Runtime Status', value: text(data.runtimeStatus), detail: 'SQL and runtime readiness', tone: healthTone(data.runtimeStatus), icon: 'runtime', sparkline: [], tooltip: 'Backend readiness and runtime gates. HTTP success alone does not make this operational.' },
      { id: 'coverage', label: 'L1 Scoring Coverage', value: percentageLabel(inputRows && l1Ready != null ? l1Ready / inputRows * 100 : null), detail: inputRows == null ? 'No recent bounded run' : `${inputRows.toLocaleString('en-US')} audited input events`, tone: l1Ready == null ? 'neutral' : 'healthy', icon: 'coverage', sparkline: [], tooltip: 'Share of audited input events with an L1 scoring window.' },
      { id: 'l1-alerts', label: 'L1 Anomaly / Warning Rate', value: anomaly != null && strictWarning != null && inputRows ? `${percentageLabel(anomaly / inputRows * 100)} / ${percentageLabel(strictWarning / inputRows * 100)}` : 'Not calculated', detail: 'Anomaly / strict warning', tone: anomaly == null ? 'neutral' : 'warning', icon: 'l1', sparkline: [], tooltip: 'Rates from the latest bounded inference audit; not a machine-fault count.' },
      { id: 'l2-rate', label: 'L2 Positive Prediction Rate', value: percentageLabel(l2Rate), detail: l2Rate == null ? 'No target prediction-rate series' : 'Average across returned L2 targets', tone: l2Rate == null ? 'neutral' : 'info', icon: 'l2', sparkline: [], tooltip: 'Requires a real per-target prediction-rate series for the selected range.' },
      { id: 'calibration', label: 'Calibration & Threshold Health', value: l2Targets.length ? `${l2Targets.filter((item) => n(item.threshold) != null).length} / ${l2Targets.length}` : 'Not calculated', detail: 'Validated production thresholds', tone: l2Targets.length ? 'healthy' : 'neutral', icon: 'calibration', sparkline: [], tooltip: 'Threshold coverage from the validated model metadata JSON.' },
      { id: 'drift', label: 'Data / Feature Drift', value: 'Not calculated', detail: 'No validated drift metric published', tone: 'neutral', icon: 'drift', sparkline: [], tooltip: 'Drift is intentionally not inferred from unrelated runtime counts.' },
      { id: 'runs', label: 'Scoring Run Success Rate', value: audit.result ? (auditPassed ? '1 / 1' : '0 / 1') : 'Not calculated', detail: audit.result ? 'Latest bounded inference audit' : 'No recent bounded run', tone: audit.result ? (auditPassed ? 'healthy' : 'danger') : 'neutral', icon: 'runs', sparkline: [], tooltip: 'Success is based on the latest completed bounded inference audit.' },
    ],
    l1Candidates: l1Profiles.map((item, index) => ({
      id: text(item.id, String(index)), candidate: `Candidate ${text(item.candidate, 'A')} - ${text(item.profile)}`, production: Boolean(item.promoted), note: 'Validated model artifact metadata',
      valid: metricSet({ normalFpr: pct(item.normalFpr), knownFaultRecall: pct(item.knownFaultRecall), precision: pct(item.precision), f1: pct(item.f1), accuracy: pct(item.accuracy), auc: n(item.auroc), support: n(item.support) }),
      test: metricSet({}),
    })),
    l2Targets: l2Targets.map((item, index) => ({
      id: text(item.id, String(index)), target: text(item.label ?? item.target), tone: (item.tone as HealthTone) ?? 'neutral', profile: text(item.profile), threshold: n(item.threshold), sourceArtifact: typeof item.sourceArtifact === 'string' ? item.sourceArtifact : undefined, sourceHash: typeof item.sourceHash === 'string' ? item.sourceHash : undefined,
      valid: metricSet({ averagePrecision: pct(item.validAveragePrecision ?? item.prAuc), positiveRate: pct(item.positiveRate), support: n(item.support) }),
      test: metricSet({ averagePrecision: pct(item.testAveragePrecision ?? item.testPrAuc), f1: pct(item.testF1 ?? item.f1), auc: n(item.testAuroc ?? item.auroc), support: n(item.support) }),
    })),
    l2Trend,
    scoringFunnel: [
      funnelStage('canonicalEligible', 'Source Event Rows', 'info'), funnelStage('validFeatureEvents', 'Valid Feature Events', 'info'), funnelStage('l1WindowReady', 'L1 Window Available', 'healthy'),
      funnelStage('l1Scored', 'L1 Scored Events', 'healthy'), funnelStage('l2Scored', 'L2 Scored Events', 'warning'), funnelStage('policyReady', 'Policy Decisions', 'warning'), funnelStage('operationalAlerts', 'Operational Alerts', 'danger'),
    ],
    notScoredEvents: null,
    decisionFlow: [
      { id: 'source', step: '1', title: 'SQL / Event Stream', subtitle: 'Historical source rows', value: text(funnelByStage.get('canonicalEligible')?.count), status: contractStatus(data.runtimeStatus) === 'PASS' ? 'PASS' : 'WARNING', tone: healthTone(data.runtimeStatus), tooltip: 'Read-only SQL historical source count.' },
      { id: 'features', step: '2', title: 'Feature Builder', subtitle: 'Validated feature inputs', value: 'Not calculated', status: 'WARNING', tone: 'neutral', tooltip: 'Feature coverage is not currently published by the runtime API.' },
      { id: 'l1-model', step: '3', title: 'L1 Dual TCN Autoencoder', subtitle: 'Validated artifact profile', value: `Candidate ${text(production.l1Candidate, 'A')}`, status: l1Profiles.length ? 'PASS' : 'WARNING', tone: l1Profiles.length ? 'healthy' : 'neutral', tooltip: 'Selected L1 candidate from validated metadata.' },
      { id: 'l1-score', step: '4', title: 'L1 Behavior Deviation Score', subtitle: 'Bounded audit coverage', value: inputRows && l1Ready != null ? percentageLabel(l1Ready / inputRows * 100) : 'No recent run', status: l1Ready == null ? 'WARNING' : 'PASS', tone: l1Ready == null ? 'neutral' : 'info', tooltip: 'L1 window availability in the latest bounded audit.' },
      { id: 'l2-model', step: '5', title: 'L2 LightGBM Multi-label', subtitle: 'Validated target set', value: l2Targets.length ? `${l2Targets.length} targets` : 'Not calculated', status: l2Targets.length ? 'PASS' : 'WARNING', tone: l2Targets.length ? 'healthy' : 'neutral', tooltip: 'L2 target metadata is static validated artifact information.' },
      // The complete immutable policy identifier belongs in contextual help,
      // not the compact decision-flow card where it would overflow.
      { id: 'policy', step: '6', title: 'Policy v2 Decision Engine', subtitle: 'Read-only policy version', value: production.policyVersion || data.policyVersion ? 'Policy v2' : 'Not available', status: production.policyVersion || data.policyVersion ? 'PASS' : 'WARNING', tone: production.policyVersion || data.policyVersion ? 'warning' : 'neutral', tooltip: `Policy version used by the bounded audit: ${text(production.policyVersion ?? data.policyVersion)}. This screen cannot modify it.` },
      { id: 'alerts', step: '7', title: 'Operational Alerts & Dashboard', subtitle: 'Policy-ready events', value: text(funnelByStage.get('policyReady')?.count), status: auditPassed ? 'PASS' : 'WARNING', tone: auditPassed ? 'danger' : 'neutral', tooltip: 'Policy-ready events available for operational assessment.' },
    ],
    contractChecks: [
      { id: 'environment', check: 'Runtime Environment', status: contractStatus(data.runtimeEnvironmentStatus), value: text(data.runtimeEnvironmentStatus), trend: [], tooltip: 'Verified runtime environment compatibility.' },
      { id: 'integrity', check: 'Artifact Integrity', status: contractStatus(data.artifactIntegrity), value: text(data.artifactIntegrity), trend: [], tooltip: 'Artifact contract result from runtime lineage.' },
      { id: 'relocation', check: 'Relocation', status: contractStatus(data.relocationStatus), value: text(data.relocationStatus), trend: [], tooltip: 'Latest relocation audit result.' },
      { id: 'schema', check: 'Schema Contract', status: contractStatus(audit.liveSqlContractResult), value: text(audit.liveSqlContractResult), trend: [], tooltip: 'Schema contract result from bounded audit evidence.' },
      { id: 'features', check: 'Feature Availability', status: 'NOT_CHECKED', value: 'Not calculated', trend: [], tooltip: 'No validated aggregate feature-availability metric has been published.' },
      { id: 'missing', check: 'Missing Feature Rate', status: 'NOT_CHECKED', value: 'Not calculated', trend: [], tooltip: 'No validated missing-feature rate has been published.' },
      { id: 'alignment', check: 'Event ID Alignment', status: 'NOT_CHECKED', value: 'Not calculated', trend: [], tooltip: 'No event-ID alignment verification was returned by the audit.' },
      { id: 'window', check: 'L1 Window Availability', status: l1Ready == null || inputRows == null ? 'NOT_CHECKED' : l1Ready === inputRows ? 'PASS' : 'WARNING', value: inputRows && l1Ready != null ? percentageLabel(l1Ready / inputRows * 100) : 'Not calculated', trend: [], tooltip: 'Availability of the L1 context window in the bounded audit.' },
      { id: 'parity', check: 'SQL <-> Historical Parity', status: contractStatus(audit.historicalParityResult), value: text(audit.historicalParityResult), trend: [], tooltip: 'Historical parity check returned by the bounded audit.' },
    ],
    exampleTrace: traceFromAudit(audit),
    runtimeStrip: [
      { id: 'serving', label: 'Model Serving', value: text(data.runtimeStatus), tone: healthTone(data.runtimeStatus), icon: 'serving', tooltip: 'Runtime status from SQL-backed monitor overview.' },
      { id: 'pipeline', label: 'Feature Pipeline', value: l1Ready == null ? 'Not calculated' : 'Audit available', tone: l1Ready == null ? 'neutral' : 'healthy', icon: 'pipeline', tooltip: 'Bounded audit availability; not a synthetic pipeline health score.' },
      { id: 'database', label: 'SQL Contract', value: text(audit.liveSqlContractResult), tone: healthTone(audit.liveSqlContractResult), icon: 'database', tooltip: 'Contract evidence from the latest bounded audit.' },
      { id: 'parity', label: 'L1/L2 Parity', value: text(audit.historicalParityResult), tone: healthTone(audit.historicalParityResult), icon: 'parity', tooltip: 'Historical parity evidence, when available.' },
      { id: 'freshness', label: 'Data Freshness', value: text(audit.generatedAt), tone: audit.generatedAt ? 'info' : 'neutral', icon: 'freshness', tooltip: 'Timestamp of the latest bounded inference audit.' },
      { id: 'run', label: 'Last Production Run', value: text(audit.generatedAt), tone: auditPassed ? 'healthy' : 'neutral', icon: 'run', tooltip: 'Most recent completed bounded audit.' },
      { id: 'retrain', label: 'Last Model Retrain', value: text(metadata.updatedAt), tone: metadata.updatedAt ? 'info' : 'neutral', icon: 'retrain', tooltip: 'Validated metadata update timestamp, not an inferred training time.' },
    ],
    latestInferenceAudit: { availability: Boolean(audit.availability), result: text(audit.result, ''), inputRows, scoredRows: n(audit.scoredRows), skippedRows: n(audit.skippedRows), failedRows: n(audit.failedRows), generatedAt: audit.generatedAt ? String(audit.generatedAt) : null, sqlWrites: n(audit.sqlWrites), candidateAUsed: typeof audit.candidateAUsed === 'boolean' ? audit.candidateAUsed : null, candidateCUsed: typeof audit.candidateCUsed === 'boolean' ? audit.candidateCUsed : null },
  };
}
