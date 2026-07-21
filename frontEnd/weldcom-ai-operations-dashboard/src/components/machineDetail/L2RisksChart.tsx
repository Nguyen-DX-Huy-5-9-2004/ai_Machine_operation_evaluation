import {
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RiskPoint } from "../../types/machineDetail";
import { ChartTooltip } from "./ChartTooltip";
import { InfoDot } from "./InfoDot";

export function L2RisksChart({ data }: { data: RiskPoint[] }) {
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
          data={data}
          margin={{ top: 10, right: 14, bottom: 4, left: -16 }}
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
          />
          <YAxis
            domain={[0, 100]}
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
            dot={{ r: 2 }}
            activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
          />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="maintenanceRisk"
            name="Maintenance Risk"
            stroke="#b45cff"
            strokeWidth={2.1}
            dot={{ r: 2 }}
            activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
          />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="repairRisk"
            name="Repair Risk"
            stroke="#ff9900"
            strokeWidth={2.1}
            dot={{ r: 2 }}
            activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
