import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { RiskDistributionItem, RiskDistributionLevel } from '../../types/dashboard';
import { tooltipStyle } from './chartUtils';
import { createNeonPieShape } from './NeonPieSector';
import { DashboardInfoTooltip } from './DashboardInfoTooltip';
import { useUiText } from '../../i18n/appTranslations';

const neonRiskColors: Record<RiskDistributionLevel, string> = {
  Critical: '#ff2f55',
  High: '#ff9f1a',
  Medium: '#ffd43b',
  Low: '#00f5a0',
  'No Data': '#73829a'
};

export function RiskDistribution({ data, compact = false }: { data: RiskDistributionItem[]; compact?: boolean }) {
  const t = useUiText();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const orderedLevels: RiskDistributionLevel[] = ['Critical', 'High', 'Medium', 'Low', 'No Data'];
  // Keep a fixed semantic order and pass colour directly into the custom
  // sector. Recharts does not always retain Cell fill on a custom shape.
  const slices = orderedLevels.map((level) => {
    const item = data.find((entry) => entry.level === level);
    return { ...(item ?? { level, value: 0, percent: 0, color: neonRiskColors[level], sourceField: level === 'No Data' ? 'policy_ready_flag' as const : 'operational_action_level' as const }), color: neonRiskColors[level] };
  });
  const total = slices.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className={`glass-panel panel-primary risk-distribution-card p-5${compact ? ' risk-distribution-card--compact' : ''}`}>
      <div className="panel-title metric-title-with-info mb-4">{t('Machine Risk Distribution')}<DashboardInfoTooltip text="Distribution of monitored machines by operational action level. Low means lower current operational risk, not a confirmed healthy-machine state." /></div>
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
                data={slices}
                cx="50%"
                cy="50%"
                innerRadius={compact ? 49 : 62}
                outerRadius={compact ? 84 : 101}
                dataKey="value"
                nameKey="level"
                stroke="rgba(255,255,255,.16)"
                strokeWidth={2}
                shape={createNeonPieShape(activeIndex)}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {slices.map((item) => <Cell key={item.level} fill={item.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="risk-donut-center">
            <strong>{total}</strong>
            <span>{t('Total Machines')}</span>
          </div>
        </div>
        <div className="risk-distribution-legend">
          {slices.map((item) => (
            <div key={item.level} className="risk-distribution-item">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ background: neonRiskColors[item.level] ?? item.color, boxShadow: `0 0 16px ${neonRiskColors[item.level] ?? item.color}` }} />
                {t(item.level)}
              </div>
              <div className="text-right font-semibold text-slate-100">{item.value} <span className="font-normal text-slate-400">({Math.round(item.percent)}%)</span></div>
            </div>
          ))}
        </div>
      </div>
      <div className="risk-distribution-footnote italic">{t(compact ? 'Grouped by operational_action_level.' : 'No Data means no current L1 + L2 + Policy result is available in the selected scope.')}</div>
    </section>
  );
}
