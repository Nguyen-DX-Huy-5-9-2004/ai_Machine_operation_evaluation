import React from 'react';
import { getMachineDetail } from '../services/machineDetailService';
import type { MachineDetailResponse } from '../types/machineDetail';
import { AiAnalysisTab } from '../components/machineDetail/AiAnalysisTab';
import { EnergyTab } from '../components/machineDetail/EnergyTab';
import { EventsTab } from '../components/machineDetail/EventsTab';
import { MachineDetailHeader } from '../components/machineDetail/MachineDetailHeader';
import { MaintenanceTab } from '../components/machineDetail/MaintenanceTab';
import { PerformanceTab } from '../components/machineDetail/PerformanceTab';
import { TimelineTab } from '../components/machineDetail/TimelineTab';
import '../styles/machine-detail.css';

const tabs = ['Timeline', 'AI Analysis', 'Performance', 'Energy', 'Events', 'Maintenance'] as const;
type MachineDetailTab = typeof tabs[number];
const rangeByLabel: Record<string, 'last_24h' | 'last_7d' | 'last_30d'> = { 'Last 24 Hours': 'last_24h', 'Last 7 Days': 'last_7d', 'Last 30 Days': 'last_30d' };

function renderTab(activeTab: MachineDetailTab, data: MachineDetailResponse) {
  switch (activeTab) {
    case 'AI Analysis': return <AiAnalysisTab data={data} />;
    case 'Performance': return <PerformanceTab data={data} />;
    case 'Energy': return <EnergyTab data={data} />;
    case 'Events': return <EventsTab data={data} />;
    case 'Maintenance': return <MaintenanceTab data={data} />;
    default: return <TimelineTab data={data} />;
  }
}

export default function MachineDetail() {
  const [data, setData] = React.useState<MachineDetailResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<MachineDetailTab>('Timeline');
  const [timeRange, setTimeRange] = React.useState('Last 24 Hours');
  const [chartLayoutVersion, setChartLayoutVersion] = React.useState(0);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    getMachineDetail({ machineId: '11', range: rangeByLabel[timeRange] })
      .then(result => { if (mounted) { setData(result); setError(null); } })
      .catch((err: unknown) => { if (mounted) setError(err instanceof Error ? err.message : 'Failed to load machine detail'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [timeRange]);

  // Recharts can measure before this grid settles after async data/tab changes.
  // A lightweight resize signal keeps chart geometry and hover hit areas aligned.
  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    const timer = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [data, activeTab]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setChartLayoutVersion((version) => version + 1), 180);
    return () => window.clearTimeout(timer);
  }, [data, activeTab]);

  if (loading) return <div className="machine-detail-page"><div className="md-loading">Loading machine detail...</div></div>;
  if (error || !data) return <div className="machine-detail-page"><div className="md-error">{error ?? 'No data available'}</div></div>;

  return (
    <div className="machine-detail-page">
      <MachineDetailHeader machine={data.machine} kpis={data.kpis} timeRange={timeRange} onTimeRangeChange={setTimeRange} />
      <section className="md-tabs-panel">
        <div className="md-tabs" role="tablist" aria-label="Machine detail sections">
          {tabs.map(tab => <button type="button" key={tab} role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}
        </div>
        <div key={`${activeTab}-${chartLayoutVersion}`}>{renderTab(activeTab, data)}</div>
      </section>
    </div>
  );
}
