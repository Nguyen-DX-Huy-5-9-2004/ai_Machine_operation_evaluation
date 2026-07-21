import type { MachineDetailResponse } from '../types/machineDetail';

export interface MachineDetailQuery {
  machineId?: string;
  from?: string;
  to?: string;
  range?: 'last_24h' | 'last_7d' | 'last_30d';
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';
const DATA_MODE = import.meta.env.VITE_DATA_MODE ?? 'api';

export async function getMachineDetail(query: MachineDetailQuery = {}): Promise<MachineDetailResponse> {
  if (DATA_MODE !== 'api') {
    throw new Error('Machine detail requires VITE_DATA_MODE=api; fixture data is not available in the runtime bundle.');
  }

  if (!query.machineId) throw new Error('machineId is required in API mode');
  const machineId = query.machineId;
  const params = new URLSearchParams();
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.range) params.set('range', query.range);

  const response = await fetch(`${API_BASE_URL}/machines/${encodeURIComponent(machineId)}/detail?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to load machine detail: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<MachineDetailResponse>;
}
