import { useTooltipAnchor, type TooltipCoordinate } from "./useTooltipAnchor";

interface TooltipItem {
  dataKey: string;
  color: string;
  name?: string;
  value: number | string;
  payload?: { timestamp?: string };
}

interface Props {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string;
  coordinate?: TooltipCoordinate;
  valueResolver?: (item: TooltipItem) => number | string;
}

export function ChartTooltip({ active, payload, label, coordinate, valueResolver }: Props) {
  const tooltipRef = useTooltipAnchor(active, coordinate);
  if (!active || !payload?.length) return null;
  return (
    <div ref={tooltipRef} className="md-chart-tooltip" data-tooltip-side="above">
      <div className="md-chart-tooltip-label">{payload[0]?.payload?.timestamp ?? label}</div>
      {payload.map((item) => (
        <div className="md-chart-tooltip-row" key={item.dataKey}>
          <i className="md-chart-tooltip-swatch" style={{ backgroundColor: item.color }} />
          <span>{item.name ?? item.dataKey}</span>
          <b>{(() => {
            const value = valueResolver?.(item) ?? item.value;
            return typeof value === "number" ? new Intl.NumberFormat('en-US', { maximumFractionDigits: Math.abs(value) < 1 ? 3 : 1 }).format(value) : value;
          })()}</b>
        </div>
      ))}
    </div>
  );
}
