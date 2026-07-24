import type { L2FaultConfidenceSummary } from '../../types/dashboard';
import { StatusDonut } from './StatusDonut';
import { useUiText } from '../../i18n/appTranslations';

export function L2FaultConfidence({ summary }: { summary: L2FaultConfidenceSummary }) {
  const t = useUiText();
  const highPct = Math.round((summary.high / summary.total) * 100);
  return (
    <StatusDonut
      title={t('L2 Fault Confidence')}
      centerValue={`${highPct}%`}
      centerLabel={t('High')}
      accent="#1677ff"
      tooltip="L2 fault confidence groups model confidence into high, medium, and low ranges. It is related to fault risk but remains distinct from quality-action logic."
      spark={summary.spark}
      data={[
        { name: `${t('High')} >= 80%`, value: summary.high, color: '#1677ff' },
        { name: `${t('Medium')} 50-79%`, value: summary.medium, color: '#ffb300' },
        { name: `${t('Low')} < 50%`, value: summary.low, color: '#ff3648' }
      ]}
    />
  );
}
