import { useTooltipAnchor, type TooltipCoordinate } from "./useTooltipAnchor";

interface TooltipItem {
  dataKey: string;
  color: string;
  name?: string;
  value: number | string;
}

interface Props {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string;
  coordinate?: TooltipCoordinate;
}

export function ChartTooltip({ active, payload, label, coordinate }: Props) {
  const tooltipRef = useTooltipAnchor(active, coordinate);
  if (!active || !payload?.length) return null;
  return (
    <div ref={tooltipRef} className="md-chart-tooltip" data-tooltip-side="above">
      <div className="md-chart-tooltip-label">{label}</div>
      {payload.map((item) => (
        <div className="md-chart-tooltip-row" key={item.dataKey}>
          <i className="md-chart-tooltip-swatch" style={{ backgroundColor: item.color }} />
          <span>{item.name ?? item.dataKey}</span>
          <b>{typeof item.value === "number" ? Number(item.value).toFixed(item.value < 1 ? 2 : 1) : item.value}</b>
        </div>
      ))}
    </div>
  );
}
