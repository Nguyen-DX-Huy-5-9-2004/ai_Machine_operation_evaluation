import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { adaptApiModelMonitor } from './modelMonitorMapper';
import { mockAIModelMonitor } from '../data/mockAIModelMonitor';
import { getSystemEvaluationState } from '../components/aiModelMonitor/systemEvaluationState';
import { buildMockHybridModelMonitor, mapHybridModelMonitor } from './hybridModelMonitorMapper';
import { formatMetricValue } from '../utils/formatters';

const apiMonitor = {
  runtimeStatus: 'HEALTHY', runtimeEnvironmentStatus: 'PASS', artifactIntegrity: 'PASS', relocationStatus: 'PASS', policyVersion: 'policy_v2',
  modelMetadata: { availability: true, production: { l1Candidate: 'A', policyVersion: 'policy_v2' }, l1Profiles: [], l2Targets: [] },
  latestInferenceAudit: { availability: true, result: 'DRY_RUN_PASS', inputRows: 10, l1ReadyCount: 8, behaviorAnomalyCount: 1, strictOnlyCount: 2 },
  scoringFunnel: [{ stage: 'canonicalEligible', count: 10, conversionRate: 1 }], predictionRate: [],
};

describe('AI Model Monitor DTO parity', () => {
  it('keeps seven KPI slots and seven decision-flow stages for API data', () => {
    const dto = adaptApiModelMonitor(apiMonitor);
    expect(dto.kpis).toHaveLength(7);
    expect(dto.decisionFlow).toHaveLength(7);
    expect(dto.scoringFunnel).toHaveLength(7);
    expect(dto.l2Trend).toEqual([]);
    expect(dto.kpis.find((item) => item.id === 'l2-rate')?.value).toBe('Not calculated');
    expect(dto.scoringFunnel.find((item) => item.id === 'validFeatureEvents')?.events).toBeNull();
    expect(dto.decisionFlow.find((item) => item.id === 'policy')?.value).toBe('Policy v2');
    expect(dto.decisionFlow.find((item) => item.id === 'policy')?.tooltip).toContain('policy_v2');
  });

  it('has one shared DTO shape and keeps mock without fetch', () => {
    expect(mockAIModelMonitor.kpis).toHaveLength(7);
    expect(mockAIModelMonitor.decisionFlow).toHaveLength(7);
    const mapper = readFileSync(resolve('src/mappers/modelMonitorMapper.ts'), 'utf8');
    const mockProvider = readFileSync(resolve('src/providers/mockDataProvider.ts'), 'utf8');
    expect(mapper).not.toContain('mockAIModelMonitor');
    expect(mockProvider).not.toMatch(/fetch\(/);
  });

  it('uses red for mock, yellow before readiness, and green only for ready API data', () => {
    expect(getSystemEvaluationState(mockAIModelMonitor, false, null).tone).toBe('red');
    expect(getSystemEvaluationState(null, true, null).tone).toBe('yellow');
    expect(getSystemEvaluationState(adaptApiModelMonitor(apiMonitor), false, null).tone).toBe('green');
    expect(getSystemEvaluationState(adaptApiModelMonitor({ ...apiMonitor, artifactIntegrity: 'FAIL' }), false, null).tone).toBe('yellow');
  });

  it('keeps runtime API values while using V3 only for missing AI Monitor visualization data', () => {
    const hybrid = mapHybridModelMonitor(adaptApiModelMonitor(apiMonitor), 'api');
    expect(hybrid.kpis).toHaveLength(7);
    expect(hybrid.kpis[0].value).toBe('HEALTHY');
    expect(hybrid.l2Trend.length).toBeGreaterThan(0);
    expect(hybrid.panelSources?.predictionRate.isDemo).toBe(true);
    expect(hybrid.l1Candidates.map((item) => item.candidate)).toEqual(expect.arrayContaining(['Candidate A · lenient', 'Candidate A · strict']));
    expect(hybrid.l2Targets).toHaveLength(6);
    expect(hybrid.l2Targets.some((item) => /candidate.?c/i.test(item.target))).toBe(false);
    expect(hybrid.l1Candidates.every((item) => item.train && item.valid && item.test)).toBe(true);
  });

  it('builds the full V3 mock DTO without an API request', () => {
    const hybrid = buildMockHybridModelMonitor(mockAIModelMonitor);
    expect(hybrid.charts && Object.keys(hybrid.charts)).toHaveLength(8);
    expect(hybrid.charts?.l1TrainingLoss.seriesConfig?.[0].label).toBe('Lenient - Train');
    expect(hybrid.decisionFlow).toHaveLength(7);
    expect(hybrid.kpis.every((item) => item.provenance?.isDemo)).toBe(true);
    expect(hybrid.kpis.every((item) => item.valueSource && item.trendSource && item.scopeLabel)).toBe(true);
    expect(hybrid.runtimeStrip.some((item) => item.provenance?.isDemo)).toBe(true);
  });

  it('formats ratio metrics correctly and retains six validated production thresholds', () => {
    const hybrid = mapHybridModelMonitor(adaptApiModelMonitor(apiMonitor), 'api');
    expect(formatMetricValue(0.67, 'ratio_0_1')).toBe('67.0%');
    expect(hybrid.l2Targets.map((target) => target.threshold)).toEqual([0.13, 0.072, 0.071, 0.082, 0.109, 0.072]);
    expect(hybrid.charts).not.toHaveProperty('l2PredictionRateTrend');
    expect(hybrid.scoringFunnel.every((stage) => stage.events != null && stage.conversion != null)).toBe(true);
    expect(hybrid.decisionFlow.every((stage) => stage.provenance)).toBe(true);
  });
});
