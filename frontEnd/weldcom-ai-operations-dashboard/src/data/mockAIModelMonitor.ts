import type { AIModelMonitorPayload, HealthTone } from '../types/aiModelMonitor';
import modelMetadata from './modelMonitorMetadata.json';

const trendTimes = [
  'May 12 00:00', 'May 12 08:00', 'May 12 16:00', 'May 13 00:00',
  'May 13 08:00', 'May 13 16:00', 'May 14 00:00', 'May 14 08:00',
  'May 14 16:00', 'May 15 00:00', 'May 15 08:00', 'May 15 16:00',
  'May 16 00:00', 'May 16 08:00', 'May 16 16:00', 'May 17 00:00',
  'May 17 08:00', 'May 17 16:00', 'May 18 00:00',
];

export const mockAIModelMonitor: AIModelMonitorPayload = {
  generatedAt: '2026-07-20T08:24:37+07:00',
  mode: 'mock',
  systemStatus: { mode: 'mock', requiredDataLoaded: true },
  filters: {
    dateRanges: ['May 12 – May 18, 2025', 'Last 24 Hours', 'Last 7 Days', 'Last 30 Days'],
    modelVersions: ['All Model Versions', 'v4.2.1 — Production', 'v4.2.0', 'v4.1.9'],
    runScopes: ['All Runs', 'Production Runs', 'Candidate Runs', 'Failed / Warning Runs'],
  },
  kpis: [
    {
      id: 'runtime', label: 'AI Runtime Status', value: 'Healthy', detail: 'All systems operational',
      tone: 'healthy', icon: 'runtime', sparkline: [8, 8, 9, 8, 10, 8, 9, 9, 8],
      tooltip: 'Tổng hợp trạng thái model serving, feature pipeline, SQL contract và scoring runtime.',
    },
    {
      id: 'coverage', label: 'L1 Scoring Coverage', value: '98.6', suffix: '%', detail: 'Scored / eligible events',
      delta: '0.6 pp vs last 7 days', deltaDirection: 'up', tone: 'info', icon: 'coverage',
      sparkline: [96.1, 96.8, 97.2, 97.0, 97.8, 98.0, 97.7, 98.4, 98.6],
      tooltip: 'Tỷ lệ event hợp lệ được tạo đủ window và nhận điểm L1.',
    },
    {
      id: 'l1rate', label: 'L1 Alert Rate', value: '2.4 / 6.1', suffix: '%', detail: 'Lenient anomaly / strict warning',
      delta: '0.6 pp / 0.4 pp vs last 7 days', deltaDirection: 'down', tone: 'info', icon: 'l1',
      sparkline: [2.9, 2.6, 2.8, 2.5, 2.7, 2.3, 2.5, 2.2, 2.4],
      tooltip: 'Lenient là cảnh báo production; strict là tín hiệu nhạy để theo dõi sớm.',
    },
    {
      id: 'l2rate', label: 'L2 Positive Prediction Rate', value: '18.7', suffix: '%', detail: 'All active L2 targets',
      delta: '1.3 pp vs last 7 days', deltaDirection: 'up', tone: 'info', icon: 'l2',
      sparkline: [16.1, 16.8, 17.4, 16.9, 17.8, 18.2, 17.6, 18.4, 18.7],
      tooltip: 'Tỷ lệ dự đoán dương tính tổng hợp trên các target fault, maintenance và repair.',
    },
    {
      id: 'calibration', label: 'Calibration & Threshold Health', value: '94.2', suffix: '/100', detail: 'Production threshold profile',
      delta: '2.6 vs last 7 days', deltaDirection: 'up', tone: 'warning', icon: 'calibration',
      sparkline: [90, 91, 90.5, 92, 91.3, 93, 92.1, 93.6, 94.2],
      tooltip: 'Sức khỏe hiệu chỉnh xác suất và threshold đang áp dụng cho production policy.',
    },
    {
      id: 'drift', label: 'Data / Feature Drift Score', value: '16.3', suffix: '/100', detail: 'Lower is better',
      delta: '7.2 vs last 7 days', deltaDirection: 'down', tone: 'danger', icon: 'drift',
      sparkline: [24, 22, 23, 20, 19, 21, 17, 18, 16.3],
      tooltip: 'Điểm drift tổng hợp từ source, feature, score, prediction và chất lượng KWh.',
    },
    {
      id: 'runs', label: 'Scoring Run Success Rate', value: '98.1', suffix: '%', detail: '47 success / 48 runs',
      delta: '1.7 pp vs last 7 days', deltaDirection: 'up', tone: 'healthy', icon: 'runs',
      sparkline: [95, 96.5, 96, 97.2, 96.8, 97.5, 98, 97.8, 98.1],
      tooltip: 'Tỷ lệ scoring run hoàn thành thành công trong phạm vi thời gian đã chọn.',
    },
  ],
  l1Candidates: [
    {
      id: 'A', candidate: 'A – model hiện tại', note: 'Lenient – Production', production: true,
      valid: { normalFpr: 4.12, knownFaultRecall: 94.08, precision: 5.84, f1: 11.00, accuracy: 93.24, auc: 0.91, support: 224310 },
      test: { normalFpr: 3.79, knownFaultRecall: 99.47, precision: 7.01, f1: 13.09, accuracy: 94.02, auc: 0.94, support: 240816 },
    },
    {
      id: 'B', candidate: 'B – chỉ đổi threshold', note: 'Threshold-only candidate',
      valid: { normalFpr: 0.013, knownFaultRecall: 7.55, precision: 14.45, f1: 9.92, accuracy: 98.72, auc: 0.66, support: 224310 },
      test: { normalFpr: 0.024, knownFaultRecall: 8.08, precision: 5.52, f1: 6.56, accuracy: 98.51, auc: 0.68, support: 240816 },
    },
    {
      id: 'C', candidate: 'C – model train mới', note: 'Candidate retrain',
      valid: { normalFpr: 1.48, knownFaultRecall: 75.71, precision: 11.29, f1: 19.65, accuracy: 96.82, auc: 0.89, support: 224310 },
      test: { normalFpr: 2.29, knownFaultRecall: 79.09, precision: 8.35, f1: 15.11, accuracy: 95.96, auc: 0.90, support: 240816 },
    },
  ],
  l2Targets: [
    {
      id: 'fault30', target: 'Fault within 30 min', tone: 'danger',
      valid: { positiveRate: 19.2, normalFpr: 0.42, knownFaultRecall: 92.10, precision: 9.28, f1: 16.52, accuracy: 93.18, auc: 0.97, support: 764118 },
      test: { positiveRate: 18.6, normalFpr: 0.47, knownFaultRecall: 94.31, precision: 10.21, f1: 18.58, accuracy: 93.66, auc: 0.97, support: 812334 },
    },
    {
      id: 'fault60', target: 'Fault within 60 min', tone: 'warning',
      valid: { positiveRate: 16.5, normalFpr: 0.55, knownFaultRecall: 89.22, precision: 8.74, f1: 15.78, accuracy: 92.74, auc: 0.95, support: 812334 },
      test: { positiveRate: 16.1, normalFpr: 0.61, knownFaultRecall: 90.85, precision: 9.12, f1: 16.54, accuracy: 92.90, auc: 0.95, support: 846120 },
    },
    {
      id: 'maintenance', target: 'Maintenance 30 events', tone: 'healthy',
      valid: { positiveRate: 14.7, normalFpr: 0.39, knownFaultRecall: 85.33, precision: 8.63, f1: 15.38, accuracy: 93.42, auc: 0.93, support: 701220 },
      test: { positiveRate: 14.1, normalFpr: 0.43, knownFaultRecall: 86.42, precision: 8.95, f1: 15.96, accuracy: 93.57, auc: 0.93, support: 728440 },
    },
    {
      id: 'repair', target: 'Repair 30 events', tone: 'info',
      valid: { positiveRate: 11.1, normalFpr: 0.48, knownFaultRecall: 76.88, precision: 7.68, f1: 13.98, accuracy: 92.88, auc: 0.90, support: 612004 },
      test: { positiveRate: 10.8, normalFpr: 0.52, knownFaultRecall: 78.31, precision: 7.92, f1: 14.39, accuracy: 93.01, auc: 0.90, support: 635118 },
    },
  ],
  l2Trend: trendTimes.map((timestamp, index) => ({
    timestamp,
    fault30m: [22, 25, 29, 26, 31, 35, 30, 32, 38, 31, 36, 40, 32, 35, 29, 31, 34, 30, 28][index],
    fault60m: [12, 14, 18, 16, 19, 24, 20, 21, 27, 19, 23, 28, 20, 22, 17, 18, 21, 17, 15][index],
    maintenance30e: [8, 9, 11, 10, 12, 16, 13, 14, 18, 12, 15, 19, 13, 14, 11, 12, 14, 11, 10][index],
    repair30e: [4, 5, 7, 6, 8, 11, 8, 9, 12, 7, 10, 13, 8, 9, 6, 7, 8, 6, 5][index],
  })),
  decisionFlow: [
    { id: 'source', step: '1', title: 'SQL / Event Stream', subtitle: 'Source watermark', value: '10:24 AM', status: 'PASS', tone: 'info', tooltip: 'Raw machine event stream and source watermark.' },
    { id: 'features', step: '2', title: 'Feature Builder', subtitle: 'Feature coverage', value: '98.6%', status: 'PASS', tone: 'info', tooltip: 'Builds event, context, status, timing, KWh and quality features.' },
    { id: 'l1', step: '3', title: 'L1 Dual TCN Autoencoder', subtitle: 'Window 20 events', value: 'Lenient + Strict', status: 'PASS', tone: 'info', tooltip: 'Detects behavioral deviation from the normal operating baseline.' },
    { id: 'l1score', step: '4', title: 'L1 Behavior Deviation Score', subtitle: 'Scored events', value: '3,770,419', status: 'PASS', tone: 'info', tooltip: 'Produces production anomaly and sensitive-warning signals.' },
    { id: 'l2', step: '5', title: 'L2 LightGBM Multi-label', subtitle: 'Active targets', value: '4 targets', status: 'PASS', tone: 'healthy', tooltip: 'Validates deviations into fault, maintenance and repair risks.' },
    { id: 'policy', step: '6', title: 'Policy v2 Decision Engine', subtitle: 'Action & reason', value: 'Generated', status: 'PASS', tone: 'warning', tooltip: 'Separates operational and quality decisions and generates final reasons.' },
    { id: 'output', step: '7', title: 'Operational Alerts & Dashboard', subtitle: 'High / Critical', value: '2,059', status: 'PASS', tone: 'danger', tooltip: 'Publishes actionable alerts and dashboard event outputs.' },
  ],
  scoringFunnel: [
    { id: 'raw', label: 'Raw Events', events: 4062118, conversion: 100, tone: 'info' },
    { id: 'valid', label: 'Valid Feature Events', events: 3980221, conversion: 98.0, tone: 'info' },
    { id: 'window', label: 'L1 Window Available', events: 3821564, conversion: 93.1, tone: 'healthy' },
    { id: 'l1', label: 'L1 Scored Events', events: 3770419, conversion: 92.8, tone: 'healthy' },
    { id: 'l2', label: 'L2 Scored Events', events: 3635210, conversion: 89.5, tone: 'warning' },
    { id: 'policy', label: 'Policy Decisions', events: 3335882, conversion: 82.1, tone: 'warning' },
    { id: 'alerts', label: 'Operational Alerts', events: 2059, conversion: 2.4, tone: 'danger' },
  ],
  notScoredEvents: 291699,
  contractChecks: [
    { id: 'schema', check: 'Schema Contract', status: 'PASS', value: '100% match', trend: [100, 100, 100, 100, 100, 100, 100], tooltip: 'Expected SQL/API schema fields are present and type-compatible.' },
    { id: 'availability', check: 'Feature Availability', status: 'PASS', value: '98.6%', trend: [97.4, 97.8, 98.1, 98.0, 98.4, 98.5, 98.6], tooltip: 'Share of required features available after preprocessing.' },
    { id: 'missing', check: 'Missing Feature Rate', status: 'WARNING', value: '1.4%', trend: [2.1, 1.9, 1.7, 1.8, 1.5, 1.6, 1.4], tooltip: 'Missing values after source and feature-builder processing.' },
    { id: 'event', check: 'Event ID Alignment', status: 'PASS', value: '99.8%', trend: [99.4, 99.5, 99.6, 99.6, 99.7, 99.8, 99.8], tooltip: 'One-to-one alignment between source event, L1 result and L2/policy output.' },
    { id: 'window', check: 'Window Availability', status: 'PASS', value: '93.1%', trend: [91.8, 92.0, 92.4, 92.6, 92.9, 93.0, 93.1], tooltip: 'Events having the required 20-event L1 context window.' },
    { id: 'parity', check: 'SQL ↔ Historical Parity', status: 'PASS', value: 'Δ 0.32%', trend: [0.62, 0.55, 0.48, 0.44, 0.40, 0.35, 0.32], tooltip: 'Difference between online SQL feature output and historical/offline pipeline.' },
    { id: 'watermark', check: 'Source Watermark Lag', status: 'PASS', value: '2m 14s', trend: [5.1, 4.6, 4.1, 3.4, 3.0, 2.6, 2.23], tooltip: 'Delay from newest source event to monitor refresh.' },
    { id: 'kwh', check: 'KWh Data Quality', status: 'WARNING', value: 'Moderate', trend: [42, 44, 40, 47, 43, 46, 45], tooltip: 'KWh availability, imputation, negative delta and loaded-zero consistency checks.' },
  ],
  exampleTrace: {
    eventId: 'E-20250516-102410-12345', machineId: 'WC-047', eventTime: 'May 16, 10:24:10 AM',
    inputEvidence: [
      { label: 'Status', value: 'Fault', tone: 'danger' },
      { label: 'Gap from previous', value: '00:01:05', tone: 'warning' },
      { label: 'KWh delta', value: '+48.2 kWh', tone: 'warning' },
      { label: 'KWh rate', value: '12.4 kWh/h', tone: 'warning' },
      { label: 'Loaded status', value: 'ON (Loaded)', tone: 'healthy' },
      { label: 'Data quality', value: 'Moderate', tone: 'warning' },
    ],
    l1: [
      { label: 'Lenient score', value: '0.89', tone: 'danger' },
      { label: 'Strict score', value: '0.76', tone: 'warning' },
      { label: 'Lenient threshold', value: '0.64' },
      { label: 'Strict threshold', value: '0.64' },
      { label: 'Decision', value: 'Anomaly', tone: 'danger' },
    ],
    l2: [
      { label: 'Fault 30min', value: '92%', tone: 'danger' },
      { label: 'Fault 60min', value: '76%', tone: 'warning' },
      { label: 'Maintenance', value: '68%', tone: 'warning' },
      { label: 'Repair', value: '63%', tone: 'warning' },
      { label: 'Max risk', value: '92%', tone: 'danger' },
    ],
    policy: [
      { label: 'Operational level', value: 'CRITICAL', tone: 'danger' },
      { label: 'Quality level', value: 'CHECK_DATA', tone: 'warning' },
      { label: 'Judgment', value: 'Stop Production', tone: 'danger' },
    ],
    finalReason: 'High energy spike with abnormal sensor readings and repeated fault evidence.',
  },
  runtimeStrip: [
    { id: 'serving', label: 'Model Serving', value: 'Operational', tone: 'healthy', icon: 'serving', tooltip: 'Online/offline scoring service health.' },
    { id: 'pipeline', label: 'Feature Pipeline', value: 'Healthy', tone: 'healthy', icon: 'pipeline', tooltip: 'Feature builder and preprocessing runtime status.' },
    { id: 'sql', label: 'SQL Contract', value: 'Pass', tone: 'healthy', icon: 'database', tooltip: 'SQL source schema and contract validation.' },
    { id: 'parity', label: 'L1/L2 Parity', value: 'Pass (Δ 0.32%)', tone: 'healthy', icon: 'parity', tooltip: 'Parity between offline artifacts and runtime scoring path.' },
    { id: 'freshness', label: 'Data Freshness', value: '2m 14s lag', tone: 'healthy', icon: 'freshness', tooltip: 'Current source watermark delay.' },
    { id: 'run', label: 'Last Production Run', value: 'May 16, 10:23 AM', tone: 'info', icon: 'run', tooltip: 'Most recent successful production scoring run.' },
    { id: 'retrain', label: 'Last Model Retrain', value: 'May 16, 11:42 PM', tone: 'info', icon: 'retrain', tooltip: 'Most recent completed model retraining.' },
    { id: 'next', label: 'Next Scheduled Retrain', value: 'May 20, 02:00 AM', tone: 'warning', icon: 'retrain', tooltip: 'Next planned retraining window.' },
  ],
};

// The mock screen consumes the exact same production metadata JSON as API mode.
// Dynamic charts remain demo fixtures; static model identity and artifact metrics do not.
mockAIModelMonitor.l1Candidates = modelMetadata.l1Profiles.map((profile) => ({
  id: profile.id,
  candidate: `Candidate ${profile.candidate} · ${profile.profile}`,
  note: 'Validated model artifact metadata',
  production: profile.promoted,
  valid: {
    normalFpr: profile.normalFpr == null ? null : profile.normalFpr * 100,
    knownFaultRecall: null,
    precision: null,
    f1: null,
    accuracy: null,
    auc: profile.auroc,
    support: profile.support,
  },
  test: { normalFpr: null, knownFaultRecall: null, precision: null, f1: null, accuracy: null },
}));

mockAIModelMonitor.l2Targets = modelMetadata.l2Targets.map((target) => ({
  id: target.id,
  target: target.label,
  tone: target.tone as HealthTone,
  profile: target.profile,
  threshold: target.threshold,
  sourceArtifact: target.sourceArtifact,
  sourceHash: target.sourceHash,
  valid: {
    normalFpr: null,
    knownFaultRecall: null,
    precision: null,
    f1: null,
    accuracy: null,
    averagePrecision: target.validAveragePrecision * 100,
  },
  test: {
    normalFpr: null,
    knownFaultRecall: null,
    precision: null,
    f1: target.testF1 * 100,
    accuracy: null,
    auc: target.testAuroc,
    averagePrecision: target.testAveragePrecision * 100,
  },
}));

mockAIModelMonitor.decisionFlow = mockAIModelMonitor.decisionFlow.map((stage) => stage.id === 'l2'
  ? { ...stage, value: `${modelMetadata.l2Targets.length} targets` }
  : stage);
