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

export function MachineDetailPresentation({ data }: { data: MachineDetailResponse }) {
  const [activeTab, setActiveTab] = React.useState<MachineDetailTab>('Timeline');
  const [timeRange, setTimeRange] = React.useState('Last 24 Hours');
  const [layout, setLayout] = React.useState(0);
  React.useEffect(() => { const timer = window.setTimeout(() => { window.dispatchEvent(new Event('resize')); setLayout((v) => v + 1); }, 120); return () => window.clearTimeout(timer); }, [data, activeTab]);
  return <div className="machine-detail-page">
    <MachineDetailHeader machine={data.machine} kpis={data.kpis} timeRange={timeRange} onTimeRangeChange={setTimeRange} />
    <section className="md-tabs-panel"><div className="md-tabs" role="tablist" aria-label="Machine detail sections">{tabs.map((name) => <button type="button" key={name} role="tab" aria-selected={activeTab === name} className={activeTab === name ? 'active' : ''} onClick={() => setActiveTab(name)}>{name}</button>)}</div><div key={`${activeTab}-${layout}`}>{tab(activeTab, data)}</div></section>
  </div>;
}
