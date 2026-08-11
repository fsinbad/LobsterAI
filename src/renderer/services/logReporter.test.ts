import { afterEach, expect, test, vi } from 'vitest';

vi.mock('../store', () => ({
  store: {
    getState: () => ({
      auth: {
        user: {
          yid: 'stored-user',
        },
      },
    }),
  },
}));

vi.mock('./config', () => ({
  configService: {
    getConfig: vi.fn(() => ({
      language: 'zh',
      usageAnalyticsEnabled: true,
    })),
  },
}));

vi.mock('./installationId', () => ({
  getInstallationId: vi.fn(() => Promise.resolve('installation-uuid')),
}));

import {
  buildLogUrl,
  LogReporterAction,
  LogReporterActionPrefix,
  LogReporterEndpoint,
  LogReporterEntry,
  reportYdAnalyzer,
} from './logReporter';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('returns an empty string when the analyzer endpoint is removed', () => {
  const result = buildLogUrl(
    {
      action: `${LogReporterActionPrefix.NukemAI}skill_enabled`,
      skillId: 'xlsx',
      enabled: true,
    },
    {
      appVersion: '2026.6.18',
      arch: 'arm64',
      firstKeyfrom: 'bilibili',
      installationId: 'installation-uuid',
      language: 'en',
      latestKeyfrom: 'partner_a',
      platform: 'darwin',
      userId: 'test-user',
      timestamp: 123456789,
    },
  );

  expect(result).toBe('');
  expect(LogReporterEndpoint.YoudaoAnalyzer).toBe('');
});

test('reportYdAnalyzer is a no-op that returns false', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('window', {
    electron: {
      platform: 'darwin',
      arch: 'arm64',
      appInfo: {
        getVersion: vi.fn().mockResolvedValue('2026.6.18'),
        getKeyfromAttribution: vi.fn().mockResolvedValue({
          firstKeyfrom: 'bilibili',
          latestKeyfrom: 'partner_a',
          updatedAt: 123456789,
        }),
      },
      api: {
        fetch: fetchMock,
      },
    },
  });
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);

  await expect(reportYdAnalyzer({
    action: LogReporterAction.PlanModeEnabled,
    entry: LogReporterEntry.PromptToolsMenu,
  })).resolves.toBe(false);

  expect(fetchMock).not.toHaveBeenCalled();
});

test('reportYdAnalyzer returns false regardless of action prefix', async () => {
  vi.stubGlobal('window', {
    electron: {
      api: {
        fetch: vi.fn(),
      },
    },
  });
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);

  await expect(reportYdAnalyzer({
    action: 'plan_mode_enabled',
  } as unknown as Parameters<typeof reportYdAnalyzer>[0])).resolves.toBe(false);
});

test('reportYdAnalyzer returns false when usage analytics is disabled', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('window', {
    electron: {
      api: {
        fetch: fetchMock,
      },
    },
  });
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);

  await expect(reportYdAnalyzer({
    action: LogReporterAction.PlanModeEnabled,
  })).resolves.toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});
