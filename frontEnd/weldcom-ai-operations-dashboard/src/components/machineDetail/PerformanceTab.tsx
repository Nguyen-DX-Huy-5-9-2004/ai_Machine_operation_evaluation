import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MachineDetailResponse } from "../../types/machineDetail";
import { ChartTooltip } from "./ChartTooltip";
import { InfoDot } from "./InfoDot";
import { useUiText } from '../../i18n/appTranslations';

interface Props {
  data: MachineDetailResponse;
}

export function PerformanceTab({ data }: Props) {
  const t = useUiText();
  const s = data.performanceSummary;
  const show = (value: number | null, suffix = '') => value == null ? t('Not available') : `${value}${suffix}`;
  const cards = [
    {
      label: t("Loaded ratio"),
      value: show(s.loadedPct, '%'),
      sub: t("productive loaded time"),
      level: "normal",
    },
    {
      label: t("No-load ratio"),
      value: show(s.noLoadPct, '%'),
      sub: t("running without load"),
      level: "warning",
    },
    {
      label: t("Off ratio"),
      value: show(s.offPct, '%'),
      sub: t("idle/off window"),
      level: "info",
    },
    {
      label: t("Avg event duration"),
      value: show(s.avgEventDurationMin, 'm'),
      sub: t("per event segment"),
      level: "info",
    },
    {
      label: t("Transitions"),
      value: show(s.transitionCount),
      sub: t("status changes"),
      level: "info",
    },
    {
      label: t("Abnormal durations"),
      value: show(s.abnormalDurationEvents),
      sub: t("duration outliers"),
      level: "high",
    },
    {
      label: t("Big gaps"),
      value: show(s.bigGapEvents),
      sub: t("sequence breaks"),
      level: "warning",
    },
    {
      label: t("Throughput index"),
      value: show(s.throughputIndex),
      sub: t("readiness KPI"),
      level: "medium",
    },
  ];

  return (
    <div className="md-tab-workspace performance-tab">
      <section className="md-performance-summary-grid">
        {cards.map((card) => (
          <article
            className={`md-summary-card perf-card ${card.level}`}
            key={card.label}
          >
            <div className="summary-title">{card.label}</div>
            <div className="summary-value">{card.value}</div>
            <div className="summary-detail">{card.sub}</div>
          </article>
        ))}
      </section>

      <section className="md-tab-grid three">
        <div className="md-panel md-chart-card tall">
          <div className="md-panel-header compact">
            <div className="md-title-with-info">
              <h3>{t('Operating Mix')}</h3>
              <InfoDot text="Daily mix of loaded, no-load, and off ratio for the selected machine." />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={270}>
            <AreaChart
              data={data.performanceSeries}
              margin={{ top: 10, right: 10, bottom: 4, left: -16 }}
            >
              <CartesianGrid
                stroke="#183555"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                tick={{ fill: "#87a3c5", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "#87a3c5", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={false}
                offset={16}
                allowEscapeViewBox={{ x: false, y: true }}
                wrapperStyle={{ zIndex: 400, pointerEvents: "none" }}
              />
              <Legend
                iconType="circle"
                wrapperStyle={{ color: "#b7c7dd", fontSize: 11 }}
              />
              <Area
                type="monotone"
                dataKey="loadedPct"
                name={t('Loaded %')}
                stackId="1"
                stroke="#19d982"
                fill="#19d982"
                fillOpacity={0.35}
              />
              <Area
                type="monotone"
                dataKey="noLoadPct"
                name={t('No-load %')}
                stackId="1"
                stroke="#128dff"
                fill="#128dff"
                fillOpacity={0.25}
              />
              <Area
                type="monotone"
                dataKey="offPct"
                name={t('Off %')}
                stackId="1"
                stroke="#a9b1bd"
                fill="#a9b1bd"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="md-panel md-chart-card tall">
          <div className="md-panel-header compact">
            <div className="md-title-with-info">
              <h3>{t('Duration & Gap Health')}</h3>
              <InfoDot text="Average event duration and gap count by day. Big gaps can affect sequence confidence." />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={270}>
            <ComposedChart
              data={data.performanceSeries}
              margin={{ top: 10, right: 10, bottom: 4, left: -16 }}
            >
              <CartesianGrid
                stroke="#183555"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                tick={{ fill: "#87a3c5", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#87a3c5", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={false}
                offset={16}
                allowEscapeViewBox={{ x: false, y: true }}
                wrapperStyle={{ zIndex: 400, pointerEvents: "none" }}
              />
              <Legend
                iconType="circle"
                wrapperStyle={{ color: "#b7c7dd", fontSize: 11 }}
              />
              <Bar
                dataKey="avgDurationMin"
                name={t('Avg duration')}
                fill="#a855f7"
                radius={[6, 6, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="gapCount"
                name={t('Gap count')}
                stroke="#ff9900"
                strokeWidth={2.2}
                activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="md-panel md-chart-card tall">
          <div className="md-panel-header compact">
            <div className="md-title-with-info">
              <h3>{t('Throughput vs KWh Rate')}</h3>
              <InfoDot text="Context chart to compare production readiness with average KWh rate; not a direct cost/energy total." />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={270}>
            <LineChart
              data={data.performanceSeries}
              margin={{ top: 10, right: 14, bottom: 4, left: -16 }}
            >
              <CartesianGrid
                stroke="#183555"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                tick={{ fill: "#87a3c5", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#87a3c5", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={false}
                offset={16}
                allowEscapeViewBox={{ x: false, y: true }}
                wrapperStyle={{ zIndex: 400, pointerEvents: "none" }}
              />
              <Legend
                iconType="circle"
                wrapperStyle={{ color: "#b7c7dd", fontSize: 11 }}
              />
              <Line
                type="monotone"
                dataKey="throughputIndex"
                name={t('Throughput index')}
                stroke="#19d982"
                strokeWidth={2.2}
                dot={{ r: 2 }}
                activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="kwhRate"
                name={t('KWh rate')}
                stroke="#128dff"
                strokeWidth={2.2}
                dot={{ r: 2 }}
                activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
