import { useMemo, useState } from 'react';

export interface BrushRange { startIndex: number; endIndex: number; }

/**
 * Keeps an operator-selected Brush range anchored to stable point keys while
 * live replay appends new data. Until the operator touches the Brush, the
 * viewport follows the newest points.
 */
export function usePersistentBrushViewport<T>(data: readonly T[], keyOf: (point: T, index: number) => string, visiblePoints: number) {
  const [selection, setSelection] = useState<{ startKey: string; endKey: string; manual: boolean }>({ startKey: '', endKey: '', manual: false });
  const range = useMemo<BrushRange>(() => {
    const endIndex = Math.max(0, data.length - 1);
    if (!selection.manual) return { startIndex: Math.max(0, endIndex - visiblePoints + 1), endIndex };
    const start = data.findIndex((point, index) => keyOf(point, index) === selection.startKey);
    const end = data.findIndex((point, index) => keyOf(point, index) === selection.endKey);
    if (start < 0 || end < 0) return { startIndex: Math.max(0, endIndex - visiblePoints + 1), endIndex };
    return { startIndex: Math.min(start, end), endIndex: Math.max(start, end) };
  }, [data, keyOf, selection, visiblePoints]);

  return {
    range,
    onChange: (next: Partial<BrushRange>) => {
      const startIndex = next.startIndex ?? 0;
      const endIndex = next.endIndex ?? Math.max(0, data.length - 1);
      const start = data[startIndex];
      const end = data[endIndex];
      if (start && end) setSelection({ startKey: keyOf(start, startIndex), endKey: keyOf(end, endIndex), manual: true });
    },
    followLatest: () => setSelection({ startKey: '', endKey: '', manual: false }),
    isManual: selection.manual,
  };
}
