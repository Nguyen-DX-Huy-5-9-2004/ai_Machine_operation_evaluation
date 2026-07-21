import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RiskTrendPoint } from '../../types/dashboard';
import { DashboardSelect } from './DashboardSelect';
import { tooltipStyle } from './chartUtils';
import { DashboardInfoTooltip } from './DashboardInfoTooltip';

export function OperationalRiskTrend({ data }: { data: RiskTrendPoint[] }) {
  const [granularity, setGranularity] = useState('Daily');

  return (
    <section className="glass-panel panel-primary p-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="panel-title metric-title-with-info">Operational Risk Over Time<DashboardInfoTooltip text="Average operational risk over the selected period. Dashed lines are policy thresholds for low, medium, and high or critical operational risk." /></div>
        <DashboardSelect value={granularity} options={['Daily', 'Hourly', 'Weekly']} onChange={setGranularity} compact />
      </div>
      <div className="h-[238px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 20, right: 28, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="riskFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.74} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(92, 152, 214, .14)" vertical />
            <ReferenceLine y={35} label={{ value: 'LOW', position: 'insideRight', fill: '#00e889', fontSize: 12, fontWeight: 700}} stroke="#00e889" strokeDasharray="5 5" strokeOpacity={0.42} />
            <ReferenceLine y={65} label={{ value: 'MEDIUM', position: 'insideRight', fill: '#ffd33d', fontSize: 12, fontWeight: 700}} stroke="#ffd33d" strokeDasharray="5 5" strokeOpacity={0.42} />
            <ReferenceLine y={80} label={{ value: 'HIGH / CRITICAL', position: 'insideRight', fill: '#ff3648', fontSize: 12, fontWeight: 700}} stroke="#ff3648" strokeDasharray="5 5" strokeOpacity={0.5} />
            <XAxis dataKey="label" tick={{ fill: '#98b3d1', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#98b3d1', fontSize: 12 }} domain={[0, 100]} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => [Number(value ?? 0), name === 'avgRiskScore' ? 'avg_risk_score' : name]}
              labelFormatter={(_, payload) => {
                const point = payload?.[0]?.payload as RiskTrendPoint | undefined;
                return point ? `${point.date} | critical_count ${point.criticalCount} | high_count ${point.highCount} | top_machine ${point.topMachine}` : '';
              }}
            />
            <Area type="monotone" dataKey="avgRiskScore" name="avg_risk_score" stroke="#b96cff" strokeWidth={3} fill="url(#riskFill)" dot={{ r: 4, fill: '#fff', stroke: '#b96cff', strokeWidth: 2 }} activeDot={{ r: 7 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="text-sm text-slate-400 italic opacity-30">Tooltip includes date, avg_risk_score, critical_count, high_count, top_machine.</div>
    </section>
  );
}
