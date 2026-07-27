import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo, useState } from "react";
import type { L1Point } from "../../types/machineDetail";
import { usePersistentBrushViewport } from "../../hooks/usePersistentBrushViewport";
import { compactMachineSeries } from "../../utils/machineDetailCharts";
import { thresholdFocusAxis } from "../../utils/thresholdFocusAxis";
import { ChartTooltip } from "./ChartTooltip";
import { InfoDot } from "./InfoDot";
import { useAppLanguage, useUiText } from '../../i18n/appTranslations';
import { formatChartTime } from '../../utils/formatters';

export function L1AnomalyChart({ data }: { data: L1Point[] }) {
  const t = useUiText();
  const language = useAppLanguage();
  const [hoveredHistogram, setHoveredHistogram] = useState<{ point: L1Point; index: number } | null>(null);
  // Mock fixtures store L1 scores as ratios; API/replay uses the operator
  // index already. Convert both to the same 0..100 presentation contract.
  const ratioScale = useMemo(() => {
    const source = data.flatMap((point) => [point.score, point.anomalyThreshold, point.warningThreshold]);
    return source.length > 0 && Math.max(...source) <= 1.5 ? 100 : 1;
  }, [data]);
  const normalized = useMemo(() => data.map((point) => ({
    ...point,
    score: point.score * ratioScale,
    anomalyThreshold: point.anomalyThreshold * ratioScale,
    warningThreshold: point.warningThreshold * ratioScale,
  })), [data, ratioScale]);
  const chartData = useMemo(() => compactMachineSeries(
    normalized,
    46,
    (point) => [point.score, point.anomalyThreshold, point.warningThreshold],
    (point) => point.status === 'Anomaly' || point.status === 'Sensitive warning',
  ), [normalized]);
  const thresholds = useMemo(() => chartData.length ? [chartData[0].warningThreshold, chartData[0].anomalyThreshold] : [40, 76], [chartData]);
  const axis = useMemo(() => thresholdFocusAxis(chartData.map((point) => point.score), thresholds), [chartData, thresholds]);
  const plottedData = useMemo(() => chartData.map((point) => ({
    ...point,
    visualScore: axis.toPlot(point.score),
    visualAnomalyThreshold: axis.toPlot(point.anomalyThreshold),
    visualWarningThreshold: axis.toPlot(point.warningThreshold),
  })), [axis, chartData]);
  const brush = usePersistentBrushViewport(plottedData, (point, index) => point.eventId ?? `${point.timestamp ?? point.time}-${index}`, 24);
  return (
    <section className="md-panel md-chart-card">
      <div className="md-panel-header compact">
        <div className="md-title-with-info">
          <h3>{t('L1 Anomaly Score Over Time')}</h3>
          <InfoDot text="L1 TCN Autoencoder deviation score. Red dashed line is anomaly threshold; yellow dashed line is warning threshold." />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={176}>
        <AreaChart
          data={plottedData}
          margin={{ top: 10, right: 10, bottom: 30, left: -14 }}
        >
          <defs>
            <linearGradient id="l1Gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#183555"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tickFormatter={(value) => formatChartTime(value, language)}
            tick={{ fill: "#87a3c5", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis
            domain={axis.domain}
            ticks={axis.ticks}
            tickFormatter={axis.label}
            tick={{ fill: "#87a3c5", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<ChartTooltip valueResolver={(item) => item.dataKey === 'visualScore' ? Number((item.payload as { score?: number } | undefined)?.score ?? item.value) : item.value} />}
            cursor={false}
            offset={16}
            allowEscapeViewBox={{ x: false, y: true }}
            wrapperStyle={{ zIndex: 400, pointerEvents: "none" }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ color: "#b7c7dd", fontSize: 11 }}
          />
          <ReferenceLine y={axis.toPlot(thresholds[1])} stroke="#ff375f" strokeDasharray="6 4" strokeWidth={1.5} />
          <ReferenceLine y={axis.toPlot(thresholds[0])} stroke="#f5b82e" strokeDasharray="6 4" strokeWidth={1.5} />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="visualScore"
            name={t('L1 Score')}
            stroke="#a855f7"
            fill="url(#l1Gradient)"
            strokeWidth={2.2}
            dot={false}
            activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
          />
          {plottedData.length > 18 && <Brush dataKey="time" height={16} travellerWidth={7} tickFormatter={() => ''} stroke="#9354d8" fill="#111d38" startIndex={brush.range.startIndex} endIndex={brush.range.endIndex} onChange={brush.onChange} />}
        </AreaChart>
      </ResponsiveContainer>
      <div className="md-l1-histogram" aria-label={t('L1 anomaly score distribution strip')}>
        {plottedData.map((point, index) => (
          <span
            key={point.eventId ?? `${point.timestamp}-${index}`}
            style={{ height: `${Math.max(7, Math.min(100, point.score))}%` }}
            onMouseEnter={() => setHoveredHistogram({ point, index })}
            onMouseLeave={() => setHoveredHistogram(null)}
          />
        ))}
        {hoveredHistogram && <div className="md-l1-histogram-tooltip" style={{ left: `${((hoveredHistogram.index + .5) / Math.max(1, plottedData.length)) * 100}%` }}>
          <b>{hoveredHistogram.point.timestamp ?? hoveredHistogram.point.time}</b>
            <span>{t('L1 Score')} {hoveredHistogram.point.score.toFixed(1)}%</span>
        </div>}
      </div>
    </section>
  );
}
