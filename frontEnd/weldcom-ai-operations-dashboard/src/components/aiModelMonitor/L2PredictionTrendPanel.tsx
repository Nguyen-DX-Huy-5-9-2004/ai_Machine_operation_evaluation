import { useState } from "react";
import type { ChangeEvent } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { L2TrendPoint, MonitorProvenance } from "../../types/aiModelMonitor";
import { Panel } from "./Panel";
import { FloatingChartTooltip } from "./FloatingChartTooltip";
import { useAppLanguage, useUiText } from '../../i18n/appTranslations';
import { formatChartTime } from '../../utils/formatters';

interface TooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
}

function TrendTooltip({
  active,
  payload,
  label,
  coordinate,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  coordinate?: { x?: number; y?: number };
}) {
  const language = useAppLanguage();
  if (!active || !payload?.length) return null;
  return (
    <FloatingChartTooltip active={active} coordinate={coordinate}>
      <strong>{formatChartTime(label, language)}</strong>
      {payload.map((item) => (
        <span key={item.name}>
          <i style={{ background: item.color }} />
          {item.name}: <b>{item.value?.toFixed(1)}%</b>
        </span>
      ))}
    </FloatingChartTooltip>
  );
}

export function L2PredictionTrendPanel({ data, source }: { data: L2TrendPoint[]; source?: MonitorProvenance }) {
  const language = useAppLanguage();
  const t = useUiText();
  const [granularity, setGranularity] = useState("Hourly");
  return (
    <Panel
      title={t('L2 Positive Prediction Rate by Target')}
      tooltip="Shows the positive prediction rate for each L2 target to monitor prediction drift and operational change."
      action={
        <select
          className="amm-select"
          value={granularity}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            setGranularity(event.target.value)
          }
        >
          <option value="Hourly">{t('Hourly')}</option>
          <option value="Daily">{t('Daily')}</option>
          <option value="Weekly">{t('Weekly')}</option>
        </select>
      }
      className="amm-trend-panel"
      source={source}
    >
      {data.length === 0 ? <div className="amm-chart-height amm-chart-empty">{t('No prediction-rate series available for this range.')}</div> : <div className="amm-chart-height">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, left: -12, bottom: 4 }}
          >
            <CartesianGrid stroke="rgba(91, 147, 204, .12)" vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value) => new Date(value).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              tick={{ fill: "#829bb5", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(91,147,204,.2)" }}
              minTickGap={28}
            />
            <YAxis
              domain={[0, 50]}
              tick={{ fill: "#829bb5", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              unit="%"
            />
            <Tooltip
              content={<TrendTooltip />}
              cursor={false}
              offset={16}
              allowEscapeViewBox={{ x: false, y: true }}
              wrapperStyle={{ zIndex: 400, pointerEvents: "none" }}
            />
            <Legend
              iconType="line"
              wrapperStyle={{
                color: "#b5c8dc",
                fontSize: 11,
                paddingBottom: 6,
              }}
            />
            <Line
              isAnimationActive={false}
              type="monotone"
              dataKey="fault30m"
              name={t('Fault 30min')}
              stroke="#bd3cff"
              strokeWidth={2.2}
              dot={false}
              activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
            />
            <Line
              isAnimationActive={false}
              type="monotone"
              dataKey="fault60m"
              name={t('Fault 60min')}
              stroke="#ff3e52"
              strokeWidth={2.1}
              dot={false}
              activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
            />
            <Line
              isAnimationActive={false}
              type="monotone"
              dataKey="maintenance30e"
              name={t('Maintenance 30 events')}
              stroke="#ffb21a"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
            />
            <Line
              isAnimationActive={false}
              type="monotone"
              dataKey="repair30e"
              name={t('Repair 30 events')}
              stroke="#11d79a"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>}
    </Panel>
  );
}
