export type ServerModelEntry = {
  modelId: string;
  supportsImage?: boolean;
  supportsThinking?: boolean;
  contextWindow?: number;
};

export type StartupCacheWarmupDeps = {
  serverBaseUrl: string;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
  appendKeyfromQuery: (url: string) => string;
  cachedSubscriptionStatus: string;
  t: (key: string) => string;
};

export type StartupCacheWarmupResult = {
  subscriptionStatus: string;
  mediaGenerationEntitled: boolean;
};

/**
 * Pre-warm quota and model caches so provider resolution and config sync
 * see real server data instead of empty defaults.
 *
 * Stubbed out after auth/quota system removal.
 */
export async function runStartupCacheWarmup(_deps: StartupCacheWarmupDeps): Promise<StartupCacheWarmupResult> {
  return {
    subscriptionStatus: _deps.cachedSubscriptionStatus,
    mediaGenerationEntitled: false,
  };
}
