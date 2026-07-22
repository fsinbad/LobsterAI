import { app } from 'electron';

import type { SqliteStore } from '../sqliteStore';

let cachedTestMode: boolean | null = null;

/**
 * Read testMode from store and cache it.
 * Call once at startup and again whenever app_config changes.
 */
export function refreshEndpointsTestMode(store: SqliteStore): void {
  const appConfig = store.get<any>('app_config');
  cachedTestMode = appConfig?.app?.testMode === true;
}

/**
 * Whether the app is in test mode.
 * Uses cached value after init; falls back to !app.isPackaged before init.
 */
export const isTestModeEnabled = (): boolean => {
  return cachedTestMode ?? !app.isPackaged;
};

export const getUpdateCheckUrl = (): string =>
  'https://github.com/nukemai/nukemai/releases/latest';

export const getManualUpdateCheckUrl = (): string =>
  'https://github.com/nukemai/nukemai/releases/latest';

export const getFallbackDownloadUrl = (): string =>
  'https://github.com/nukemai/nukemai/releases/latest';

export const getSkillStoreUrl = (): string =>
  isTestModeEnabled()
    ? 'https://api-overmind.youdao.com/openapi/get/luna/hardware/lobsterai/test/skill-store'
    : 'https://api-overmind.youdao.com/openapi/get/luna/hardware/lobsterai/prod/skill-store';

// Portal 页面
const PORTAL_BASE_TEST = 'https://lobsterai.inner.youdao.com/portal#';
const PORTAL_BASE_PROD = 'https://lobsterai.youdao.com/portal#';

const getPortalBase = (): string =>
  isTestModeEnabled() ? PORTAL_BASE_TEST : PORTAL_BASE_PROD;

export const getPortalTasksUrl = (): string =>
  `${getPortalBase()}/profile/detail?tab=tasks`;

export const getKitStoreUrl = (): string =>
  isTestModeEnabled()
    ? 'https://api-overmind.youdao.com/openapi/get/luna/hardware/lobsterai/test/kit-store'
    : 'https://api-overmind.youdao.com/openapi/get/luna/hardware/lobsterai/prod/kit-store';
