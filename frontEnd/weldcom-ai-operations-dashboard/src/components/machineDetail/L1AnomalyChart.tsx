import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { L1Point } from "../../types/machineDetail";
import { ChartTooltip } from "./ChartTooltip";
import { InfoDot } from "./InfoDot";

export function L1AnomalyChart({ data }: { data: L1Point[] }) {
  return (
    <section className="md-panel md-chart-card">
      <div className="md-panel-header compact">
        <div className="md-title-with-info">
          <h3>L1 Anomaly Score Over Time</h3>
          <InfoDot text="L1 TCN Autoencoder deviation score. Red dashed line is anomaly threshold; yellow dashed line is warning threshold." />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={206}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, bottom: 4, left: -14 }}
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
            tick={{ fill: "#87a3c5", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 1]}
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
          <ReferenceLine y={0.76} stroke="#ff375f" strokeDasharray="6 4" strokeWidth={1.5} />
          <ReferenceLine y={0.4} stroke="#f5b82e" strokeDasharray="6 4" strokeWidth={1.5} />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="score"
            name="L1 Score"
            stroke="#a855f7"
            fill="url(#l1Gradient)"
            strokeWidth={2.2}
            dot={{ r: 2 }}
            activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="md-mini-brush" aria-hidden="true">
        {data.map((p) => (
          <span
            key={p.eventId}
            style={{ height: `${Math.max(10, p.score * 100)}%` }}
          />
        ))}
      </div>
    </section>
  );
}
