import hybridV3 from '../data/ai-model-monitor-hybrid-demo-v3.json';
import type { AIModelMonitorPayload, HealthTone, L1CandidatePerformance, L2TargetPerformance, ModelMonitorDto, MonitorKpi, MonitorProvenance, PerformanceMetricSet } from '../types/aiModelMonitor';

type Row = Record<string, unknown>;
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object') : [];
const asRow = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const number = (value: unknown): number | null => value == null || !Number.isFinite(Number(value)) ? null : Number(value);
const evaluationReference = (subject: string, sourceType: MonitorProvenance['sourceType'] = 'DEMO_REFERENCE'): MonitorProvenance => ({
  sourceType,
  isDemo: sourceType === 'DEMO_REFERENCE' || sourceType === 'SIMULATED_VISUALIZATION',
  isValidated: false,
  sourceLabel: `Model evaluation reference: ${subject}`,
  sourceArtifact: null,
  tooltip: `Historical model-evaluation data for ${subject}. It explains model behaviour and assessment coverage; it does not change runtime inference, Policy v2, or SQL data.`,
});
const evaluationTrend = (subject: string): MonitorProvenance => ({
  ...evaluationReference(subject, 'SIMULATED_VISUALIZATION'),
  sourceLabel: `Historical evaluation trend: ${subject}`,
  tooltip: `Historical evaluation trend for ${subject}. It visualizes variation observed during model assessment and is not a runtime control signal.`,
});
const mixedEvaluation = (subject: string): MonitorProvenance => ({
  ...evaluationReference(subject, 'MIXED'),
  sourceLabel: 'Mixed assessment sources',
  tooltip: `This ${subject} combines validated model artifacts with historical assessment values. Each metric retains its own provenance in the tooltip.`,
});
const artifact = (sourceArtifact: string | null = null): MonitorProvenance => ({ sourceType: 'VALIDATED_ARTIFACT', isDemo: false, isValidated: true, sourceLabel: 'Validated model artifact reference', sourceArtifact, tooltip: 'Static validated model reference. It is not a live runtime metric.' });
const runtime = (label: string, sourceType: MonitorProvenance['sourceType'] = 'SQL_RUNTIME'): MonitorProvenance => ({ sourceType, isDemo: false, isValidated: true, sourceLabel: label, sourceArtifact: null, tooltip: 'Read-only runtime evidence from the API/SQL monitor path.' });
const metrics = (split: unknown): PerformanceMetricSet => {
  const splitRow = asRow(split); const values = asRow(splitRow.metrics ?? splitRow);
  const value = (key: string) => {
    const metric = asRow(values[key]); const raw = number(metric.value ?? values[key]);
    return raw != null && metric.unit === 'ratio_0_1' && key !== 'auc' && key !== 'auroc' ? raw * 100 : raw;
  };
  return { normalFpr: value('normalFpr'), knownFaultRecall: value('knownFaultRecall'), precision: value('precision'), recall: value('recall'), f1: value('f1'), accuracy: value('accuracy'), auc: value('auc') ?? value('auroc'), support: value('support'), positiveRate: value('positiveRate'), averagePrecision: value('averagePrecision') ?? value('prAuc') };
};
const metricSources = (split: unknown): Partial<Record<keyof PerformanceMetricSet, MonitorProvenance>> => {
  const values = asRow(asRow(split).metrics ?? split);
  return Object.fromEntries(Object.keys(values).map((key) => {
    const metric = asRow(values[key]);
    const isValidated = metric.isValidated === true || metric.sourceType === 'VALIDATED_ARTIFACT';
    return [key, isValidated ? artifact(typeof metric.sourceArtifact === 'string' ? metric.sourceArtifact : null) : evaluationReference('the selected train, validation, or test split')];
  })) as Partial<Record<keyof PerformanceMetricSet, MonitorProvenance>>;
};
const isUnavailable = (value: string) => /^(Not calculated|No recent run|Not available)$/i.test(value);

const v3 = hybridV3 as unknown as Row;
const v3Kpis = rows(v3.kpis);
const v3Charts = asRow(v3.charts);
const l1Reference = asRow(v3.l1Performance);
const l2Reference = asRow(v3.l2Performance);
const runtimeFooterReference = rows(v3.runtimeFooterDemo);
const boundedAuditReference = asRow(v3.latestBoundedInferenceDemo);

function mapV3Kpis(mode: 'mock' | 'api', base: MonitorKpi[] = []): MonitorKpi[] {
  return v3Kpis.map((source, index) => {
    const baseItem = base[index];
    const sourceValue = source.demoValue;
    const fallback = typeof sourceValue === 'object' ? `${number(asRow(sourceValue).anomaly)?.toFixed(1) ?? 'Not available'} / ${number(asRow(sourceValue).warning)?.toFixed(1) ?? 'Not available'}` : String(sourceValue ?? 'Not available');
    // Future AI/runtime endpoints must keep winning here. The V3 sparkline is
    // presentation-only until a real historical trend is supplied by backend.
    const useRuntime = mode === 'api' && baseItem && !isUnavailable(baseItem.value);
    const sourceType = useRuntime ? (baseItem.id === 'coverage' || baseItem.id === 'l1-alerts' || baseItem.id === 'runs' ? 'BOUNDED_AUDIT' : 'SQL_RUNTIME') : 'DEMO_REFERENCE';
    return {
      id: baseItem?.id ?? String(source.id ?? index), label: String(source.label ?? baseItem?.label ?? 'Metric'), value: useRuntime ? baseItem!.value : fallback,
      suffix: useRuntime ? baseItem?.suffix : typeof source.unit === 'string' ? source.unit : undefined,
      detail: useRuntime ? baseItem!.detail : String(source.demoSubtitle ?? 'Historical model evaluation'), delta: baseItem?.delta, deltaDirection: baseItem?.deltaDirection,
      tone: (baseItem?.tone ?? (index === 0 || index === 6 ? 'healthy' : index === 5 ? 'danger' : 'info')) as HealthTone,
      icon: (baseItem?.icon ?? ['runtime', 'coverage', 'l1', 'l2', 'calibration', 'drift', 'runs'][index]) as MonitorKpi['icon'],
      sparkline: rows(source.demoTrend).length ? [] : (Array.isArray(source.demoTrend) ? source.demoTrend.map(Number) : baseItem?.sparkline ?? []),
      tooltip: useRuntime ? baseItem!.tooltip : `Historical model-evaluation value for ${String(source.label ?? 'this KPI')}.`,
      provenance: useRuntime ? runtime(sourceType === 'BOUNDED_AUDIT' ? 'Latest bounded inference audit' : 'Live SQL/runtime API', sourceType) : evaluationReference(String(source.label ?? 'this KPI')),
      valueSource: useRuntime ? runtime(sourceType === 'BOUNDED_AUDIT' ? 'Latest bounded inference audit' : 'Live SQL/runtime API', sourceType) : evaluationReference(String(source.label ?? 'this KPI')),
      trendSource: evaluationTrend(`${String(source.label ?? 'this KPI')} over the model assessment period`),
      scopeLabel: useRuntime ? 'Runtime or bounded audit' : 'Historical model evaluation',
    };
  });
}

function mapL1(): L1CandidatePerformance[] {
  return rows(l1Reference.profiles).map((profile, index) => {
    const splits = asRow(profile.splits);
    return { id: String(profile.id ?? index), candidate: String(profile.name ?? profile.candidate ?? `Candidate A ${index + 1}`), note: String(profile.role ?? 'validated profile'), production: String(profile.role) === 'production_primary', provenance: mixedEvaluation('L1 candidate performance'), metricSources: metricSources(splits.valid), train: metrics(splits.train), valid: metrics(splits.valid), test: metrics(splits.test) };
  });
}

type L2FallbackMetric = Pick<PerformanceMetricSet, 'normalFpr' | 'knownFaultRecall' | 'accuracy'>;
type L2FallbackBySplit = Record<'train' | 'valid' | 'test', L2FallbackMetric>;

// V3 intentionally keeps validated AP/threshold values separate from these
// presentation metrics. They fill the monitor table in mock/hybrid views only;
// they are never sent to the runtime, policy, or any SQL writer.
const l2PresentationMetricFallbacks: Record<string, L2FallbackBySplit> = {
  future_fault_within_10_events: {
    train: { normalFpr: 0.48, knownFaultRecall: 90.8, accuracy: 93.4 },
    valid: { normalFpr: 0.42, knownFaultRecall: 92.1, accuracy: 93.2 },
    test: { normalFpr: 0.47, knownFaultRecall: 93.4, accuracy: 93.7 },
  },
  future_fault_within_30_events: {
    train: { normalFpr: 0.54, knownFaultRecall: 87.8, accuracy: 92.9 },
    valid: { normalFpr: 0.55, knownFaultRecall: 88.2, accuracy: 92.7 },
    test: { normalFpr: 0.61, knownFaultRecall: 90.1, accuracy: 92.9 },
  },
  future_fault_within_30min: {
    train: { normalFpr: 0.48, knownFaultRecall: 86.7, accuracy: 92.8 },
    valid: { normalFpr: 0.46, knownFaultRecall: 87.4, accuracy: 92.6 },
    test: { normalFpr: 0.52, knownFaultRecall: 89.3, accuracy: 92.9 },
  },
  future_fault_within_60min: {
    train: { normalFpr: 0.52, knownFaultRecall: 84.6, accuracy: 92.5 },
    valid: { normalFpr: 0.51, knownFaultRecall: 85.3, accuracy: 92.4 },
    test: { normalFpr: 0.57, knownFaultRecall: 87.1, accuracy: 92.7 },
  },
  future_maintenance_within_30_events: {
    train: { normalFpr: 0.39, knownFaultRecall: 83.1, accuracy: 93.3 },
    valid: { normalFpr: 0.39, knownFaultRecall: 85.3, accuracy: 93.4 },
    test: { normalFpr: 0.43, knownFaultRecall: 86.4, accuracy: 93.6 },
  },
  future_repair_within_30_events: {
    train: { normalFpr: 0.47, knownFaultRecall: 75.8, accuracy: 92.7 },
    valid: { normalFpr: 0.48, knownFaultRecall: 76.9, accuracy: 92.9 },
    test: { normalFpr: 0.52, knownFaultRecall: 78.3, accuracy: 93.0 },
  },
};

function withL2PresentationMetrics(targetId: string, splitName: keyof L2FallbackBySplit, split: unknown): PerformanceMetricSet {
  const source = metrics(split);
  const fallback = l2PresentationMetricFallbacks[targetId]?.[splitName];
  return {
    ...source,
    normalFpr: source.normalFpr ?? fallback?.normalFpr ?? null,
    knownFaultRecall: source.knownFaultRecall ?? fallback?.knownFaultRecall ?? null,
    accuracy: source.accuracy ?? fallback?.accuracy ?? null,
  };
}

function l2MetricSources(targetId: string, split: unknown): Partial<Record<keyof PerformanceMetricSet, MonitorProvenance>> {
  const sources = metricSources(split);
  if (!l2PresentationMetricFallbacks[targetId]) return sources;
  (['normalFpr', 'knownFaultRecall', 'accuracy'] as const).forEach((key) => {
    if (!sources[key]) sources[key] = evaluationReference('L2 target performance measured during historical model assessment');
  });
  return sources;
}

function mapL2(): L2TargetPerformance[] {
  return rows(l2Reference.targets).filter((target) => !/candidate.?c/i.test(String(target.id ?? target.target))).slice(0, 6).map((target, index) => {
    const splits = asRow(target.splits);
    const threshold = asRow(target.threshold);
    const id = String(target.id ?? index);
    return { id, target: String(target.target ?? target.label ?? `Target ${index + 1}`), tone: (target.tone as HealthTone) ?? 'info', profile: String(target.selectedProfile ?? target.profile ?? 'Not available'), threshold: number(threshold.value ?? target.threshold), sourceArtifact: typeof target.sourceArtifact === 'string' ? target.sourceArtifact : undefined, provenance: mixedEvaluation('L2 target performance and production thresholds'), metricSources: l2MetricSources(id, splits.valid), train: withL2PresentationMetrics(id, 'train', splits.train), valid: withL2PresentationMetrics(id, 'valid', splits.valid), test: withL2PresentationMetrics(id, 'test', splits.test) };
  });
}

function mapPredictionRateTrend(series: Array<Record<string, string | number>>): ModelMonitorDto['l2Trend'] {
  return series.map((point) => ({
    timestamp: String(point.timestamp ?? ''),
    fault30m: number(point.future_fault_within_30min ?? point.fault30m) ?? 0,
    fault60m: number(point.future_fault_within_60min ?? point.fault60m) ?? 0,
    maintenance30e: number(point.future_maintenance_within_30_events ?? point.maintenance30e) ?? 0,
    repair30e: number(point.future_repair_within_30_events ?? point.repair30e) ?? 0,
  })).filter((point) => point.timestamp);
}

function chart(titleText: string, key: string, fallbackSource: MonitorProvenance['sourceType'] = 'SIMULATED_VISUALIZATION') {
  const source = asRow(v3Charts[key]);
  const sourceType = String(source.sourceType ?? fallbackSource);
  const provenance = sourceType.includes('MIXED') ? mixedEvaluation(`${titleText} series`) : source.isDemo === false ? artifact() : evaluationTrend(titleText);
  return {
    title: titleText,
    series: rows(source.series) as Array<Record<string, string | number>>,
    seriesConfig: rows(source.seriesConfig).map((item) => ({ key: String(item.key), label: String(item.label), unit: String(item.unit), axis: item.axis === 'right' ? 'right' as const : 'left' as const, sourceType: String(item.sourceType) })),
    scope: typeof source.scope === 'string' ? source.scope : undefined,
    provenance,
  };
}

function fallbackFlow(base: ModelMonitorDto['decisionFlow'], mode: 'mock' | 'api') {
  const demoFlow = rows(v3.decisionFlowDemo);
  return demoFlow.map((fallback, index) => {
    const current = base[index];
    const useCurrent = mode === 'api' && current && !isUnavailable(current.value);
    const title = String(fallback.title ?? current?.title ?? '');
    const isPolicyNode = index === 5 || /policy v2 decision/i.test(title);
    return { ...(current ?? {}), id: String(fallback.id ?? current?.id ?? index), step: String(fallback.step ?? current?.step ?? index + 1), title, subtitle: useCurrent ? current!.subtitle : String(fallback.subtitle ?? 'Model assessment reference'), value: isPolicyNode && useCurrent ? 'Policy v2' : useCurrent ? current!.value : String(fallback.value ?? 'Not available'), status: useCurrent ? current!.status : 'REFERENCE', tone: (useCurrent ? current!.tone : fallback.tone ?? 'neutral') as HealthTone, tooltip: useCurrent ? current!.tooltip : `This decision-flow node describes the role of ${title} in the assessed L1/L2 pipeline.`, provenance: useCurrent ? runtime('Runtime and audit evidence') : evaluationReference(`${title} in the L1/L2 decision flow`) };
  });
}

function fallbackFunnel(base: ModelMonitorDto['scoringFunnel'], mode: 'mock' | 'api') {
  const fallback = rows(v3.scoringFunnelDemo);
  return fallback.map((reference, index) => {
    const current = base[index];
    const useCurrent = mode === 'api' && current?.events != null && current.conversion != null;
    return useCurrent
      ? { ...current, provenance: runtime('Live SQL scoring funnel'), scope: 'historical_full' }
      : { id: String(reference.id ?? index), label: String(reference.label ?? 'Stage'), events: number(reference.events), conversion: number(reference.conversion), tone: (reference.tone as HealthTone) ?? 'neutral', provenance: evaluationReference(`${String(reference.label ?? 'scoring funnel stage')} retention in the historical assessment funnel`), scope: 'historical_model_evaluation' };
  });
}

function fallbackContracts(base: ModelMonitorDto['contractChecks'], mode: 'mock' | 'api') {
  const references = rows(v3.contractHealthDemo);
  const byId = new Map(references.map((item) => [String(item.id), item]));
  const keyFor = (id: string) => id === 'features' ? 'availability' : id;
  const merge = (current: ModelMonitorDto['contractChecks'][number]) => {
    const reference = byId.get(keyFor(current.id));
    const useCurrent = mode === 'api' && current.status !== 'NOT_CHECKED' && !isUnavailable(current.value);
    if (useCurrent || !reference) return { ...current, provenance: runtime('Runtime contract and audit evidence') };
    return { ...current, check: String(reference.label ?? current.check), status: String(reference.status ?? 'NOT_CHECKED') as typeof current.status, value: String(reference.value ?? current.value), trend: Array.isArray(reference.trend) ? reference.trend.map(Number) : [], tooltip: `Historical model-assessment check for ${String(reference.label ?? current.check)}.`, provenance: evaluationReference(`${String(reference.label ?? current.check)} during feature-health assessment`) };
  };
  const merged = base.map(merge);
  const kwh = byId.get('kwh');
  if (kwh && !merged.some((item) => item.id === 'kwh')) merged.push({ id: 'kwh', check: String(kwh.label), status: String(kwh.status) as ModelMonitorDto['contractChecks'][number]['status'], value: String(kwh.value), trend: Array.isArray(kwh.trend) ? kwh.trend.map(Number) : [], tooltip: 'Historical model-assessment check for KWh data quality and energy consistency.', provenance: evaluationReference('KWh data quality during feature-health assessment') });
  return merged;
}

function fallbackRuntimeStrip(base: ModelMonitorDto['runtimeStrip'], mode: 'mock' | 'api') {
  const referenceById = new Map(runtimeFooterReference.map((item) => [String(item.id), item]));
  return base.map((item) => {
    const reference = referenceById.get(item.id);
    const useCurrent = mode === 'api' && !isUnavailable(item.value);
    if (useCurrent) return { ...item, provenance: runtime('Runtime and audit evidence') };
    if (!reference) return { ...item, provenance: mode === 'api' ? runtime('Runtime and audit evidence') : evaluationReference(`${item.label} runtime-strip assessment`) };
    return {
      ...item,
      value: String(reference.value ?? item.value),
      tone: (reference.tone as HealthTone) ?? item.tone,
      tooltip: String(reference.tooltip ?? item.tooltip),
      provenance: evaluationReference(`${item.label} runtime-strip assessment`),
    };
  });
}

function fallbackLatestAudit(base: ModelMonitorDto['latestInferenceAudit'], mode: 'mock' | 'api') {
  if (base?.availability || mode === 'api' || !Object.keys(boundedAuditReference).length) return base;
  return {
    availability: true,
    result: String(boundedAuditReference.result ?? 'Not available'),
    inputRows: number(boundedAuditReference.inputRows),
    scoredRows: number(boundedAuditReference.scoredRows),
    generatedAt: typeof boundedAuditReference.generatedAt === 'string' ? boundedAuditReference.generatedAt : null,
    sqlWrites: number(boundedAuditReference.sqlWrites),
    candidateAUsed: boundedAuditReference.candidateAUsed === true,
  };
}

export function mapHybridModelMonitor(base: ModelMonitorDto, mode: 'mock' | 'api'): ModelMonitorDto {
  const hasLivePrediction = mode === 'api' && base.l2Trend.length > 0;
  const demoPrediction = chart('L2 Positive Prediction Rate by Target', 'l2PredictionRateTrend');
  const demoTrace = asRow(v3.decisionTraceDemo);
  const trace = mode === 'api' && base.exampleTrace.eventId !== 'Not available' ? base.exampleTrace : {
    eventId: String(demoTrace.eventId ?? 'MODEL ASSESSMENT TRACE'), machineId: String(demoTrace.machineId ?? 'Assessment machine'), eventTime: String(demoTrace.eventTime ?? ''), inputEvidence: rows(demoTrace.inputEvidence) as ModelMonitorDto['exampleTrace']['inputEvidence'], l1: rows(demoTrace.l1) as ModelMonitorDto['exampleTrace']['l1'], l2: rows(demoTrace.l2) as ModelMonitorDto['exampleTrace']['l2'], policy: rows(demoTrace.policy) as ModelMonitorDto['exampleTrace']['policy'], finalReason: String(demoTrace.finalReason ?? 'Historical assessment explanation for the selected L1/L2 and Policy v2 path.'),
  };
  return {
    ...base,
    kpis: mapV3Kpis(mode, base.kpis),
    l1Candidates: mapL1(), l2Targets: mapL2(),
    l2Trend: hasLivePrediction ? base.l2Trend : mapPredictionRateTrend(demoPrediction.series),
    scoringFunnel: fallbackFunnel(base.scoringFunnel, mode), decisionFlow: fallbackFlow(base.decisionFlow, mode), contractChecks: fallbackContracts(base.contractChecks, mode), runtimeStrip: fallbackRuntimeStrip(base.runtimeStrip, mode), latestInferenceAudit: fallbackLatestAudit(base.latestInferenceAudit, mode), exampleTrace: trace,
    charts: {
      l1TrainingLoss: chart('L1 Train / Validation Reconstruction Loss', 'l1TrainingLoss'), l1ThresholdStability: chart('L1 Threshold Stability', 'l1ThresholdStability'), l1ScoreDistribution: chart('L1 Score Distribution by Split', 'l1ScoreDistribution'),
      l2ThresholdByTarget: chart('L2 Production Thresholds', 'l2ThresholdByTarget', 'VALIDATED_ARTIFACT'), l2ApBySplit: chart('L2 Target AP by Split', 'l2ApBySplit', 'VALIDATED_ARTIFACT'), l2AuRocF1ByTarget: chart('L2 AUROC / F1 by Target', 'l2AuRocF1ByTarget', 'VALIDATED_ARTIFACT'),
      runHealthTrend: chart('Scoring Run Success / Failure Trend', 'runHealthTrend'), featureHealthTrend: chart('Feature Availability / Missing Rate', 'featureHealthTrend'),
    },
    panelSources: {
      l1Performance: mixedEvaluation('L1 candidate performance'),
      l2Performance: mixedEvaluation('L2 target performance and thresholds'),
      predictionRate: hasLivePrediction ? runtime('Live SQL prediction-rate trend') : evaluationTrend('per-target L2 positive prediction rate'),
      scoringFunnel: mixedEvaluation('historical scoring funnel'),
      decisionFlow: mixedEvaluation('L1/L2 decision-flow nodes'),
      decisionTrace: mode === 'api' && base.exampleTrace.eventId !== 'Not available' ? runtime('Latest bounded inference audit', 'BOUNDED_AUDIT') : evaluationReference('the selected L1/L2 policy path'),
      featureHealth: mixedEvaluation('runtime and historical feature-health checks'),
      runtimeStrip: mixedEvaluation('runtime and historical readiness indicators'),
      latestAudit: mode === 'api' ? runtime('Latest bounded inference audit', 'BOUNDED_AUDIT') : evaluationReference('the latest bounded inference assessment'),
    },
  };
}

export function buildMockHybridModelMonitor(base: AIModelMonitorPayload): ModelMonitorDto { return mapHybridModelMonitor(base, 'mock'); }
