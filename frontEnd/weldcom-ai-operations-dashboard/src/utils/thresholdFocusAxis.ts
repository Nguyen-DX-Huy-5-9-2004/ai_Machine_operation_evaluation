export interface ThresholdFocusAxis {
  active: boolean;
  domain: [number, number];
  ticks: number[];
  toPlot: (value: number) => number;
  label: (value: number) => string;
}

type Stop = { raw: number; plot: number };

function interpolate(stops: Stop[], raw: number) {
  if (raw <= stops[0].raw) return stops[0].plot;
  for (let index = 1; index < stops.length; index += 1) {
    const left = stops[index - 1];
    const right = stops[index];
    if (raw <= right.raw) return left.plot + (raw - left.raw) / (right.raw - left.raw) * (right.plot - left.plot);
  }
  return stops[stops.length - 1].plot;
}

function reverse(stops: Stop[], plot: number) {
  if (plot <= stops[0].plot) return stops[0].raw;
  for (let index = 1; index < stops.length; index += 1) {
    const left = stops[index - 1];
    const right = stops[index];
    if (plot <= right.plot) return left.raw + (plot - left.plot) / (right.plot - left.plot) * (right.raw - left.raw);
  }
  return stops[stops.length - 1].raw;
}

/**
 * Expands a quiet low-risk band while retaining the real policy thresholds.
 * It is used only when live data sits well below the first threshold; broad
 * mock/demo ranges retain their ordinary linear scale.
 */
export function thresholdFocusAxis(values: number[], thresholds: number[]): ThresholdFocusAxis {
  const finite = values.filter(Number.isFinite);
  const firstThreshold = thresholds[0] ?? 100;
  const maximum = finite.length ? Math.max(...finite) : 0;
  const minimum = finite.length ? Math.min(...finite) : 0;
  const range = maximum - minimum;
  const active = maximum < firstThreshold * 0.62 && range < firstThreshold * 0.55;
  if (!active) {
    const upper = Math.ceil(Math.max(...thresholds, maximum, 1) / 5) * 5;
    return { active: false, domain: [0, upper], ticks: [0, upper / 4, upper / 2, upper * 3 / 4, upper], toPlot: (value) => value, label: (value) => String(Math.round(value)) };
  }
  const focusUpper = Math.min(firstThreshold * 0.92, Math.max(maximum * 1.18, 1));
  const rawStops = [0, focusUpper, ...thresholds, 100].filter((value, index, source) => index === 0 || value > source[index - 1]);
  const plotStops = rawStops.map((raw, index) => ({ raw, plot: index === 0 ? 0 : index === 1 ? 58 : Math.min(100, 58 + index * (42 / Math.max(1, rawStops.length - 1))) }));
  const tickRaw = [0, focusUpper / 2, focusUpper, ...thresholds].filter((value, index, source) => index === 0 || Math.abs(value - source[index - 1]) > 0.01);
  return {
    active: true,
    domain: [0, 100],
    ticks: tickRaw.map((value) => interpolate(plotStops, value)),
    toPlot: (value) => interpolate(plotStops, value),
    label: (value) => {
      const raw = reverse(plotStops, value);
      return raw < 10 ? raw.toFixed(1).replace(/\.0$/, '') : String(Math.round(raw));
    },
  };
}

export function focusedLinearDomain(values: number[], minimumSpan = 1): [number, number] {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return [0, minimumSpan];
  const low = Math.min(...finite);
  const high = Math.max(...finite);
  const span = Math.max(high - low, minimumSpan);
  const padding = span * 0.16;
  const precision = span < 1 ? 100 : span < 10 ? 10 : 1;
  return [Math.floor((low - padding) * precision) / precision, Math.ceil((high + padding) * precision) / precision];
}
