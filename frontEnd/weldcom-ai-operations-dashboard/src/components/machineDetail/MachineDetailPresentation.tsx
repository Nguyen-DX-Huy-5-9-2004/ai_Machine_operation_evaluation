import React from 'react';
import type { MachineDetailResponse } from '../../types/machineDetail';
import { AiAnalysisTab } from './AiAnalysisTab';
import { EnergyTab } from './EnergyTab';
import { EventsTab } from './EventsTab';
import { MachineDetailHeader } from './MachineDetailHeader';
import { MaintenanceTab } from './MaintenanceTab';
import { PerformanceTab } from './PerformanceTab';
import { TimelineTab } from './TimelineTab';

const tabs = ['Timeline', 'AI Analysis', 'Performance', 'Energy', 'Events', 'Maintenance'] as const;
type MachineDetailTab = typeof tabs[number];
function tab(activeTab: MachineDetailTab, data: MachineDetailResponse) {
  if (activeTab === 'AI Analysis') return <AiAnalysisTab data={data} />;
  if (activeTab === 'Performance') return <PerformanceTab data={data} />;
  if (activeTab === 'Energy') return <EnergyTab data={data} />;
  if (activeTab === 'Events') return <EventsTab data={data} />;
  if (activeTab === 'Maintenance') return <MaintenanceTab data={data} />;
  return <TimelineTab data={data} />;
}

interface Props {
  data: MachineDetailResponse;
  refreshing?: boolean;
  timeRange: string;
  onTimeRangeChange: (value: string) => void;
}

export function MachineDetailPresentation({ data, refreshing = false, timeRange, onTimeRangeChange }: Props) {
  const [activeTab, setActiveTab] = React.useState<MachineDetailTab>('Timeline');
  // A replay delta must update chart props in place. Keying the workspace by a
  // derived layout value remounted every tab on each event and looked like a
  // page reload, while also losing Brush/tooltip state.
  React.useEffect(() => { const timer = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 120); return () => window.clearTimeout(timer); }, [activeTab]);
  return <div className="machine-detail-page">
    {refreshing && <div className="md-refreshing" role="status">Updating the selected time range without resetting this view</div>}
    <MachineDetailHeader machine={data.machine} kpis={data.kpis} timeRange={timeRange} onTimeRangeChange={onTimeRangeChange} />
    <section className="md-tabs-panel"><div className="md-tabs" role="tablist" aria-label="Machine detail sections">{tabs.map((name) => <button type="button" key={name} role="tab" aria-selected={activeTab === name} className={activeTab === name ? 'active' : ''} onClick={() => setActiveTab(name)}>{name}</button>)}</div><div key={activeTab}>{tab(activeTab, data)}</div></section>
  </div>;
}
