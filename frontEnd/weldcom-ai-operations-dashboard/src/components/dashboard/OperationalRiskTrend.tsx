import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Brush, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RiskTrendPoint } from '../../types/dashboard';
import { DashboardSelect } from './DashboardSelect';
import { tooltipStyle } from './chartUtils';
import { DashboardInfoTooltip } from './DashboardInfoTooltip';
import { thresholdFocusAxis } from '../../utils/thresholdFocusAxis';
import { useAppLanguage, useUiText } from '../../i18n/appTranslations';

const labels: Record<'day' | 'hour' | 'week', string> = { day: 'Daily', hour: 'Hourly', week: 'Weekly' };
const values: Record<string, 'day' | 'hour' | 'week'> = { Daily: 'day', Hourly: 'hour', Weekly: 'week' };

function timeTick(value: string, granularity: 'day' | 'hour' | 'week', language: 'en' | 'vi') {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const locale = language === 'vi' ? 'vi-VN' : 'en-US';
  if (granularity === 'hour') return parsed.toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return parsed.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function defaultWindow(length: number, granularity: 'day' | 'hour' | 'week') {
  const points = granularity === 'hour' ? 48 : granularity === 'day' ? 14 : 12;
  return { startIndex: Math.max(0, length - points), endIndex: Math.max(0, length - 1) };
}

export function OperationalRiskTrend({ data, granularity = 'hour', onGranularityChange, compact = false }: { data: RiskTrendPoint[]; granularity?: 'day' | 'hour' | 'week'; onGranularityChange?: (value: 'day' | 'hour' | 'week') => void; compact?: boolean }) {
  const t = useUiText();
  const language = useAppLanguage();
  const [viewport, setViewport] = useState(() => defaultWindow(data.length, granularity));
  const [manualViewport, setManualViewport] = useState(false);
  const axis = useMemo(() => thresholdFocusAxis(data.map((point) => point.avgRiskScore), [35, 65, 80]), [data]);
  const chartData = useMemo(() => data.map((point) => ({ ...point, visualRisk: axis.toPlot(point.avgRiskScore) })), [axis, data]);

  useEffect(() => {
    setManualViewport(false);
    setViewport(defaultWindow(data.length, granularity));
  }, [granularity]);
  useEffect(() => {
    if (!manualViewport) setViewport(defaultWindow(data.length, granularity));
  }, [data.length, granularity, manualViewport]);

  return (
    <section className={`glass-panel panel-primary operational-risk-trend p-5${compact ? ' operational-risk-trend--compact' : ''}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="panel-title metric-title-with-info">{t('Operational Risk Over Time')}<DashboardInfoTooltip text="Average operational risk over the selected period. Dashed lines are policy thresholds for low, medium, and high or critical operational risk." /></div>
        <DashboardSelect value={labels[granularity]} options={['Daily', 'Hourly', 'Weekly']} onChange={(value) => onGranularityChange?.(values[value])} compact />
      </div>
      <div className={compact ? 'h-[218px]' : 'h-[238px]'}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 20, right: 28, left: 0, bottom: 22 }}>
            <defs>
              <linearGradient id="riskFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.74} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(92, 152, 214, .14)" vertical={false} />
            <ReferenceLine y={axis.toPlot(35)} label={{ value: t('Low').toUpperCase(), position: 'insideRight', fill: '#00e889', fontSize: 12, fontWeight: 700}} stroke="#00e889" strokeDasharray="5 5" strokeOpacity={0.42} />
            <ReferenceLine y={axis.toPlot(65)} label={{ value: t('Medium').toUpperCase(), position: 'insideRight', fill: '#ffd33d', fontSize: 12, fontWeight: 700}} stroke="#ffd33d" strokeDasharray="5 5" strokeOpacity={0.42} />
            <ReferenceLine y={axis.toPlot(80)} label={{ value: `${t('High').toUpperCase()} / ${t('Critical').toUpperCase()}`, position: 'insideRight', fill: '#ff3648', fontSize: 12, fontWeight: 700}} stroke="#ff3648" strokeDasharray="5 5" strokeOpacity={0.5} />
            <XAxis dataKey="date" tickFormatter={(value) => timeTick(String(value), granularity, language)} minTickGap={granularity === 'hour' ? 80 : 48} tick={{ fill: '#98b3d1', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#98b3d1', fontSize: 12 }} domain={axis.domain} ticks={axis.ticks} tickFormatter={axis.label} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(_, name, payload) => [Number((payload as { payload?: RiskTrendPoint })?.payload?.avgRiskScore ?? 0).toFixed(1), name === 'visualRisk' ? t('Operational Risk Score') : t(String(name))]}
              labelFormatter={(_, payload) => {
                const point = payload?.[0]?.payload as RiskTrendPoint | undefined;
                return point ? `${point.date} | ${t('Critical')}: ${point.criticalCount} | ${t('High')}: ${point.highCount} | ${t('Machine')}: ${point.topMachine}` : '';
              }}
            />
            <Area type="monotone" dataKey="visualRisk" name="avg_risk_score" stroke="#b96cff" strokeWidth={3} fill="url(#riskFill)" dot={data.length <= 48 ? { r: 4, fill: '#fff', stroke: '#b96cff', strokeWidth: 2 } : false} activeDot={{ r: 7 }} />
            <Brush dataKey="date" height={24} stroke="#3e9ffc" travellerWidth={8} startIndex={viewport.startIndex} endIndex={viewport.endIndex} onChange={(next) => { setManualViewport(true); setViewport({ startIndex: next.startIndex ?? 0, endIndex: next.endIndex ?? Math.max(0, data.length - 1) }); }} tickFormatter={() => ''} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
