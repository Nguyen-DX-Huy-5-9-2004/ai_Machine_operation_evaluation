import { createPortal } from 'react-dom';
import { useRef, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useUiText } from '../i18n/appTranslations';

interface SparklineProps {
  data: number[];
  color?: string;
  strokeWidth?: number;
  height?: number;
}

export function Sparkline({ data, color = '#1677ff', strokeWidth = 2, height = 42 }: SparklineProps) {
  const t = useUiText();
  const chartData = data.map((value, index) => ({ index, value }));
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ index: number; value: number; x: number; y: number } | null>(null);

  const handleMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds || !chartData.length) return;

    const chartWidth = Math.max(bounds.width - 8, 1);
    const relativeX = Math.min(Math.max(event.clientX - bounds.left - 4, 0), chartWidth);
    const index = Math.min(
      chartData.length - 1,
      Math.max(0, Math.round((relativeX / chartWidth) * (chartData.length - 1)))
    );

    setHover({
      index,
      value: chartData[index].value,
      x: event.clientX,
      y: event.clientY
    });
  };

  const showBelow = hover ? hover.y < 78 : false;

  return (
    <div
      ref={containerRef}
      className="sparkline"
      style={{ color, height }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHover(null)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
        >
          <Tooltip content={() => null} cursor={false} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={strokeWidth}
            dot={false}
            activeDot={{ r: 3, fill: color, stroke: '#ffffff', strokeWidth: 1.5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      {hover ? createPortal(
        <div
          className={['sparkline-floating-tooltip', showBelow ? 'is-below' : ''].join(' ')}
          style={{ left: hover.x, top: hover.y }}
        >
          <span>{t('Point')} {hover.index + 1}</span>
          <strong>{hover.value}</strong>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
