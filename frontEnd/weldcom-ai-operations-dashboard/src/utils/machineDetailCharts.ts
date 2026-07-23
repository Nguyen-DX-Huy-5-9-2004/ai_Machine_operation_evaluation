/**
 * Keep operational outliers visible while reducing a dense machine series to
 * the number of points an operator can actually inspect in a chart viewport.
 */
export function compactMachineSeries<T>(
  points: readonly T[],
  maxPoints: number,
  values: (point: T) => number[],
  isImportant: (point: T) => boolean = () => false,
): T[] {
  if (points.length <= maxPoints || maxPoints < 8) return [...points];

  const priority = new Map<number, number>();
  const keep = (index: number, weight: number) => {
    priority.set(index, Math.max(priority.get(index) ?? 0, weight));
  };
  keep(0, 100);
  keep(points.length - 1, 100);
  const bucketSize = Math.ceil(points.length / Math.max(1, Math.floor(maxPoints / 3)));
  for (let start = 0; start < points.length; start += bucketSize) {
    const end = Math.min(points.length, start + bucketSize);
    keep(start, 20);
    keep(end - 1, 20);
    const candidates = Array.from({ length: end - start }, (_, offset) => start + offset);
    candidates.filter((index) => isImportant(points[index])).forEach((index) => keep(index, 80));
    const width = Math.max(...candidates.map((index) => values(points[index]).length), 0);
    for (let field = 0; field < width; field += 1) {
      const finite = candidates.filter((index) => Number.isFinite(values(points[index])[field]));
      if (!finite.length) continue;
      keep(finite.reduce((best, index) => values(points[index])[field] > values(points[best])[field] ? index : best, finite[0]), 40);
      keep(finite.reduce((best, index) => values(points[index])[field] < values(points[best])[field] ? index : best, finite[0]), 40);
    }
  }

  // `maxPoints` is a hard rendering budget. Without this final ranking a
  // multi-series chart can retain every bucket extremum and become dense again.
  const selected = [...priority.entries()]
    .sort(([leftIndex, leftWeight], [rightIndex, rightWeight]) => rightWeight - leftWeight || leftIndex - rightIndex)
    .slice(0, maxPoints)
    .map(([index]) => index)
    .sort((left, right) => left - right);
  return selected.map((index) => points[index]);
}

export function chartDomain(values: number[], options: { includeZero?: boolean; minimumSpan?: number } = {}): [number, number] {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return [0, 1];
  const low = Math.min(...finite);
  const high = Math.max(...finite);
  const span = Math.max(high - low, options.minimumSpan ?? 1);
  const padding = span * 0.14;
  const minimum = options.includeZero ? Math.min(0, low - padding) : low - padding;
  const maximum = high + padding;
  return [Number(minimum.toFixed(3)), Number(maximum.toFixed(3))];
}

export function formatMachineNumber(value: number | null | undefined, precision = 1): string {
  if (value == null || !Number.isFinite(value)) return 'Not available';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: precision, minimumFractionDigits: 0 }).format(value);
}
