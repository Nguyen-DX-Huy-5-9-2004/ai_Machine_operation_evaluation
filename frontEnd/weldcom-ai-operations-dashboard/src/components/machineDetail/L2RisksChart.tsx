import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo } from "react";
import type { RiskPoint } from "../../types/machineDetail";
import { usePersistentBrushViewport } from "../../hooks/usePersistentBrushViewport";
import { compactMachineSeries } from "../../utils/machineDetailCharts";
import { focusedLinearDomain } from "../../utils/thresholdFocusAxis";
import { ChartTooltip } from "./ChartTooltip";
import { InfoDot } from "./InfoDot";

export function L2RisksChart({ data }: { data: RiskPoint[] }) {
  const chartData = useMemo(() => compactMachineSeries(
    data,
    46,
    (point) => [point.faultRisk, point.maintenanceRisk, point.repairRisk],
    (point) => Math.max(point.faultRisk, point.maintenanceRisk, point.repairRisk) >= 50,
  ), [data]);
  // Live probabilities often move inside a narrow healthy band. A local
  // domain makes that movement inspectable without altering the raw values.
  const domain = useMemo(() => focusedLinearDomain(chartData.flatMap((point) => [point.faultRisk, point.maintenanceRisk, point.repairRisk]), 2), [chartData]);
  const brush = usePersistentBrushViewport(chartData, (point) => point.timestamp ?? point.time, 24);
  return (
    <section className="md-panel md-chart-card">
      <div className="md-panel-header compact">
        <div className="md-title-with-info">
          <h3>L2 Risks Over Time</h3>
          <InfoDot text="L2 LightGBM multi-label risk trend for fault, maintenance, and repair targets." />
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
            domain={domain}
            tick={{ fill: "#87a3c5", fontSize: 11 }}
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
            type="monotone"
            dataKey="faultRisk"
            name="Fault Risk"
            stroke="#ff334f"
            strokeWidth={2.2}
            dot={false}
            activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
          />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="maintenanceRisk"
            name="Maintenance Risk"
            stroke="#b45cff"
            strokeWidth={2.1}
            dot={false}
            activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
          />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="repairRisk"
            name="Repair Risk"
            stroke="#ff9900"
            strokeWidth={2.1}
            dot={false}
            activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
          />
          {chartData.length > 18 && <Brush dataKey="time" height={18} travellerWidth={7} tickFormatter={() => ''} stroke="#bb5cff" fill="#111d38" startIndex={brush.range.startIndex} endIndex={brush.range.endIndex} onChange={brush.onChange} />}
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
