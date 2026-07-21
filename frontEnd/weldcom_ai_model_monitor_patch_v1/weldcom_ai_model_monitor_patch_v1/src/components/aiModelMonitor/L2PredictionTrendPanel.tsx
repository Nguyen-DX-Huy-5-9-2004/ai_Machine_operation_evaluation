import { useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { L2TrendPoint } from '../../types/aiModelMonitor';
import { Panel } from './Panel';

interface TooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
}

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="amm-chart-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}: <b>{item.value?.toFixed(1)}%</b></span>)}
    </div>
  );
}

export function L2PredictionTrendPanel({ data }: { data: L2TrendPoint[] }) {
  const [granularity, setGranularity] = useState('Hourly');
  return (
    <Panel
      title="L2 Positive Prediction Rate by Target"
      tooltip="Xu hướng tỷ lệ dự đoán dương tính của từng target L2; dùng để phát hiện prediction drift hoặc thay đổi vận hành."
      action={(
        <select className="amm-select" value={granularity} onChange={(event: ChangeEvent<HTMLSelectElement>) => setGranularity(event.target.value)}>
          <option>Hourly</option><option>Daily</option><option>Weekly</option>
        </select>
      )}
      className="amm-trend-panel"
    >
      <div className="amm-chart-height">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
            <CartesianGrid stroke="rgba(91, 147, 204, .12)" vertical={false} />
            <XAxis dataKey="timestamp" tick={{ fill: '#829bb5', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'rgba(91,147,204,.2)' }} minTickGap={28} />
            <YAxis domain={[0, 50]} tick={{ fill: '#829bb5', fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
            <Tooltip content={<TrendTooltip />} />
            <Legend iconType="line" wrapperStyle={{ color: '#b5c8dc', fontSize: 11, paddingBottom: 6 }} />
            <Line type="monotone" dataKey="fault30m" name="Fault 30min" stroke="#bd3cff" strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="fault60m" name="Fault 60min" stroke="#ff3e52" strokeWidth={2.1} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="maintenance30e" name="Maintenance 30 events" stroke="#ffb21a" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="repair30e" name="Repair 30 events" stroke="#11d79a" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
