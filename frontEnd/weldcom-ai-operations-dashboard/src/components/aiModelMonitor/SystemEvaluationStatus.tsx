import { InfoTooltip } from './InfoTooltip';
import type { ModelMonitorDto } from '../../types/aiModelMonitor';
import { getSystemEvaluationState } from './systemEvaluationState';
import { useUiText } from '../../i18n/appTranslations';

export { getSystemEvaluationState } from './systemEvaluationState';

export function SystemEvaluationStatus({ data, loading, error }: { data: ModelMonitorDto | null; loading: boolean; error: string | null }) {
  const t = useUiText();
  const { tone, label, description, red, green } = getSystemEvaluationState(data, loading, error);
  return <div className={`amm-system-status is-${tone}`}>
    <i aria-hidden="true" /><strong>{t('SYSTEM EVALUATION STATUS')}</strong><b>{t(label)}</b><span>{t(description)}</span>
    <InfoTooltip text={red ? 'Mock mode is intentionally marked as demo data.' : green ? 'API mode is operational only when backend readiness, runtime environment, artifact integrity and required monitor data are all verified.' : 'The API is loading, a required endpoint is unavailable, or readiness checks have not passed.'} align="right" />
  </div>;
}
