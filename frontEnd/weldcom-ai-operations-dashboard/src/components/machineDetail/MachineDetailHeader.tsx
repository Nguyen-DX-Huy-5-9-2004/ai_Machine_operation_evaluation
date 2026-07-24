import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faDownload,
  faFilter,
  faStar,
} from "@fortawesome/free-solid-svg-icons";
import type { MachineIdentity, MachineKpi } from "../../types/machineDetail";
import { MachineDetailSelect } from "./MachineDetailSelect";
import { MetricCard } from "./MetricCard";
import { useUiText } from '../../i18n/appTranslations';

interface Props {
  machine: MachineIdentity;
  kpis: MachineKpi[];
  timeRange: string;
  onTimeRangeChange: (value: string) => void;
}
const timeOptions = ["Last 24 Hours", "Last 7 Days", "Last 30 Days"];

export function MachineDetailHeader({
  machine,
  kpis,
  timeRange,
  onTimeRangeChange,
}: Props) {
  const t = useUiText();
  return (
    <header className="md-page-header">
      <div className="md-header-context">
        {t('Machines')} <span>/</span> {machine.machineId}
      </div>
      <div className="md-top-actions">
        <span className="md-status-pill">
          <FontAwesomeIcon icon={faCircleCheck} /> {t('Historical Mode')}
        </span>
        <span className="md-status-pill candidate">
          <FontAwesomeIcon icon={faStar} /> {t('Production Candidate')}
        </span>
        <span className="md-time-label">
          {t('Last updated')}: {machine.lastUpdated}
        </span>
      </div>
      <div className="md-filter-row">
        <button type="button">
          <FontAwesomeIcon icon={faFilter} /> {t('Filters')}
        </button>
        <MachineDetailSelect
          value={timeRange}
          options={timeOptions}
          onChange={onTimeRangeChange}
        />
        <button type="button">
          <FontAwesomeIcon icon={faDownload} /> {t('Export')}
        </button>
      </div>
      <div className="md-kpi-grid">
        {kpis.map((metric) => (
          <MetricCard key={metric.key} metric={metric} />
        ))}
      </div>
    </header>
  );
}
