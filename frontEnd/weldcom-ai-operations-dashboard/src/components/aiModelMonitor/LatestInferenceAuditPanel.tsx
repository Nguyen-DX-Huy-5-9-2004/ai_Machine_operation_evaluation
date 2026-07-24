import type { AIModelMonitorPayload, MonitorProvenance } from '../../types/aiModelMonitor';
import { formatCount, formatHistoricalTimestamp } from '../../utils/formatters';
import { SourceBadge } from './SourceBadge';
import { useUiText } from '../../i18n/appTranslations';

export function LatestInferenceAuditPanel({ audit, source }: { audit?: AIModelMonitorPayload['latestInferenceAudit']; source?: MonitorProvenance }) {
  const t = useUiText();
  if (!audit?.availability) return null;
  return <section className="amm-latest-audit" aria-label={t('Latest bounded AI inference')}>
    <header><span>{t('Latest bounded inference')}</span><SourceBadge source={source} /></header>
    <div className="amm-latest-audit__grid">
      <div><span>{t('Status')}</span><strong>{t(audit.result || 'Not available')}</strong></div>
      <div><span>{t('Input / policy-ready')}</span><strong>{formatCount(audit.inputRows)} / {formatCount(audit.scoredRows)}</strong></div>
      <div><span>{t('Candidate')}</span><strong>{audit.candidateAUsed ? 'A' : t('Not available')}</strong></div>
      <div><span>{t('SQL writes')}</span><strong>{formatCount(audit.sqlWrites)}</strong></div>
      <div><span>{t('Completed')}</span><strong title={audit.generatedAt ?? undefined}>{formatHistoricalTimestamp(audit.generatedAt)}</strong></div>
    </div>
  </section>;
}
