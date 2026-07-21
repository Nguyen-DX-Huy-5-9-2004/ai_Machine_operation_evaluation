import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { RiskDistributionItem, RiskLevel } from '../../types/dashboard';
import { tooltipStyle } from './chartUtils';
import { createNeonPieShape } from './NeonPieSector';
import { DashboardInfoTooltip } from './DashboardInfoTooltip';

const neonRiskColors: Record<RiskLevel, string> = {
  Critical: '#ff2f55',
  High: '#ff9f1a',
  Medium: '#ffd43b',
  Low: '#00f5a0'
};

export function RiskDistribution({ data }: { data: RiskDistributionItem[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="glass-panel panel-primary risk-distribution-card p-5">
      <div className="panel-title metric-title-with-info mb-4">Machine Risk Distribution<DashboardInfoTooltip text="Distribution of monitored machines by operational action level. Low means lower current operational risk, not a confirmed healthy-machine state." /></div>
      <div className="risk-distribution-content">
        <div className="risk-donut-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, _name, item) => [
                  `${Number(value ?? 0)} machines`,
                  (item.payload as RiskDistributionItem).level,
                ]}
              />
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={62}
                outerRadius={101}
                dataKey="value"
                nameKey="level"
                stroke="rgba(255,255,255,.16)"
                strokeWidth={2}
                shape={createNeonPieShape(activeIndex)}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {data.map((item) => <Cell key={item.level} fill={neonRiskColors[item.level] ?? item.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="risk-donut-center">
            <strong>{total}</strong>
            <span>Total Machines</span>
          </div>
        </div>
        <div className="risk-distribution-legend">
          {data.map((item) => (
            <div key={item.level} className="risk-distribution-item">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ background: neonRiskColors[item.level] ?? item.color, boxShadow: `0 0 16px ${neonRiskColors[item.level] ?? item.color}` }} />
                {item.level}
              </div>
              <div className="text-right font-semibold text-slate-100">{item.value} <span className="font-normal text-slate-400">({item.percent}%)</span></div>
            </div>
          ))}
        </div>
      </div>
      <div className="risk-distribution-footnote italic">Grouped by operational_action_level.</div>
    </section>
  );
}
