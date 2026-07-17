import type { CSSProperties } from 'react';
import { BadgeCheck, Bot, ShieldAlert, TriangleAlert, Wrench } from 'lucide-react';
import type { MetricCardData } from '../types/dashboard';
import { toneColor } from '../utils/format';
import { Sparkline } from './Sparkline';

const icons = { ShieldAlert, Bot, TriangleAlert, BadgeCheck, Wrench } as const;

interface MetricCardProps { metric: MetricCardData; }

export function MetricCard({ metric }: MetricCardProps) {
  const accent = toneColor(metric.tone);
  const Icon = icons[metric.icon as keyof typeof icons] ?? ShieldAlert;
  const trendPositive = metric.trend >= 0;
  return (
    <div className="metric-card" style={{ '--accent': accent, borderColor: `${accent}55` } as CSSProperties}>
      <div className="relative z-10 flex justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-wide text-slate-300">
            {metric.title}
            <span className="text-slate-500">ⓘ</span>
          </div>
          <div className="mt-4 flex items-end gap-2">
            <span className="text-4xl font-black leading-none">{metric.value}</span>
            {metric.suffix ? <span className="pb-1 text-sm font-semibold text-slate-300">{metric.suffix}</span> : null}
          </div>
          <div className="mt-2 text-sm font-semibold" style={{ color: accent }}>{metric.subtitle}</div>
          <div className="mt-5 flex items-center gap-2 text-xs text-slate-400">
            <span style={{ color: trendPositive ? '#00e889' : '#ff3648' }}>{trendPositive ? '▲' : '▼'} {Math.abs(metric.trend)}</span>
            <span>{metric.trendLabel}</span>
          </div>
        </div>
        <div className="flex flex-col items-end justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border" style={{ borderColor: `${accent}66`, backgroundColor: `${accent}18`, color: accent }}>
            <Icon size={25} />
          </div>
          <Sparkline data={metric.series} color={accent} />
        </div>
      </div>
    </div>
  );
}
