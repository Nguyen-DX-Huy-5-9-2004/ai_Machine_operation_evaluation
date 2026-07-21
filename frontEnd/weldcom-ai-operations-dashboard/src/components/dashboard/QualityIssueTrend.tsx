import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { QualityIssueTrendPoint } from '../../types/dashboard';
import { DashboardSelect } from './DashboardSelect';
import { tooltipStyle } from './chartUtils';
import { DashboardInfoTooltip } from './DashboardInfoTooltip';

export function QualityIssueTrend({ data }: { data: QualityIssueTrendPoint[] }) {
  const [range, setRange] = useState('Last 7 Days');
  return (
    <section className="glass-panel panel-secondary quality-trend-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="panel-title metric-title-with-info">Quality Issue Trend<DashboardInfoTooltip text="Daily distribution of quality outcomes. CHECK_DATA and CHECK_ENERGY indicate data validation needs; they are not machine-fault classifications." /></div>
        <DashboardSelect value={range} options={['Last 7 Days', 'Last 30 Days']} onChange={setRange} compact />
      </div>
      <div className="quality-trend-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -16, bottom: 0 }} barCategoryGap="24%">
            <CartesianGrid stroke="rgba(92,152,214,.12)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#98b3d1', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 120]} tick={{ fill: '#98b3d1', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={false} shared={false} />
            <Bar dataKey="qualityOk" name="QUALITY_OK" stackId="a" fill="#19f5a5" barSize={18} activeBar={false} />
            <Bar dataKey="checkDataAndEnergy" name="CHECK_DATA_AND_ENERGY" stackId="a" fill="#bd72ff" barSize={18} activeBar={false} />
            <Bar dataKey="checkEnergy" name="CHECK_ENERGY" stackId="a" fill="#ffad1f" barSize={18} activeBar={false} />
            <Bar dataKey="checkData" name="CHECK_DATA" stackId="a" fill="#ff3d5a" radius={[4, 4, 0, 0]} barSize={18} activeBar={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
