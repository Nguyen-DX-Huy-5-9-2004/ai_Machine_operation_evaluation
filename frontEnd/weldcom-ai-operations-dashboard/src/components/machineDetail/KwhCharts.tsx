import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { useMemo } from "react";
import type { KwhPoint } from "../../types/machineDetail";
import { usePersistentBrushViewport } from "../../hooks/usePersistentBrushViewport";
import { chartDomain, compactMachineSeries, formatMachineNumber } from "../../utils/machineDetailCharts";
import { focusedLinearDomain } from "../../utils/thresholdFocusAxis";
import { ChartTooltip } from "./ChartTooltip";
import { InfoDot } from "./InfoDot";

export function EventKwhDeltaChart({ data }: { data: KwhPoint[] }) {
  const chartData = useMemo(() => compactMachineSeries(data, 52, (point) => [point.kwhDelta], (point) => Math.abs(point.kwhDelta) > 0.25), [data]);
  const domain = useMemo(() => {
    const values = chartData.map((point) => point.kwhDelta);
    return focusedLinearDomain(values, 0.08);
  }, [chartData]);
  const total = useMemo(() => data.reduce((sum, point) => sum + point.kwhDelta, 0), [data]);
  const averageRate = useMemo(() => data.length ? total / data.length : 0, [data, total]);
  const brush = usePersistentBrushViewport(chartData, (point) => point.timestamp ?? point.time, 24);
  return (
    <section className="md-panel md-chart-card">
      <div className="md-panel-header compact">
        <div className="md-title-with-info">
          <h3>Event KWh Delta (Model Input)</h3>
          <InfoDot text="Event-level KWh difference after the energy preparation used by AI. It is not voltage or a cabinet total; a negative value means the processed delta is below its reference." />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={236}>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 12, bottom: 30, left: -16 }}
        >
          <defs>
            <linearGradient id="kwhGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#178bff" stopOpacity={0.7} />
              <stop offset="95%" stopColor="#178bff" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#183555"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tick={{ fill: "#87a3c5", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis domain={domain} tick={{ fill: "#87a3c5", fontSize: 11 }} axisLine={false} tickLine={false} />
          <ReferenceLine y={0} stroke="#53718e" strokeDasharray="4 4" />
          <Tooltip
            content={<ChartTooltip />}
            cursor={false}
            offset={16}
            allowEscapeViewBox={{ x: false, y: true }}
            wrapperStyle={{ zIndex: 400, pointerEvents: "none" }}
          />
          <Area
            isAnimationActive={false}
            type="linear"
            dataKey="kwhDelta"
            name="KWh Delta"
            stroke="#1790ff"
            fill="url(#kwhGradient)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
          />
          {chartData.length > 18 && <Brush dataKey="time" height={18} travellerWidth={7} tickFormatter={() => ''} stroke="#168fff" fill="#111d38" startIndex={brush.range.startIndex} endIndex={brush.range.endIndex} onChange={brush.onChange} />}
        </AreaChart>
      </ResponsiveContainer>
      <div className="md-chart-footnote">
        <b>Total: {total >= 0 ? '+' : ''}{formatMachineNumber(total, 2)} kWh</b>
        <span>Processed difference: {formatMachineNumber(averageRate, 3)} kWh/event</span>
      </div>
    </section>
  );
}

export function LoadedKwhEvidenceChart({ data }: { data: KwhPoint[] }) {
  const chartData = useMemo(() => compactMachineSeries(data, 72, (point) => [point.actualKwh ?? 0, point.expectedKwh ?? 0, point.loaded ?? 0]), [data]);
  const leftDomain = useMemo(() => {
    const values = chartData.flatMap((point) => [point.actualKwh ?? 0, point.expectedKwh ?? 0]);
    const [, maximum] = chartDomain(values, { includeZero: true, minimumSpan: 0.1 });
    return [0, Math.ceil(maximum * 10) / 10] as [number, number];
  }, [chartData]);
  const brush = usePersistentBrushViewport(chartData, (point) => point.timestamp ?? point.time, 24);
  return (
    <section className="md-panel md-chart-card">
      <div className="md-panel-header compact">
        <div className="md-title-with-info">
          <h3>Loaded Status vs KWh Evidence</h3>
          <InfoDot text="Compares event KWh with loaded status joined from the machine timeline. It is supporting evidence, not a hard diagnosis alone." />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={236}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 14, bottom: 30, left: -16 }}
        >
          <CartesianGrid
            stroke="#183555"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tick={{ fill: "#87a3c5", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis
            yAxisId="left"
            domain={leftDomain}
            tick={{ fill: "#87a3c5", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 1]}
            tick={{ fill: "#37e58d", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={false}
            offset={16}
            allowEscapeViewBox={{ x: false, y: true }}
            wrapperStyle={{ zIndex: 400, pointerEvents: "none" }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ color: "#b7c7dd", fontSize: 11 }}
          />
          <Line
            isAnimationActive={false}
            yAxisId="left"
            type="monotone"
            dataKey="actualKwh"
            name="Actual KWh"
            stroke="#1790ff"
            strokeWidth={2.2}
            dot={false}
            activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
          />
          <Line
            isAnimationActive={false}
            yAxisId="left"
            type="monotone"
            dataKey="expectedKwh"
            name="Expected KWh"
            stroke="#69a7ff"
            strokeWidth={1.8}
            strokeDasharray="6 4"
            dot={false}
            activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
          />
          <Line
            isAnimationActive={false}
            yAxisId="right"
            type="stepAfter"
            dataKey="loaded"
            name="Loaded"
            stroke="#27d980"
            strokeWidth={1.8}
            dot={false}
            activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
          />
          {chartData.length > 18 && <Brush dataKey="time" height={18} travellerWidth={7} tickFormatter={() => ''} stroke="#18c983" fill="#111d38" startIndex={brush.range.startIndex} endIndex={brush.range.endIndex} onChange={brush.onChange} />}
        </LineChart>
      </ResponsiveContainer>
      <div className="md-chip-row">
        <span className="chip danger">Deviation +18.3%</span>
        <span className="chip warning">Consistency 63%</span>
        <span className="chip warning">Quality Moderate</span>
      </div>
    </section>
  );
}
