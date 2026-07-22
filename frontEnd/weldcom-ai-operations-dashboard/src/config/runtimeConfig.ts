export type DataMode = 'api' | 'mock';

export interface RuntimeConfig {
  dataMode: DataMode;
  apiBaseUrl: string;
  defaultDatasetMode: 'historical' | 'current';
  isApiMode: boolean;
  isMockMode: boolean;
}

export function resolveRuntimeConfig(env: Record<string, string | undefined>): RuntimeConfig {
  const dataMode = env.VITE_DATA_MODE;
  if (dataMode !== 'api' && dataMode !== 'mock') {
    throw new Error(`Invalid VITE_DATA_MODE=${String(dataMode)}. Expected api or mock.`);
  }
  const apiBaseUrl = dataMode === 'api' ? (env.VITE_API_BASE_URL ?? '').replace(/\/$/, '') : '';
  if (dataMode === 'api' && !apiBaseUrl) throw new Error('VITE_API_BASE_URL is required in api mode.');
  const defaultDatasetMode = env.VITE_DEFAULT_DATASET_MODE === 'current' ? 'current' : 'historical';
  return { dataMode, apiBaseUrl, defaultDatasetMode, isApiMode: dataMode === 'api', isMockMode: dataMode === 'mock' };
}

const compiledDataMode = import.meta.env.VITE_DATA_MODE;
export const runtimeConfig = resolveRuntimeConfig({
  VITE_DATA_MODE: compiledDataMode,
  VITE_API_BASE_URL: compiledDataMode === 'api' ? import.meta.env.VITE_API_BASE_URL : undefined,
  VITE_DEFAULT_DATASET_MODE: import.meta.env.VITE_DEFAULT_DATASET_MODE,
});
