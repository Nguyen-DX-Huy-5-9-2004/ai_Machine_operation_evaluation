import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Sparkline } from '../Sparkline';
import { tooltipStyle } from './chartUtils';
import { createNeonPieShape } from './NeonPieSector';
import { DashboardInfoTooltip } from './DashboardInfoTooltip';

interface StatusDonutProps {
  title: string;
  centerValue: string;
  centerLabel: string;
  data: Array<{ name: string; value: number; color: string }>;
  spark: number[];
  accent: string;
  tooltip: string;
}

export function StatusDonut({ title, centerValue, centerLabel, data, spark, accent, tooltip }: StatusDonutProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <section className="glass-panel panel-secondary status-donut-card p-4">
      <div className="panel-title metric-title-with-info mb-3">{title}<DashboardInfoTooltip text={tooltip} /></div>
      <div className="status-donut-main">
        <div className="status-donut-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip contentStyle={tooltipStyle} formatter={(value, _name, item) => {
                const numericValue = Number(value ?? 0);
                return [`${numericValue} (${Math.round((numericValue / total) * 100)}%)`, (item.payload as { name: string }).name];
              }} />
              <Pie
                data={data}
                innerRadius={43}
                outerRadius={58}
                dataKey="value"
                stroke="rgba(255,255,255,.06)"
                shape={createNeonPieShape(activeIndex)}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {data.map((item) => <Cell key={item.name} fill={item.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="status-donut-center">
            <div className="status-donut-value">{centerValue}</div>
            <div className="text-[10px] font-bold" style={{ color: accent }}>{centerLabel}</div>
          </div>
        </div>
        <div className="status-donut-breakdown">
          {data.map((item) => (
            <div key={item.name} className="status-donut-row">
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: item.color }} />{item.name}</span>
              <span className="text-right text-slate-200">{item.value} <em>({Math.round((item.value / total) * 100)}%)</em></span>
            </div>
          ))}
        </div>
      </div>
      <div className="status-donut-trend"><Sparkline data={spark} color={accent} height={34} /></div>
    </section>
  );
}
