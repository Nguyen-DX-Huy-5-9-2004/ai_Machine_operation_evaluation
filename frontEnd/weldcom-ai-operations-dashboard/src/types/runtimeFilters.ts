import type { DatasetMode } from './dashboard';

export interface RuntimeFilters {
  datasetMode: DatasetMode;
  from?: string;
  to?: string;
  machineIds?: number[];
  locationIds?: number[];
  machineGroupIds?: number[];
  operationalActionLevels?: string[];
  qualityActionLevels?: string[];
  rangePreset?: 'Last 24 Hours' | 'Last 7 Days' | 'Last 30 Days' | 'Last 90 Days' | 'Full Historical Range';
}

export function riskForDisplay(value: unknown): number {
  const parsed = Number(value ?? 0);
  return parsed <= 1 ? parsed * 100 : parsed;
}
