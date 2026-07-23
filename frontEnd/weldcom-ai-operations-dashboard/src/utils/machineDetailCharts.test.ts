import { describe, expect, it } from 'vitest';
import { chartDomain, compactMachineSeries, formatMachineNumber } from './machineDetailCharts';

describe('machine detail chart utilities', () => {
  it('keeps extrema and explicitly important points when compacting dense data', () => {
    const source = Array.from({ length: 400 }, (_, index) => ({ id: index, value: index === 211 ? 99 : index % 7, important: index === 155 }));
    const compact = compactMachineSeries(source, 48, (point) => [point.value], (point) => point.important);
    expect(compact.some((point) => point.id === 211)).toBe(true);
    expect(compact.some((point) => point.id === 155)).toBe(true);
    expect(compact[0].id).toBe(0);
    expect(compact[compact.length - 1]?.id).toBe(399);
    expect(compact.length).toBeLessThanOrEqual(48);
  });

  it('uses readable domains and presentation-safe number formatting', () => {
    expect(chartDomain([0.1, 0.4, 0.5], { minimumSpan: 0.1 })[1]).toBeGreaterThan(0.5);
    expect(formatMachineNumber(982.20000000099, 2)).toBe('982.2');
  });
});
