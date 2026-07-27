import type { MonitorProvenance } from '../../types/aiModelMonitor';
import { InfoTooltip } from './InfoTooltip';
import { useUiText } from '../../i18n/appTranslations';

const labels: Record<MonitorProvenance['sourceType'], string> = { SQL_RUNTIME: 'LIVE SQL', BOUNDED_AUDIT: 'RUNTIME AUDIT', VALIDATED_ARTIFACT: 'VALIDATED ARTIFACT', DEMO_REFERENCE: 'DEMO REFERENCE', SIMULATED_VISUALIZATION: 'SIMULATED TREND', MIXED: 'MIXED SOURCES', NOT_AVAILABLE: 'NOT AVAILABLE' };

export function SourceBadge({ source }: { source?: MonitorProvenance }) {
  const t = useUiText();
  if (!source) return null;
  return <span className={`amm-source-badge is-${source.sourceType.toLowerCase()}`}><span>{t(labels[source.sourceType])}</span><InfoTooltip text={source.tooltip} align="right" /></span>;
}
