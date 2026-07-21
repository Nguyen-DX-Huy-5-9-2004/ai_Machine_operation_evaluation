import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { KwhPoint } from "../../types/machineDetail";
import { ChartTooltip } from "./ChartTooltip";
import { InfoDot } from "./InfoDot";

export function EventKwhDeltaChart({ data }: { data: KwhPoint[] }) {
  return (
    <section className="md-panel md-chart-card">
      <div className="md-panel-header compact">
        <div className="md-title-with-info">
          <h3>Event KWh Delta</h3>
          <InfoDot text="Event-level processed KWh delta for the selected machine. This is not cabinet-level total energy." />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={236}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 12, bottom: 4, left: -16 }}
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
          />
          <YAxis tick={{ fill: "#87a3c5", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            content={<ChartTooltip />}
            cursor={false}
            offset={16}
            allowEscapeViewBox={{ x: false, y: true }}
            wrapperStyle={{ zIndex: 400, pointerEvents: "none" }}
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="kwhDelta"
            name="KWh Delta"
            stroke="#1790ff"
            fill="url(#kwhGradient)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="md-chart-footnote">
        <b>Total: +48.2 kWh</b>
        <span>Avg rate: 12.4 kWh/h</span>
      </div>
    </section>
  );
}

export function LoadedKwhEvidenceChart({ data }: { data: KwhPoint[] }) {
  return (
    <section className="md-panel md-chart-card">
      <div className="md-panel-header compact">
        <div className="md-title-with-info">
          <h3>Loaded Status vs KWh Evidence</h3>
          <InfoDot text="Compares actual processed KWh, expected baseline, and loaded-state signal. Use this as evidence, not as a hard diagnosis alone." />
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
            yAxisId="left"
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
