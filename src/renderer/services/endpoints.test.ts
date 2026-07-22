import { describe, expect, test } from 'vitest';

import {
  getUpdateCheckUrl,
  getManualUpdateCheckUrl,
  getFallbackDownloadUrl,
  getSkillStoreUrl,
  getKitStoreUrl,
} from './endpoints';

describe('endpoints', () => {
  test('update check urls point to github releases', () => {
    expect(getUpdateCheckUrl()).toContain('github.com');
    expect(getManualUpdateCheckUrl()).toContain('github.com');
    expect(getFallbackDownloadUrl()).toContain('github.com');
  });

  test('skill and kit store urls are non-empty', () => {
    expect(getSkillStoreUrl().length).toBeGreaterThan(0);
    expect(getKitStoreUrl().length).toBeGreaterThan(0);
  });
});
