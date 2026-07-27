const number = (value: unknown): number | null => {
  const parsed = Number(value);
  return value == null || !Number.isFinite(parsed) ? null : parsed;
};

export function formatCount(value: unknown): string {
  const parsed = number(value);
  return parsed == null ? 'Not available' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(parsed);
}

export function formatRisk(value: unknown, suffix = false): string {
  const parsed = number(value);
  if (parsed == null) return 'Not available';
  const score = parsed <= 1 ? parsed * 100 : parsed;
  return `${score.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${suffix ? ' / 100' : ''}`;
}

export function formatProbability(value: unknown): string {
  const parsed = number(value);
  if (parsed == null) return 'Not available';
  const percent = parsed <= 1 ? parsed * 100 : parsed;
  return `${percent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export type MetricUnit = 'ratio_0_1' | 'percent_0_100' | 'probability_0_1' | 'events' | 'loss' | 'score_0_100';

export function formatMetricValue(value: unknown, unit?: MetricUnit | string | null): string {
  const parsed = number(value);
  if (parsed == null) return 'Not available';
  if (unit === 'ratio_0_1') return `${(parsed * 100).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  if (unit === 'percent_0_100') return `${parsed.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
  if (unit === 'probability_0_1') return parsed.toFixed(3);
  if (unit === 'events') return formatCount(parsed);
  if (unit === 'loss') return parsed.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 5 });
  if (unit === 'score_0_100') return parsed.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return parsed.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function formatKwh(value: unknown): string {
  const parsed = number(value);
  return parsed == null ? 'Not available' : `${parsed.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh`;
}

export function formatKwhRate(value: unknown): string {
  const parsed = number(value);
  return parsed == null ? 'Not available' : `${parsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh/h`;
}

export function formatDurationSeconds(value: unknown): string {
  const parsed = number(value);
  if (parsed == null) return 'Not available';
  if (parsed < 60) return `${parsed.toLocaleString('en-US', { maximumFractionDigits: 2 })} s/event`;
  if (parsed < 3600) return `${(parsed / 60).toLocaleString('en-US', { maximumFractionDigits: 1 })} min`;
  return `${(parsed / 3600).toLocaleString('en-US', { maximumFractionDigits: 1 })} h`;
}

export function formatHistoricalTimestamp(value: unknown): string {
  const date = value == null ? null : new Date(String(value));
  if (!date || Number.isNaN(date.valueOf())) return 'Not available';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(date);
}

export function formatChartTime(value: unknown, language: 'en' | 'vi'): string {
  const raw = String(value ?? '');
  if (!raw || /^\d{1,2}:\d{2}(?::\d{2})?$/.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.valueOf())) return raw;
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: raw.includes(':') ? '2-digit' : undefined,
    minute: raw.includes(':') ? '2-digit' : undefined,
  }).format(date);
}
