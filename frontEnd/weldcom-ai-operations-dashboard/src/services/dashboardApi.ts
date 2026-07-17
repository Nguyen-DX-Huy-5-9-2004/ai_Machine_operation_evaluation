import { dashboardMock } from '../data/mockDashboard';
import type { DashboardPayload } from '../types/dashboard';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';
const MODE = import.meta.env.VITE_DATA_MODE ?? 'mock';

export interface DashboardFilters {
  dateFrom?: string;
  dateTo?: string;
  machine?: string;
  location?: string;
  status?: string;
}

export async function loadDashboard(filters: DashboardFilters = {}): Promise<DashboardPayload> {
  if (MODE === 'mock') {
    await new Promise((resolve) => setTimeout(resolve, 120));
    return dashboardMock;
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }

  const response = await fetch(`${API_BASE}/dashboard/overview?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to load dashboard data: ${response.status}`);
  }
  return response.json();
}
