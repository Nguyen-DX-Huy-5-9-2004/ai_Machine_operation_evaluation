import type { ContractCheck, MonitorProvenance } from '../../types/aiModelMonitor';
import { Panel } from './Panel';
import { Sparkline } from './Sparkline';
import { InfoTooltip } from './InfoTooltip';
import { useUiText } from '../../i18n/appTranslations';

const colorForStatus = (status: ContractCheck['status']) => status === 'PASS' ? '#00e889' : status === 'WARNING' ? '#ffb21a' : '#ff3e52';

export function DataContractPanel({ checks, source }: { checks: ContractCheck[]; source?: MonitorProvenance }) {
  const t = useUiText();
  return (
    <Panel title={t('Data Contract & Feature Health')} tooltip="Monitors schema, feature availability, event alignment, SQL parity, freshness, and KWh data quality." className="amm-contract-panel" source={source} action={<button type="button" className="amm-link-button">{t('View full report')} →</button>}>
      <div className="amm-contract-table" role="table">
        <div className="amm-contract-table__head" role="row"><span>{t('Check item')}</span><span>{t('Status')}</span><span>{t('Value')}</span><span>{t('Source')}</span><span>{t('Trend')}</span></div>
        {checks.map((item) => (
          <div className="amm-contract-table__row" role="row" key={item.id}>
            <span>{t(item.check)}<InfoTooltip text={item.tooltip} align="left" /></span>
            <span className={`amm-contract-status is-${item.status.toLowerCase()}`}>{t(item.status)}</span>
            <strong>{t(item.value)}</strong>
            <span className="amm-contract-source" title={item.provenance?.tooltip ?? t('Source not available')}>{item.provenance?.sourceType === 'SQL_RUNTIME' || item.provenance?.sourceType === 'BOUNDED_AUDIT' ? t('LIVE') : item.provenance?.isValidated ? t('ART') : item.provenance?.sourceType === 'MIXED' ? t('MIX') : t('DEMO')}</span>
            <Sparkline
              values={item.trend}
              color={colorForStatus(item.status)}
              width={84}
              height={22}
              label={item.check}
            />
          </div>
        ))}
      </div>
    </Panel>
  );
}
