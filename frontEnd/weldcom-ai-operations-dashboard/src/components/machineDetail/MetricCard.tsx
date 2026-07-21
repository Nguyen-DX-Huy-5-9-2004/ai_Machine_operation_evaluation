import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBolt,
  faBrain,
  faCircleCheck,
  faDatabase,
  faLayerGroup,
  faLocationDot,
  faMicrochip,
  faTriangleExclamation,
  faWaveSquare,
} from "@fortawesome/free-solid-svg-icons";
import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";
import type { MachineKpi } from "../../types/machineDetail";
import { useTooltipAnchor, type TooltipCoordinate } from "./useTooltipAnchor";

interface MetricCardProps {
  metric: MachineKpi;
}

interface SparkTooltipProps {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: { index?: number } }>;
  coordinate?: TooltipCoordinate;
  metric: MachineKpi;
}

const metricIcons = {
  machineId: faMicrochip,
  location: faLocationDot,
  group: faLayerGroup,
  status: faCircleCheck,
  risk30: faTriangleExclamation,
  l1: faWaveSquare,
  l2: faBrain,
  quality: faDatabase,
  energy: faBolt,
};

function levelClass(level?: string) {
  return `level-${(level ?? "INFO").toLowerCase().replace(/_/g, "-")}`;
}

function MetricSparkTooltip({ active, payload, coordinate, metric }: SparkTooltipProps) {
  const tooltipRef = useTooltipAnchor(active, coordinate);
  const point = payload?.[0];
  if (!active || typeof point?.value !== "number") return null;

  const value = point.value;
  const formatted = value > 0 && value < 1 ? value.toFixed(2) : Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return (
    <div ref={tooltipRef} className="md-kpi-spark-tooltip" data-tooltip-side="above">
      <span>{metric.label}</span>
      <b>{formatted}{metric.suffix ?? ""}</b>
    </div>
  );
}

export function MetricCard({ metric }: MetricCardProps) {
  const trend = metric.trend?.map((value, index) => ({ index, value })) ?? [];
  const icon =
    metricIcons[metric.key as keyof typeof metricIcons] ?? faMicrochip;
  return (
    <div
      className={`md-metric-card metric-${metric.key} ${levelClass(metric.level)}`}
    >
      <div className="md-metric-header">
        <span>{metric.label}</span>
        <span className="md-metric-icon">
          <FontAwesomeIcon icon={icon} />
        </span>
      </div>
      <div className="md-metric-main">
        <span className="md-metric-value">
          {metric.value}
          {metric.suffix ?? ""}
        </span>
        {metric.trend && (
          <div className="md-metric-spark">
            <ResponsiveContainer width="100%" height={34}>
              <LineChart
                data={trend}
                margin={{ top: 4, right: 2, bottom: 0, left: 2 }}
              >
                <Tooltip
                  content={<MetricSparkTooltip metric={metric} />}
                  cursor={false}
                  offset={12}
                  allowEscapeViewBox={{ x: false, y: true }}
                  wrapperStyle={{ zIndex: 500, pointerEvents: "none" }}
                />
                <Line
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="value"
                  stroke="currentColor"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      {metric.subLabel && (
        <div className="md-metric-sub">{metric.subLabel}</div>
      )}
    </div>
  );
}
