import { Line, LineChart, ResponsiveContainer } from 'recharts';

interface SparklineProps {
  data: number[];
  color?: string;
  strokeWidth?: number;
  height?: number;
}

export function Sparkline({ data, color = '#1677ff', strokeWidth = 2, height = 42 }: SparklineProps) {
  const chartData = data.map((value, index) => ({ index, value }));
  return (
    <div className="sparkline" style={{ color, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={strokeWidth} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
