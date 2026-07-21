import type { L1AnomalySummary } from '../../types/dashboard';
import { StatusDonut } from './StatusDonut';

export function L1AnomalyStatus({ summary }: { summary: L1AnomalySummary }) {
  const normalPct = Math.round((summary.normal / summary.total) * 100);
  return (
    <StatusDonut
      title="L1 Anomaly Status"
      centerValue={`${normalPct}%`}
      centerLabel="Normal"
      accent="#00e889"
      tooltip="L1 behavioral-anomaly status from the Autoencoder score and available event-window history. No Data means the context window is insufficient, not normal behavior."
      spark={summary.spark}
      data={[
        { name: 'Normal', value: summary.normal, color: '#00e889' },
        { name: 'Anomaly', value: summary.anomaly, color: '#ff9800' },
        { name: 'No Data', value: summary.noData, color: '#94a3b8' }
      ]}
    />
  );
}
