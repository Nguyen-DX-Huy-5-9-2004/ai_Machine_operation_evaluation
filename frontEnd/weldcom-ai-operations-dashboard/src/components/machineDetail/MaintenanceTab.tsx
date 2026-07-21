import {
  Line,
  LineChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  MachineDetailResponse,
  MaintenanceTask,
} from "../../types/machineDetail";
import { ChartTooltip } from "./ChartTooltip";
import { InfoDot } from "./InfoDot";

interface Props {
  data: MachineDetailResponse;
}

export function MaintenanceTab({ data }: Props) {
  return (
    <div className="md-tab-workspace maintenance-tab">
      <section className="md-tab-grid two-one">
        <div className="md-panel md-chart-card tall">
          <div className="md-panel-header compact">
            <div className="md-title-with-info">
              <h3>Maintenance & Repair Risk</h3>
              <InfoDot text="L2 trend for maintenance and repair risks. Used for planning, not automatic work-order creation." />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={290}>
            <LineChart
              data={data.riskSeries}
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
                type="monotone"
                dataKey="maintenanceRisk"
                name="Maintenance risk"
                stroke="#b45cff"
                strokeWidth={2.4}
                dot={{ r: 2 }}
                activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="repairRisk"
                name="Repair risk"
                stroke="#ff9900"
                strokeWidth={2.4}
                dot={{ r: 2 }}
                activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="md-panel md-maintenance-signals">
          <div className="md-panel-header compact">
            <div className="md-title-with-info">
              <h3>Maintenance Signals</h3>
              <InfoDot text="Operator-facing signals generated from L2 and policy evidence." />
            </div>
          </div>
          {data.maintenanceSignals.map((signal) => (
            <div
              className={`md-signal-row level-${String(signal.level).toLowerCase()}`}
              key={signal.label}
            >
              <span>
                {signal.label}
                <small>{signal.description}</small>
              </span>
              <b>{signal.value}</b>
            </div>
          ))}
        </div>
      </section>
      <section className="md-panel md-maintenance-plan">
        <div className="md-panel-header compact">
          <div className="md-title-with-info">
            <h3>Inspection Plan</h3>
            <InfoDot text="Read-only maintenance planning view. Do not treat as an automatic CMMS/work-order workflow yet." />
          </div>
          <button className="md-link-button">Export checklist →</button>
        </div>
        <div className="md-task-grid">
          {data.maintenanceTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </section>
    </div>
  );
}

function TaskCard({ task }: { task: MaintenanceTask }) {
  return (
    <article className={`md-task-card level-${task.priority.toLowerCase()}`}>
      <div className="task-topline">
        <span>{task.id}</span>
        <b>{task.priority}</b>
      </div>
      <h4>{task.title}</h4>
      <p>{task.reason}</p>
      <div className="task-meta">
        <span>Due: {task.due}</span>
        <span>Owner: {task.owner}</span>
        <span>Status: {task.status}</span>
        <span>Confidence: {task.confidencePct}%</span>
      </div>
      <div className="md-source-tags">
        {task.sourceFields.map((field) => (
          <span key={field}>{field}</span>
        ))}
      </div>
    </article>
  );
}
