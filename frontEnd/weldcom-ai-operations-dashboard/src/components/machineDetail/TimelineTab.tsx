import type { MachineDetailResponse } from '../../types/machineDetail';
import { EnergySummaryStrip } from './EnergySummaryStrip';
import { EventKwhDeltaChart, LoadedKwhEvidenceChart } from './KwhCharts';
import { EvidencePanel } from './EvidencePanel';
import { L1AnomalyChart } from './L1AnomalyChart';
import { L2RisksChart } from './L2RisksChart';
import { RecentEventsTable } from './RecentEventsTable';
import { TimelineBar } from './TimelineBar';

interface Props { data: MachineDetailResponse; }

export function TimelineTab({ data }: Props) {
  return (
    <div className="md-tab-workspace timeline-tab">
      <TimelineBar segments={data.timeline} markers={data.markers} />
      <section className="md-main-chart-grid">
        <L1AnomalyChart data={data.l1Series} />
        <L2RisksChart data={data.riskSeries} />
        <EventKwhDeltaChart data={data.kwhDeltaSeries} />
        <LoadedKwhEvidenceChart data={data.loadedKwhSeries} />
      </section>
      <EnergySummaryStrip summary={data.energySummary} />
      <section className="md-bottom-grid">
        <RecentEventsTable rows={data.recentEvents} />
        <EvidencePanel
          operationalEvidence={data.operationalEvidence}
          energyDataEvidence={data.energyDataEvidence}
          finalReason={data.finalReason}
          generatedAt={data.apiMeta.generatedAt}
        />
      </section>
    </div>
  );
}
