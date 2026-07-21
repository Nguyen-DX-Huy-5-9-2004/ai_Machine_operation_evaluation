import type { L2FaultConfidenceSummary } from '../../types/dashboard';
import { StatusDonut } from './StatusDonut';

export function L2FaultConfidence({ summary }: { summary: L2FaultConfidenceSummary }) {
  const highPct = Math.round((summary.high / summary.total) * 100);
  return (
    <StatusDonut
      title="L2 Fault Confidence"
      centerValue={`${highPct}%`}
      centerLabel="High"
      accent="#1677ff"
      tooltip="L2 fault confidence groups model confidence into high, medium, and low ranges. It is related to fault risk but remains distinct from quality-action logic."
      spark={summary.spark}
      data={[
        { name: 'High >= 80%', value: summary.high, color: '#1677ff' },
        { name: 'Medium 50-79%', value: summary.medium, color: '#ffb300' },
        { name: 'Low < 50%', value: summary.low, color: '#ff3648' }
      ]}
    />
  );
}
