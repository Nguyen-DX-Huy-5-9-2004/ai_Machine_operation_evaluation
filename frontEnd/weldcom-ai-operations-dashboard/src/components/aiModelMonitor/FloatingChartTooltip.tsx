import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";

interface TooltipCoordinate {
  x?: number;
  y?: number;
}

interface FloatingChartTooltipProps {
  active?: boolean;
  coordinate?: TooltipCoordinate;
  children: ReactNode;
}

interface TooltipPosition {
  left: number;
  top: number;
  tailX: number;
  side: "above" | "below";
}

/** Renders outside chart and panel stacking contexts so the popup is never obscured. */
export function FloatingChartTooltip({
  active,
  coordinate,
  children,
}: FloatingChartTooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!active || !anchor || !tooltip || coordinate?.x == null || coordinate.y == null) {
      setPosition(null);
      return;
    }
    const { x, y } = coordinate;

    const frame = requestAnimationFrame(() => {
      const chart = anchor.closest(".recharts-wrapper");
      if (!chart) return;

      const chartRect = chart.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const pointX = chartRect.left + x;
      const pointY = chartRect.top + y;
      const side = pointY < tooltipRect.height + 18 ? "below" : "above";
      const left = Math.max(
        12,
        Math.min(pointX - tooltipRect.width / 2, window.innerWidth - tooltipRect.width - 12),
      );
      const top = side === "below" ? pointY + 14 : pointY - tooltipRect.height - 14;
      const tailX = Math.max(16, Math.min(pointX - left, tooltipRect.width - 16));

      setPosition({ left, top, tailX, side });
    });

    return () => cancelAnimationFrame(frame);
  }, [active, coordinate?.x, coordinate?.y]);

  if (!active) return null;

  return (
    <>
      <span ref={anchorRef} className="amm-chart-tooltip-anchor" aria-hidden="true" />
      {createPortal(
        <div
          ref={tooltipRef}
          className="amm-chart-tooltip amm-chart-tooltip--portal"
          data-tooltip-side={position?.side ?? "above"}
          style={{
            left: position?.left ?? -9999,
            top: position?.top ?? -9999,
            visibility: position ? "visible" : "hidden",
            "--amm-tooltip-anchor-x": `${position?.tailX ?? 50}px`,
          } as CSSProperties}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  );
}
