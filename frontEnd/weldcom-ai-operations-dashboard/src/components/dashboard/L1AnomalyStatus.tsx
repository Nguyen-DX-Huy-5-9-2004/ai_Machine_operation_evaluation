import type { L1AnomalySummary } from '../../types/dashboard';
import { StatusDonut } from './StatusDonut';
import { useUiText } from '../../i18n/appTranslations';

export function L1AnomalyStatus({ summary }: { summary: L1AnomalySummary }) {
  const t = useUiText();
  const normalPct = Math.round((summary.normal / summary.total) * 100);
  return (
    <StatusDonut
      title={t('L1 Anomaly Status')}
      centerValue={`${normalPct}%`}
      centerLabel={t('Normal')}
      accent="#00e889"
      tooltip="L1 behavioral-anomaly status from the Autoencoder score and available event-window history. No Data means the context window is insufficient, not normal behavior."
      spark={summary.spark}
      data={[
        { name: t('Normal'), value: summary.normal, color: '#00e889' },
        { name: t('Anomaly'), value: summary.anomaly, color: '#ff9800' },
        { name: t('No Data'), value: summary.noData, color: '#94a3b8' }
      ]}
    />
  );
}
