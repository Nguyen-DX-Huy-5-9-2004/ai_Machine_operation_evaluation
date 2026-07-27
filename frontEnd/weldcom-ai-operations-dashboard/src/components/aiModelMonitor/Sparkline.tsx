import { useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import { useUiText } from '../../i18n/appTranslations';

interface SparklineProps {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  label?: string;
}

export function Sparkline({
  values,
  color = "currentColor",
  width = 82,
  height = 26,
  label = "Trend",
}: SparklineProps) {
  const t = useUiText();
  const [hover, setHover] = useState<{
    index: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.0001);
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  const activeValue = hover == null ? null : values[hover.index];
  const activeX = hover == null ? 0 : (hover.index / (values.length - 1)) * width;
  const activeY = activeValue == null ? 0 : height - ((activeValue - min) / range) * (height - 4) - 2;

  return (
    <span
      className="amm-sparkline-wrap"
      onMouseLeave={() => setHover(null)}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        setHover({
          index: Math.round(ratio * (values.length - 1)),
          clientX: event.clientX,
          clientY: event.clientY,
        });
      }}
    >
      <svg className="amm-sparkline" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {activeValue != null ? <circle cx={activeX} cy={activeY} r="3" fill={color} stroke="#f4fbff" strokeWidth="1.2" /> : null}
      </svg>
      {activeValue != null && hover
        ? createPortal(
            <span
              className="amm-sparkline-tooltip amm-sparkline-tooltip--portal"
              data-tooltip-side={hover.clientY < 96 ? "below" : "above"}
              style={
                {
                  left: hover.clientX,
                  top: hover.clientY + (hover.clientY < 96 ? 14 : -14),
                } as CSSProperties
              }
            >
              <b>{t(label)}</b>
              <span>{activeValue.toFixed(activeValue < 10 ? 2 : 1)}</span>
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
