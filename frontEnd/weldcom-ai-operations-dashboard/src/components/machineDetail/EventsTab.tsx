import type { MachineDetailResponse, MachineStatusType } from '../../types/machineDetail';
import { RecentEventsTable } from './RecentEventsTable';
import { InfoDot } from './InfoDot';

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
        <div className="md-title-with-info"><h3>Event Explorer</h3><InfoDot text="Mock event explorer prepared for backend pagination and event drilldown." /></div>
        <div className="md-event-filters">
          <button>All statuses ▾</button><button>All action levels ▾</button><button>KWh source ▾</button><button>L1 result ▾</button>
        </div>
      </section>
      <section className="md-event-stats-grid">
        <EventStat label="Recent events" value={data.recentEvents.length} sub="latest available rows" />
        <EventStat label="Critical events" value={criticalCount} sub="policy_v2 CRITICAL" danger />
        <EventStat label="L1 anomaly events" value={anomalyCount} sub="behavior anomaly" danger />
        <EventStat label="Missing KWh" value={missingKwhCount} sub="requires validation" warning />
      </section>
      <section className="md-status-distribution md-panel">
        <div className="md-panel-header compact"><div className="md-title-with-info"><h3>Status Distribution</h3><InfoDot text="Recent event count by machine status." /></div></div>
        <div className="md-status-pill-grid">
          {Object.entries(statusLabels).map(([status, label]) => (
            <div key={status} className={`md-status-count status-${status.toLowerCase()}`}>
              <span>{label}</span><b>{counts[status] ?? 0}</b>
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
