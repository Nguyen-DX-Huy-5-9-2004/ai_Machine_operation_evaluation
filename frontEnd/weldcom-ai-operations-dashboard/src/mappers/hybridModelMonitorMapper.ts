import hybridV3 from '../data/ai-model-monitor-hybrid-demo-v3.json';
import type { AIModelMonitorPayload, HealthTone, L1CandidatePerformance, L2TargetPerformance, ModelMonitorDto, MonitorKpi, MonitorProvenance, PerformanceMetricSet } from '../types/aiModelMonitor';

type Row = Record<string, unknown>;
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object') : [];
const asRow = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const number = (value: unknown): number | null => value == null || !Number.isFinite(Number(value)) ? null : Number(value);
const demo = (label = 'Demo reference for presentation only', sourceType: MonitorProvenance['sourceType'] = 'DEMO_REFERENCE'): MonitorProvenance => ({ sourceType, isDemo: true, isValidated: false, sourceLabel: label, sourceArtifact: null, tooltip: `${label}. For presentation only; it never affects runtime health, inference, policy, or SQL.` });
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
    return [key, isValidated ? artifact(typeof metric.sourceArtifact === 'string' ? metric.sourceArtifact : null) : demo('Demo reference for presentation only')];
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
      detail: useRuntime ? baseItem!.detail : String(source.demoSubtitle ?? 'Demo reference'), delta: baseItem?.delta, deltaDirection: baseItem?.deltaDirection,
      tone: (baseItem?.tone ?? (index === 0 || index === 6 ? 'healthy' : index === 5 ? 'danger' : 'info')) as HealthTone,
      icon: (baseItem?.icon ?? ['runtime', 'coverage', 'l1', 'l2', 'calibration', 'drift', 'runs'][index]) as MonitorKpi['icon'],
      sparkline: rows(source.demoTrend).length ? [] : (Array.isArray(source.demoTrend) ? source.demoTrend.map(Number) : baseItem?.sparkline ?? []),
      tooltip: useRuntime ? baseItem!.tooltip : 'Demo reference for presentation only.',
      provenance: useRuntime ? runtime(sourceType === 'BOUNDED_AUDIT' ? 'Latest bounded inference audit' : 'Live SQL/runtime API', sourceType) : demo('Demo reference for presentation only'),
      valueSource: useRuntime ? runtime(sourceType === 'BOUNDED_AUDIT' ? 'Latest bounded inference audit' : 'Live SQL/runtime API', sourceType) : demo('Demo reference for presentation only'),
      trendSource: demo('Demo trend for presentation only', 'SIMULATED_VISUALIZATION'),
      scopeLabel: useRuntime ? 'Runtime or bounded audit' : 'Demo reference',
    };
  });
}

function mapL1(): L1CandidatePerformance[] {
  return rows(l1Reference.profiles).map((profile, index) => {
    const splits = asRow(profile.splits);
    return { id: String(profile.id ?? index), candidate: String(profile.name ?? profile.candidate ?? `Candidate A ${index + 1}`), note: String(profile.role ?? 'validated profile'), production: String(profile.role) === 'production_primary', provenance: { ...demo('Mixed validated and demo L1 metrics'), sourceType: 'MIXED', sourceLabel: 'Mixed sources' }, metricSources: metricSources(splits.valid), train: metrics(splits.train), valid: metrics(splits.valid), test: metrics(splits.test) };
  });
}

function mapL2(): L2TargetPerformance[] {
  return rows(l2Reference.targets).filter((target) => !/candidate.?c/i.test(String(target.id ?? target.target))).slice(0, 6).map((target, index) => {
    const splits = asRow(target.splits);
    const threshold = asRow(target.threshold);
    return { id: String(target.id ?? index), target: String(target.target ?? target.label ?? `Target ${index + 1}`), tone: (target.tone as HealthTone) ?? 'info', profile: String(target.selectedProfile ?? target.profile ?? 'Not available'), threshold: number(threshold.value ?? target.threshold), sourceArtifact: typeof target.sourceArtifact === 'string' ? target.sourceArtifact : undefined, provenance: { ...demo('Mixed validated and demo L2 metrics'), sourceType: 'MIXED', sourceLabel: 'Mixed sources' }, metricSources: metricSources(splits.valid), train: metrics(splits.train), valid: metrics(splits.valid), test: metrics(splits.test) };
  });
}

function chart(titleText: string, key: string, fallbackSource: MonitorProvenance['sourceType'] = 'SIMULATED_VISUALIZATION') {
  const source = asRow(v3Charts[key]);
  const sourceType = String(source.sourceType ?? fallbackSource);
  const demoSource = sourceType === 'DEMO_REFERENCE' || sourceType === 'SIMULATED_VISUALIZATION' ? sourceType : fallbackSource;
  const provenance = sourceType.includes('MIXED') ? { ...demo('Mixed validated and demo reference series'), sourceType: 'MIXED' as const, sourceLabel: 'Mixed sources: validation artifact plus demo reference' } : source.isDemo === false ? artifact() : demo('Demo visualization for presentation only', demoSource);
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
    return { ...(current ?? {}), id: String(fallback.id ?? current?.id ?? index), step: String(fallback.step ?? current?.step ?? index + 1), title, subtitle: useCurrent ? current!.subtitle : String(fallback.subtitle ?? 'Demo reference'), value: isPolicyNode && useCurrent ? 'Policy v2' : useCurrent ? current!.value : String(fallback.value ?? 'Not available'), status: useCurrent ? current!.status : 'REFERENCE', tone: (useCurrent ? current!.tone : fallback.tone ?? 'neutral') as HealthTone, tooltip: useCurrent ? current!.tooltip : 'Demo reference for presentation only.', provenance: useCurrent ? runtime('Runtime and audit evidence') : demo('Demo reference for presentation only') };
  });
}

function fallbackFunnel(base: ModelMonitorDto['scoringFunnel'], mode: 'mock' | 'api') {
  const fallback = rows(v3.scoringFunnelDemo);
  return fallback.map((reference, index) => {
    const current = base[index];
    const useCurrent = mode === 'api' && current?.events != null && current.conversion != null;
    return useCurrent
      ? { ...current, provenance: runtime('Live SQL scoring funnel'), scope: 'historical_full' }
      : { id: String(reference.id ?? index), label: String(reference.label ?? 'Stage'), events: number(reference.events), conversion: number(reference.conversion), tone: (reference.tone as HealthTone) ?? 'neutral', provenance: demo('Demo scoring funnel for presentation only'), scope: 'demo_reference' };
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
    return { ...current, check: String(reference.label ?? current.check), status: String(reference.status ?? 'NOT_CHECKED') as typeof current.status, value: String(reference.value ?? current.value), trend: Array.isArray(reference.trend) ? reference.trend.map(Number) : [], tooltip: 'Demo reference for presentation only.', provenance: demo('Demo feature-health reference') };
  };
  const merged = base.map(merge);
  const kwh = byId.get('kwh');
  if (kwh && !merged.some((item) => item.id === 'kwh')) merged.push({ id: 'kwh', check: String(kwh.label), status: String(kwh.status) as ModelMonitorDto['contractChecks'][number]['status'], value: String(kwh.value), trend: Array.isArray(kwh.trend) ? kwh.trend.map(Number) : [], tooltip: 'Demo KWh quality reference; no runtime endpoint is currently connected.', provenance: demo('Demo feature-health reference') });
  return merged;
}

function fallbackRuntimeStrip(base: ModelMonitorDto['runtimeStrip'], mode: 'mock' | 'api') {
  const referenceById = new Map(runtimeFooterReference.map((item) => [String(item.id), item]));
  return base.map((item) => {
    const reference = referenceById.get(item.id);
    const useCurrent = mode === 'api' && !isUnavailable(item.value);
    if (useCurrent) return { ...item, provenance: runtime('Runtime and audit evidence') };
    if (!reference) return { ...item, provenance: mode === 'api' ? runtime('Runtime and audit evidence') : demo('Demo runtime-strip reference for presentation only') };
    return {
      ...item,
      value: String(reference.value ?? item.value),
      tone: (reference.tone as HealthTone) ?? item.tone,
      tooltip: String(reference.tooltip ?? item.tooltip),
      provenance: demo('Demo runtime-strip reference for presentation only'),
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
    eventId: String(demoTrace.eventId ?? 'DEMO TRACE'), machineId: String(demoTrace.machineId ?? 'Demo machine'), eventTime: String(demoTrace.eventTime ?? ''), inputEvidence: rows(demoTrace.inputEvidence) as ModelMonitorDto['exampleTrace']['inputEvidence'], l1: rows(demoTrace.l1) as ModelMonitorDto['exampleTrace']['l1'], l2: rows(demoTrace.l2) as ModelMonitorDto['exampleTrace']['l2'], policy: rows(demoTrace.policy) as ModelMonitorDto['exampleTrace']['policy'], finalReason: String(demoTrace.finalReason ?? 'Demo explanation for presentation only.'),
  };
  return {
    ...base,
    kpis: mapV3Kpis(mode, base.kpis),
    l1Candidates: mapL1(), l2Targets: mapL2(),
    l2Trend: hasLivePrediction ? base.l2Trend : demoPrediction.series as unknown as ModelMonitorDto['l2Trend'],
    scoringFunnel: fallbackFunnel(base.scoringFunnel, mode), decisionFlow: fallbackFlow(base.decisionFlow, mode), contractChecks: fallbackContracts(base.contractChecks, mode), runtimeStrip: fallbackRuntimeStrip(base.runtimeStrip, mode), latestInferenceAudit: fallbackLatestAudit(base.latestInferenceAudit, mode), exampleTrace: trace,
    charts: {
      l1TrainingLoss: chart('L1 Train / Validation Reconstruction Loss', 'l1TrainingLoss'), l1ThresholdStability: chart('L1 Threshold Stability', 'l1ThresholdStability'), l1ScoreDistribution: chart('L1 Score Distribution by Split', 'l1ScoreDistribution'),
      l2ThresholdByTarget: chart('L2 Production Thresholds', 'l2ThresholdByTarget', 'VALIDATED_ARTIFACT'), l2ApBySplit: chart('L2 Target AP by Split', 'l2ApBySplit', 'VALIDATED_ARTIFACT'), l2AuRocF1ByTarget: chart('L2 AUROC / F1 by Target', 'l2AuRocF1ByTarget', 'VALIDATED_ARTIFACT'),
      runHealthTrend: chart('Scoring Run Success / Failure Trend', 'runHealthTrend'), featureHealthTrend: chart('Feature Availability / Missing Rate', 'featureHealthTrend'),
    },
    panelSources: {
      l1Performance: { ...demo('Mixed validated and demo L1 metrics'), sourceType: 'MIXED', sourceLabel: 'Mixed sources' },
      l2Performance: { ...demo('Mixed validated and demo L2 metrics'), sourceType: 'MIXED', sourceLabel: 'Mixed sources' },
      predictionRate: hasLivePrediction ? runtime('Live SQL prediction-rate trend') : demo('Simulated trend for presentation only', 'SIMULATED_VISUALIZATION'),
      scoringFunnel: { ...demo('Hybrid historical reference funnel'), sourceType: 'MIXED', sourceLabel: 'Mixed sources' },
      decisionFlow: { ...demo('Runtime, artifact, and reference nodes'), sourceType: 'MIXED', sourceLabel: 'Mixed sources' },
      decisionTrace: mode === 'api' && base.exampleTrace.eventId !== 'Not available' ? runtime('Latest bounded inference audit', 'BOUNDED_AUDIT') : demo('Demo decision trace for presentation only'),
      featureHealth: { ...demo('Runtime and reference contract checks'), sourceType: 'MIXED', sourceLabel: 'Mixed sources' },
      runtimeStrip: { ...demo('Runtime and reference status items'), sourceType: 'MIXED', sourceLabel: 'Mixed sources' },
      latestAudit: mode === 'api' ? runtime('Latest bounded inference audit', 'BOUNDED_AUDIT') : demo(),
    },
  };
}

export function buildMockHybridModelMonitor(base: AIModelMonitorPayload): ModelMonitorDto { return mapHybridModelMonitor(base, 'mock'); }
