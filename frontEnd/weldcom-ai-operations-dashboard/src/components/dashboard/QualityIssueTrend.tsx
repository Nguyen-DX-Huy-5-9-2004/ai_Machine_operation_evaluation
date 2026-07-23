import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, Brush, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { QualityIssueTrendPoint } from '../../types/dashboard';
import { DashboardSelect } from './DashboardSelect';
import { tooltipStyle } from './chartUtils';
import { DashboardInfoTooltip } from './DashboardInfoTooltip';

type Granularity = 'day' | 'hour' | 'week';
type QualityRange = 'Last 7 Days' | 'Last 30 Days';

function timeTick(value: string, granularity: Granularity) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return granularity === 'hour'
    ? parsed.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : parsed.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function defaultWindow(length: number, granularity: Granularity) {
  const points = granularity === 'hour' ? 48 : granularity === 'day' ? 14 : 12;
  return { startIndex: Math.max(0, length - points), endIndex: Math.max(0, length - 1) };
}

export function QualityIssueTrend({ data, range, granularity, onRangeChange }: { data: QualityIssueTrendPoint[]; range: QualityRange; granularity: Granularity; onRangeChange: (range: QualityRange) => void }) {
  const [viewport, setViewport] = useState(() => defaultWindow(data.length, granularity));
  const [manualViewport, setManualViewport] = useState(false);
  useEffect(() => {
    setManualViewport(false);
    setViewport(defaultWindow(data.length, granularity));
  }, [granularity, range]);
  useEffect(() => {
    if (!manualViewport) setViewport(defaultWindow(data.length, granularity));
  }, [data.length, granularity, manualViewport]);
  const maximum = useMemo(() => Math.max(1, ...data.map((item) => item.qualityOk + item.checkDataAndEnergy + item.checkEnergy + item.checkData)), [data]);
  const domainMaximum = Math.ceil(maximum / 100) * 100;
  return (
    <section className="glass-panel panel-secondary quality-trend-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="panel-title metric-title-with-info">Quality Issue Trend<DashboardInfoTooltip text="Daily distribution of quality outcomes. CHECK_DATA and CHECK_ENERGY indicate data validation needs; they are not machine-fault classifications." /></div>
        <DashboardSelect value={range} options={['Last 7 Days', 'Last 30 Days']} onChange={(value) => onRangeChange(value as QualityRange)} compact />
      </div>
      <div className="quality-trend-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -16, bottom: 22 }} barCategoryGap="24%">
            <CartesianGrid stroke="rgba(92,152,214,.12)" vertical={false} />
            <XAxis dataKey="label" tickFormatter={(value) => timeTick(String(value), granularity)} minTickGap={granularity === 'hour' ? 80 : 48} tick={{ fill: '#98b3d1', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, domainMaximum]} tick={{ fill: '#98b3d1', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={false} shared={false} />
            <Bar dataKey="qualityOk" name="QUALITY_OK" stackId="a" fill="#19f5a5" barSize={18} activeBar={false} />
            <Bar dataKey="checkDataAndEnergy" name="CHECK_DATA_AND_ENERGY" stackId="a" fill="#bd72ff" barSize={18} activeBar={false} />
            <Bar dataKey="checkEnergy" name="CHECK_ENERGY" stackId="a" fill="#ffad1f" barSize={18} activeBar={false} />
            <Bar dataKey="checkData" name="CHECK_DATA" stackId="a" fill="#ff3d5a" radius={[4, 4, 0, 0]} barSize={18} activeBar={false} />
            <Brush dataKey="label" height={24} stroke="#3e9ffc" travellerWidth={8} startIndex={viewport.startIndex} endIndex={viewport.endIndex} onChange={(next) => { setManualViewport(true); setViewport({ startIndex: next.startIndex ?? 0, endIndex: next.endIndex ?? Math.max(0, data.length - 1) }); }} tickFormatter={() => ''} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
