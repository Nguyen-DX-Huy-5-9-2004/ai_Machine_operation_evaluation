import { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { L1CandidatePerformance, L2TargetPerformance, PerformanceMetricSet, SplitKey } from '../../types/aiModelMonitor';
import { Panel } from './Panel';
import { SegmentedTabs } from './SegmentedTabs';

const pct = (value: number, maxDigits = 2) => `${value.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: maxDigits })}%`;
const decimal = (value?: number) => value == null ? '—' : value.toFixed(2);
const support = (value?: number) => value == null ? '—' : value.toLocaleString('en-US');

function fprClass(value: number) {
  if (value <= 0.5) return 'is-good';
  if (value <= 2.5) return 'is-warn';
  return 'is-bad';
}
function highClass(value: number, good = 80, warn = 50) {
  if (value >= good) return 'is-good';
  if (value >= warn) return 'is-warn';
  return 'is-bad';
}

function MetricCell({ value, kind }: { value: number; kind: 'fpr' | 'high' | 'neutral' }) {
  const className = kind === 'fpr' ? fprClass(value) : kind === 'high' ? highClass(value) : '';
  return <td className={className}>{pct(value)}</td>;
}

interface L1PanelProps {
  data: L1CandidatePerformance[];
}

export function L1PerformancePanel({ data }: L1PanelProps) {
  const [split, setSplit] = useState<SplitKey>('valid');
  const [selected, setSelected] = useState(data.find((item) => item.production)?.id ?? data[0]?.id);

  const selectedCandidate = useMemo(() => data.find((item) => item.id === selected) ?? data[0], [data, selected]);
  const summary = selectedCandidate?.[split];

  return (
    <Panel
      title="L1 — Dual TCN Autoencoder Performance"
      subtitle="Behavioral anomaly detection · window size: 20 events"
      tooltip="So sánh candidate L1 trên normal false-positive rate và khả năng bắt known-fault. Accuracy chỉ là chỉ số phụ vì dữ liệu mất cân bằng."
      action={<SegmentedTabs value={split} onChange={setSplit} ariaLabel="L1 split" values={[{ value: 'valid', label: 'VALID' }, { value: 'test', label: 'TEST' }]} />}
      className="amm-performance-panel"
    >
      {summary ? (
        <div className="amm-performance-summary">
          <div><span>Selected</span><strong>{selectedCandidate.candidate}</strong></div>
          <div><span>Normal FPR</span><strong className={fprClass(summary.normalFpr)}>{pct(summary.normalFpr)}</strong></div>
          <div><span>Known-fault recall</span><strong className={highClass(summary.knownFaultRecall)}>{pct(summary.knownFaultRecall)}</strong></div>
          <div><span>Precision</span><strong className={highClass(summary.precision, 20, 10)}>{pct(summary.precision)}</strong></div>
          <div><span>F1</span><strong className={highClass(summary.f1, 20, 10)}>{pct(summary.f1)}</strong></div>
          <div><span>Accuracy</span><strong>{pct(summary.accuracy)}</strong></div>
        </div>
      ) : null}
      <div className="amm-table-wrap">
        <table className="amm-table amm-table--performance">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Normal FPR <span>↓</span></th>
              <th>Known-fault recall <span>↑</span></th>
              <th>Precision <span>↑</span></th>
              <th>F1 <span>↑</span></th>
              <th>Accuracy <span>↑</span></th>
              <th>AUROC <span>↑</span></th>
              <th>Support</th>
            </tr>
          </thead>
          <tbody>
            {data.map((candidate) => {
              const metrics = candidate[split];
              const active = candidate.id === selected;
              return (
                <tr key={candidate.id} className={active ? 'is-selected' : ''} onClick={() => setSelected(candidate.id)} tabIndex={0} onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => { if (event.key === 'Enter') setSelected(candidate.id); }}>
                  <td>
                    <strong>{candidate.candidate}</strong>
                    <small>{candidate.note}{candidate.production ? ' · ACTIVE' : ''}</small>
                  </td>
                  <MetricCell value={metrics.normalFpr} kind="fpr" />
                  <MetricCell value={metrics.knownFaultRecall} kind="high" />
                  <MetricCell value={metrics.precision} kind="high" />
                  <MetricCell value={metrics.f1} kind="high" />
                  <MetricCell value={metrics.accuracy} kind="neutral" />
                  <td>{decimal(metrics.auc)}</td>
                  <td>{support(metrics.support)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="amm-metric-legend"><span className="is-bad">↓ thấp tốt cho FPR</span><span className="is-good">↑ cao tốt cho recall / precision / F1</span><button type="button">View detailed L1 metrics →</button></footer>
    </Panel>
  );
}

interface L2PanelProps {
  data: L2TargetPerformance[];
}

function meanMetric(rows: L2TargetPerformance[], split: SplitKey, key: keyof PerformanceMetricSet) {
  const values = rows.map((row) => row[split][key]).filter((value): value is number => typeof value === 'number');
  return values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1);
}

export function L2PerformancePanel({ data }: L2PanelProps) {
  const [split, setSplit] = useState<SplitKey>('valid');
  const overall = {
    positiveRate: meanMetric(data, split, 'positiveRate'),
    normalFpr: meanMetric(data, split, 'normalFpr'),
    knownFaultRecall: meanMetric(data, split, 'knownFaultRecall'),
    precision: meanMetric(data, split, 'precision'),
    f1: meanMetric(data, split, 'f1'),
    accuracy: meanMetric(data, split, 'accuracy'),
    auc: meanMetric(data, split, 'auc'),
  };

  return (
    <Panel
      title="L2 — LightGBM Multi-label Classifier Performance"
      subtitle="Deviation validation and risk prediction by target"
      tooltip="Hiệu năng theo từng target L2. Normal FPR càng thấp càng tốt; recall, precision, F1, accuracy và AUROC càng cao càng tốt."
      action={<SegmentedTabs value={split} onChange={setSplit} ariaLabel="L2 split" values={[{ value: 'valid', label: 'VALID' }, { value: 'test', label: 'TEST' }]} />}
      className="amm-performance-panel"
    >
      <div className="amm-performance-summary amm-performance-summary--l2">
        <div><span>Overall positive rate</span><strong>{pct(overall.positiveRate)}</strong></div>
        <div><span>Normal FPR</span><strong className={fprClass(overall.normalFpr)}>{pct(overall.normalFpr)}</strong></div>
        <div><span>Known-fault recall</span><strong className={highClass(overall.knownFaultRecall)}>{pct(overall.knownFaultRecall)}</strong></div>
        <div><span>Precision</span><strong className={highClass(overall.precision, 20, 10)}>{pct(overall.precision)}</strong></div>
        <div><span>F1</span><strong className={highClass(overall.f1, 20, 10)}>{pct(overall.f1)}</strong></div>
        <div><span>Accuracy</span><strong>{pct(overall.accuracy)}</strong></div>
      </div>
      <div className="amm-table-wrap">
        <table className="amm-table amm-table--performance amm-table--l2">
          <thead>
            <tr>
              <th>Target</th>
              <th>Positive rate</th>
              <th>Normal FPR <span>↓</span></th>
              <th>Known-fault recall <span>↑</span></th>
              <th>Precision <span>↑</span></th>
              <th>F1 <span>↑</span></th>
              <th>Accuracy <span>↑</span></th>
              <th>AUROC <span>↑</span></th>
              <th>Support</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const metrics = row[split];
              return (
                <tr key={row.id}>
                  <td><span className={`amm-target-dot amm-tone-${row.tone}`} /> <strong>{row.target}</strong></td>
                  <td>{pct(metrics.positiveRate ?? 0)}</td>
                  <MetricCell value={metrics.normalFpr} kind="fpr" />
                  <MetricCell value={metrics.knownFaultRecall} kind="high" />
                  <MetricCell value={metrics.precision} kind="high" />
                  <MetricCell value={metrics.f1} kind="high" />
                  <MetricCell value={metrics.accuracy} kind="neutral" />
                  <td>{decimal(metrics.auc)}</td>
                  <td>{support(metrics.support)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td><strong>OVERALL</strong></td>
              <td>{pct(overall.positiveRate)}</td>
              <td>{pct(overall.normalFpr)}</td>
              <td>{pct(overall.knownFaultRecall)}</td>
              <td>{pct(overall.precision)}</td>
              <td>{pct(overall.f1)}</td>
              <td>{pct(overall.accuracy)}</td>
              <td>{decimal(overall.auc)}</td>
              <td>—</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <footer className="amm-metric-legend"><button type="button">View detailed L2 metrics →</button></footer>
    </Panel>
  );
}
