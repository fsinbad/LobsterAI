import { describe, expect, test, vi } from 'vitest';

import {
  LogReporterAction,
  LogReporterStoreKey,
} from '../../shared/analytics/constants';
import { MainLogReporter } from './mainLogReporter';

const createStore = (initial: Record<string, unknown> = {}) => {
  const values = new Map<string, unknown>(Object.entries(initial));
  return {
    get: <T>(key: string): T | undefined => values.get(key) as T | undefined,
    set: <T>(key: string, value: T): void => {
      values.set(key, value);
    },
    values,
  };
};

describe('MainLogReporter', () => {
  test('skips sending without creating an installation id when analytics is disabled', async () => {
    const store = createStore({
      [LogReporterStoreKey.AppConfig]: { usageAnalyticsEnabled: false },
    });
    const fetch = vi.fn();
    const reporter = new MainLogReporter({
      appVersion: '1.0.0',
      createInstallationId: () => 'new-installation',
      fetch,
      store,
    });

    await expect(reporter.report({ action: LogReporterAction.ImPromptSubmit })).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(store.values.has(LogReporterStoreKey.InstallationUuid)).toBe(false);
  });

  test('returns false when the analyzer request fails', async () => {
    const store = createStore({
      [LogReporterStoreKey.AppConfig]: { usageAnalyticsEnabled: true },
    });
    const reporter = new MainLogReporter({
      appVersion: '1.0.0',
      createInstallationId: () => 'installation-3',
      fetch: vi.fn().mockRejectedValue(new Error('network unavailable')),
      store,
    });

    await expect(reporter.report({ action: LogReporterAction.ImPromptSubmit })).resolves.toBe(false);
  });

  test('fails closed when the analytics setting cannot be read', async () => {
    const store = {
      get: vi.fn(() => {
        throw new Error('store unavailable');
      }),
      set: vi.fn(),
    };
    const fetch = vi.fn();
    const reporter = new MainLogReporter({
      appVersion: '1.0.0',
      fetch,
      store,
    });

    await expect(reporter.report({ action: LogReporterAction.ImPromptSubmit })).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
  });
});
