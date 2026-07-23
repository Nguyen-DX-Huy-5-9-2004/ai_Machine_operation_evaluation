import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AIModelMonitorPayload, MonitorChartSeriesConfig, MonitorProvenance } from '../../types/aiModelMonitor';
import { Panel } from './Panel';
import { FloatingChartTooltip } from './FloatingChartTooltip';
import { useAppLanguage } from '../../i18n/appTranslations';

const colors = ['#15d8a5', '#2b8cff', '#b94cff', '#ffb21a', '#ff3e52', '#57c7ff'];
const labelKeys = new Set(['epoch', 'bin', 'timestamp', 'label', 'target', 'profile']);
const fallbackNames: Record<string, string> = { lenientTrainLoss: 'Lenient - Train', lenientValidLoss: 'Lenient - Validation', strictTrainLoss: 'Strict - Train', strictValidLoss: 'Strict - Validation', lenientThreshold: 'Lenient threshold', strictThreshold: 'Strict threshold', trainNormal: 'Train Normal', validNormal: 'Validation Normal', testNormal: 'Test Normal', knownFault: 'Known Fault', train: 'Train - Demo', valid: 'Validation - Validated', test: 'Test - Demo', auroc: 'AUROC - Demo', f1: 'F1 - Demo', success: 'Success', failed: 'Failed', durationSec: 'Duration (s)', featureAvailability: 'Feature Availability', missingRate: 'Missing Rate', eventAlignment: 'Event Alignment' };

function formatChartValue(value: number | undefined, unit?: string) {
  if (value == null) return 'Not available';
  if (unit === 'loss') return value.toFixed(5);
  if (unit === 'probability_0_1') return value.toFixed(4);
  if (unit === 'ratio_0_1') return value.toFixed(3);
  if (unit === 'percent_0_100') return `${value.toFixed(1)}%`;
  if (unit === 'events') return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return value.toFixed(2);
}

function chartSeriesContext(sourceType: string | undefined, language: 'en' | 'vi') {
  if (sourceType === 'VALIDATED_ARTIFACT') return language === 'vi' ? 'Chỉ số đã xác thực từ artifact mô hình' : 'Validated model-artifact metric';
  if (sourceType === 'SQL_RUNTIME' || sourceType === 'BOUNDED_AUDIT') return language === 'vi' ? 'Chỉ số quan sát từ runtime/audit chỉ đọc' : 'Read-only runtime/audit metric';
  if (sourceType === 'SIMULATED_VISUALIZATION') return language === 'vi' ? 'Xu hướng đánh giá lịch sử của mô hình' : 'Historical model-evaluation trend';
  return language === 'vi' ? 'Chỉ số đánh giá lịch sử của mô hình' : 'Historical model-evaluation metric';
}

function ChartTooltip({ active, payload, label, coordinate, config }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string; payload?: Record<string, string | number> }>; label?: string; coordinate?: { x?: number; y?: number }; config: MonitorChartSeriesConfig[] }) {
  const language = useAppLanguage();
  if (!active || !payload?.length) return null;
  const profile = payload[0]?.payload?.profile;
  return <FloatingChartTooltip active={active} coordinate={coordinate}><strong>{label}</strong>{payload.map((item) => {
    const series = config.find((candidate) => candidate.label === item.name);
    return <span key={item.name}><i style={{ background: item.color }} />{item.name}: <b>{formatChartValue(item.value, series?.unit)}</b><em>{chartSeriesContext(series?.sourceType, language)}</em></span>;
  })}{typeof profile === 'string' ? <em>Profile: {profile}</em> : null}</FloatingChartTooltip>;
}

// Recharts axes and tooltips are shared here so every V3 visualization has the same interaction contract.
function RenderChart({ series, title, source, seriesConfig = [] }: { series: Array<Record<string, string | number>>; title: string; source: MonitorProvenance; seriesConfig?: MonitorChartSeriesConfig[] }) {
  const xKey = ['epoch', 'bin', 'timestamp', 'label', 'target', 'run'].find((key) => series.some((item) => key in item)) ?? 'label';
  const fallbackConfig = Array.from(new Set(series.flatMap((item) => Object.keys(item).filter((key) => !labelKeys.has(key) && typeof item[key] === 'number')))).slice(0, 5).map((key) => ({ key, label: fallbackNames[key] ?? key, unit: 'score_0_100', axis: 'left' as const, sourceType: source.sourceType }));
  const config = seriesConfig.length ? seriesConfig : fallbackConfig;
  const useBars = /Distribution|Thresholds|AP by Split|AUROC/i.test(title);
  const rotated = /Thresholds|AP by Split|AUROC/i.test(title);
  const common = <><CartesianGrid stroke="rgba(91,147,204,.12)" vertical={false} /><XAxis dataKey={xKey} interval={rotated ? 0 : 'preserveStartEnd'} angle={rotated ? -24 : 0} textAnchor={rotated ? 'end' : 'middle'} height={rotated ? 48 : 28} tick={{ fill: '#829bb5', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={8} /><Tooltip content={<ChartTooltip config={config} />} cursor={false} allowEscapeViewBox={{ x: true, y: true }} /><Legend wrapperStyle={{ fontSize: 10, paddingTop: 5 }} /></>;
  const thresholdDomain = title.includes('Threshold Stability') ? ['dataMin - 0.01', 'dataMax + 0.01'] : ['auto', 'auto'];
  const regular = useBars ? <BarChart data={series} margin={{ top: 8, right: 10, left: -14, bottom: 2 }}>{common}<YAxis tick={{ fill: '#829bb5', fontSize: 10 }} tickLine={false} axisLine={false} unit={config.some((item) => item.unit === 'percent_0_100') ? '%' : undefined} />{config.map((item, index) => <Bar key={item.key} name={item.label} dataKey={item.key} fill={colors[index % colors.length]} radius={[3, 3, 0, 0]} />)}</BarChart> : <LineChart data={series} margin={{ top: 8, right: 10, left: -14, bottom: 2 }}>{common}<YAxis domain={thresholdDomain} tick={{ fill: '#829bb5', fontSize: 10 }} tickLine={false} axisLine={false} />{config.map((item, index) => <Line key={item.key} name={item.label} type="monotone" dataKey={item.key} stroke={colors[index % colors.length]} strokeDasharray={title.includes('Threshold Stability') && index === 1 ? '5 4' : undefined} strokeWidth={2.1} dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />)}</LineChart>;
  const runHealth = title.includes('Run Success') ? <ComposedChart data={series} margin={{ top: 8, right: 20, left: -14, bottom: 2 }}>{common}<YAxis yAxisId="left" domain={[0, 1]} allowDecimals={false} tick={{ fill: '#829bb5', fontSize: 10 }} /><YAxis yAxisId="right" orientation="right" tick={{ fill: '#829bb5', fontSize: 10 }} /><Bar yAxisId="left" name="Success" dataKey="success" fill="#15d8a5" radius={[3, 3, 0, 0]} /><Bar yAxisId="left" name="Failed" dataKey="failed" fill="#ff3e52" radius={[3, 3, 0, 0]} /><Line yAxisId="right" name="Duration (s)" type="monotone" dataKey="durationSec" stroke="#ffb21a" strokeWidth={2.1} /></ComposedChart> : null;
  const feature = title.includes('Feature Availability') ? <LineChart data={series} margin={{ top: 8, right: 20, left: -14, bottom: 2 }}>{common}<YAxis yAxisId="left" domain={[95, 100]} tick={{ fill: '#829bb5', fontSize: 10 }} /><YAxis yAxisId="right" orientation="right" domain={[0, 5]} tick={{ fill: '#829bb5', fontSize: 10 }} /><Line yAxisId="left" name="Feature Availability" type="monotone" dataKey="featureAvailability" stroke="#15d8a5" strokeWidth={2.1} dot={false} /><Line yAxisId="left" name="Event Alignment" type="monotone" dataKey="eventAlignment" stroke="#2b8cff" strokeWidth={2.1} dot={false} /><Line yAxisId="right" name="Missing Rate" type="monotone" dataKey="missingRate" stroke="#ffb21a" strokeWidth={2.1} dot={false} /></LineChart> : null;
  return <Panel title={title} tooltip={`${source.sourceLabel}. ${source.tooltip}`} source={source} className="amm-reference-chart"><div className="amm-reference-chart__body"><ResponsiveContainer width="100%" height="100%">{runHealth ?? feature ?? regular}</ResponsiveContainer></div>{title.includes('Threshold Stability') ? <p className="amm-chart-note">Demo stability visualization; production thresholds are listed separately.</p> : null}</Panel>;
}

export function ModelReferenceCharts({ charts }: { charts?: AIModelMonitorPayload['charts'] }) {
  if (!charts) return null;
  return <section className="amm-reference-grid">{Object.entries(charts).map(([key, chart]) => <RenderChart key={key} title={chart.title} series={chart.series} source={chart.provenance} seriesConfig={chart.seriesConfig} />)}</section>;
}
