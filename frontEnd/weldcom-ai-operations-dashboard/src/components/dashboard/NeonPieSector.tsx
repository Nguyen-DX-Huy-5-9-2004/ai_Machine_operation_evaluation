import { Sector } from 'recharts';
import type { PieSectorShapeProps } from 'recharts';

export function createNeonPieShape(activeIndex: number | null) {
  return (props: PieSectorShapeProps) => {
    const isFocused = activeIndex === null || activeIndex === props.index;
    const isActive = activeIndex === props.index;
    const innerRadius = Number(props.innerRadius ?? 0);
    const outerRadius = Number(props.outerRadius ?? 0);

    return (
      <Sector
        {...props}
        innerRadius={isActive ? Math.max(innerRadius - 3, 0) : innerRadius}
        outerRadius={isActive ? outerRadius + 6 : outerRadius}
        opacity={isFocused ? 1 : 0.34}
        stroke={isActive ? '#ffffff' : 'rgba(255,255,255,.16)'}
        strokeWidth={isActive ? 2.5 : 1}
        style={isActive ? { filter: `drop-shadow(0 0 10px ${props.fill})` } : undefined}
      />
    );
  };
}
