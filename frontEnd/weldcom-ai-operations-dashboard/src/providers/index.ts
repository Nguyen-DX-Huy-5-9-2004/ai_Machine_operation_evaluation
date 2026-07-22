import { runtimeConfig, type RuntimeConfig } from '../config/runtimeConfig';
import { apiDataProvider } from './apiDataProvider';
import { mockDataProvider } from './mockDataProvider';
import type { DataProvider } from './types';

export function createDataProvider(config: RuntimeConfig): DataProvider {
  return config.isMockMode ? mockDataProvider : apiDataProvider;
}

export const dataProvider = createDataProvider(runtimeConfig);
export type { DataProvider } from './types';
