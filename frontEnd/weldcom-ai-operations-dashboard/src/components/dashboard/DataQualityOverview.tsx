import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBullseye, faClock, faDatabase, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import type { DataQualityMetric } from '../../types/dashboard';
import { Sparkline } from '../Sparkline';
import { DashboardInfoTooltip } from './DashboardInfoTooltip';
import { useUiText } from '../../i18n/appTranslations';

export function DataQualityOverview({ data }: { data: DataQualityMetric[] }) {
  const t = useUiText();
  const icons = {
    completeness: faDatabase,
    timeliness: faClock,
    consistency: faShieldHalved,
    accuracy: faBullseye
  };

  return (
    <section className="glass-panel panel-secondary data-quality-overview-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="panel-title metric-title-with-info">{t('Data Quality Overview')}<DashboardInfoTooltip text="Completeness, timeliness, consistency, and accuracy of the event data used for scoring. These metrics measure data confidence, not machine health." /></div>
        <button className="text-sm font-semibold text-blue-400 hover:text-blue-200">{t('View Details')}</button>
      </div>
      <div className="data-quality-grid grid grid-cols-2 gap-3">
        {data.map((item) => (
          <div key={item.id} className="data-quality-card" title={`Future source: ${item.sourceField}`}>
            <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
              <FontAwesomeIcon icon={icons[item.id]} className="text-lg text-blue-400" />
              {t(item.label)}
            </div>
            <div className="data-quality-value-row">
              <span className="text-2xl font-black">{item.value}%</span>
              <Sparkline data={item.spark} color="#00e889" height={26} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
