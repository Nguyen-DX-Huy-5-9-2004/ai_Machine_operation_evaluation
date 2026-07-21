import type { CSSProperties } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown, faArrowUp, faDatabase, faRobot, faShieldHalved, faTriangleExclamation, faWrench } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { DashboardKpi } from '../types/dashboard';
import { toneColor } from '../utils/format';
import { Sparkline } from './Sparkline';
import { DashboardInfoTooltip } from './dashboard/DashboardInfoTooltip';

const icons: Record<string, IconDefinition> = {
  shield: faShieldHalved,
  robot: faRobot,
  triangle: faTriangleExclamation,
  database: faDatabase,
  wrench: faWrench
};

interface MetricCardProps { metric: DashboardKpi; }

const kpiExplanation: Record<string, string> = {
  'operational-risk-score': 'Aggregated operational risk score from the current machine-event population. Data-quality issues are evaluated separately.',
  'total-active-machines': 'Machines currently active versus the monitored fleet total. This is an operational availability view, not a quality assessment.',
  'critical-high-operational-alerts': 'Count of events with CRITICAL or HIGH operational action levels. Quality action levels are intentionally excluded.',
  'data-quality-issues': 'Data issues requiring validation. A quality issue can affect confidence in a decision without meaning the machine is faulty.',
  'maintenance-repair-risk': 'Forward-looking maintenance and repair risk derived from L2 risk horizons. It supports planning and is not an automatic work order.'
};

export function MetricCard({ metric }: MetricCardProps) {
  const accent = toneColor(metric.tone);
  const icon = icons[metric.icon] ?? faShieldHalved;
  const trendPositive = metric.trend >= 0;

  return (
    <div className="metric-card" style={{ '--accent': accent, borderColor: `${accent}55` } as CSSProperties}>
      <div className="relative z-10 flex justify-between gap-3">
        <div>
          <div className="metric-title metric-title-with-info" title={metric.note}>{metric.title}<DashboardInfoTooltip text={kpiExplanation[metric.id] ?? metric.note ?? metric.title} /></div>
          <div className="mt-4 flex items-end gap-2">
            <span className="metric-primary-value">{metric.value}</span>
            {metric.suffix ? <span className="metric-primary-suffix">{metric.suffix}</span> : null}
          </div>
          <div className="mt-2 text-sm font-semibold" style={{ color: accent }}>{metric.subtitle}</div>
          <div className="metric-trend" title={`Future source: ${metric.sourceField}`}>
            <span className="metric-trend-value" style={{ color: trendPositive ? '#00e889' : '#ff3648' }}>
              <FontAwesomeIcon icon={trendPositive ? faArrowUp : faArrowDown} />
              {Math.abs(metric.trend)}
            </span>
            <span className="metric-trend-label">{metric.trendLabel}</span>
          </div>
        </div>
        <div className="flex flex-col items-end justify-between">
          <div className="metric-icon" style={{ borderColor: `${accent}66`, backgroundColor: `${accent}18`, color: accent }}>
            <FontAwesomeIcon icon={icon} />
          </div>
          <Sparkline data={metric.series} color={accent} />
        </div>
      </div>
    </div>
  );
}
