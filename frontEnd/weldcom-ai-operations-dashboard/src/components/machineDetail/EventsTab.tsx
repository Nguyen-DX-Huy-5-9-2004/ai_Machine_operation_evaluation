import type { MachineDetailResponse, MachineStatusType } from '../../types/machineDetail';
import { RecentEventsTable } from './RecentEventsTable';
import { InfoDot } from './InfoDot';
import { useUiText } from '../../i18n/appTranslations';

interface Props { data: MachineDetailResponse }

const statusLabels: Record<MachineStatusType, string> = {
  ON_LOADED: 'ON loaded',
  ON_NO_LOAD: 'ON no-load',
  OFF: 'Off',
  FAULT: 'Fault',
  MAINTENANCE: 'Maintenance',
  DATA_ISSUE: 'Data issue',
};

export function EventsTab({ data }: Props) {
  const t = useUiText();
  const counts = data.recentEvents.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});
  const criticalCount = data.recentEvents.filter((row) => row.actionLevel === 'CRITICAL').length;
  const anomalyCount = data.recentEvents.filter((row) => row.l1Result.toLowerCase().includes('anomaly')).length;
  const missingKwhCount = data.recentEvents.filter((row) => row.kwhSource === 'MISSING').length;

  return (
    <div className="md-tab-workspace events-tab">
      <section className="md-events-toolbar md-panel">
        <div className="md-title-with-info"><h3>{t('Event Explorer')}</h3><InfoDot text="Most recent SQL-backed events for the selected machine. Filters will narrow this evidence without replacing the rest of the page." /></div>
        <div className="md-event-filters">
          <button>{t('All statuses')} ▾</button><button>{t('All action levels')} ▾</button><button>{t('KWh source')} ▾</button><button>{t('L1 result')} ▾</button>
        </div>
      </section>
      <section className="md-event-stats-grid">
        <EventStat label={t('Recent events')} value={data.recentEvents.length} sub={t('latest available rows')} />
        <EventStat label={t('Critical events')} value={criticalCount} sub={t('policy_v2 CRITICAL')} danger />
        <EventStat label={t('L1 anomaly events')} value={anomalyCount} sub={t('behavior anomaly')} danger />
        <EventStat label={t('Missing KWh')} value={missingKwhCount} sub={t('requires validation')} warning />
      </section>
      <section className="md-status-distribution md-panel">
        <div className="md-panel-header compact"><div className="md-title-with-info"><h3>{t('Status Distribution')}</h3><InfoDot text="Recent event count by machine status." /></div></div>
        <div className="md-status-pill-grid">
          {Object.entries(statusLabels).map(([status, label]) => (
            <div key={status} className={`md-status-count status-${status.toLowerCase()}`}>
              <span>{t(label)}</span><b>{counts[status] ?? 0}</b>
            </div>
          ))}
        </div>
      </section>
      <RecentEventsTable rows={data.recentEvents} />
    </div>
  );
}

function EventStat({ label, value, sub, danger, warning }: { label: string; value: number; sub: string; danger?: boolean; warning?: boolean }) {
  return <article className={`md-summary-card event-stat ${danger ? 'danger' : warning ? 'warning' : ''}`}><div className="summary-title">{label}</div><div className="summary-value">{value}</div><div className="summary-detail">{sub}</div></article>;
}
