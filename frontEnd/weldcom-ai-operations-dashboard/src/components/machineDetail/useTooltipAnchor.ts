import { useLayoutEffect, useRef } from "react";

export interface TooltipCoordinate {
  x?: number;
  y?: number;
}

/**
 * Recharts keeps a tooltip inside the chart when it approaches an edge.
 * Measure that final position so the tooltip tail can still point at the
 * hovered datum instead of using a fixed horizontal offset.
 */
export function useTooltipAnchor(
  active?: boolean,
  coordinate?: TooltipCoordinate,
) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    if (!active || !tooltip || coordinate?.x == null || coordinate.y == null) {
      return;
    }

    const wrapper = tooltip.parentElement;
    const chart = tooltip.closest(".recharts-wrapper");
    if (!wrapper || !chart) return;

    const chartRect = chart.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const pointX = chartRect.left + coordinate.x;
    const pointY = chartRect.top + coordinate.y;
    const tailX = Math.max(
      16,
      Math.min(pointX - wrapperRect.left, tooltipRect.width - 16),
    );
    const showBelow = pointY - chartRect.top < tooltipRect.height + 22;

    tooltip.style.setProperty("--md-tooltip-anchor-x", `${Math.round(tailX)}px`);
    tooltip.dataset.tooltipSide = showBelow ? "below" : "above";
    wrapper.style.setProperty(
      "--md-tooltip-offset-y",
      showBelow ? "12px" : "calc(-100% - 12px)",
    );

    return () => {
      wrapper.style.removeProperty("--md-tooltip-offset-y");
    };
  }, [active, coordinate?.x, coordinate?.y]);

  return tooltipRef;
}
