/**
 * 集中管理所有业务 API 端点。
 * 后续新增的业务接口也应在此文件中配置。
 */

import { configService } from './config';

export const isTestModeEnabled = () => {
  return configService.getConfig().app?.testMode === true;
};

// 自动更新
export const getUpdateCheckUrl = () =>
  'https://github.com/nukemai/nukemai/releases/latest';

// 手动检查更新
export const getManualUpdateCheckUrl = () =>
  'https://github.com/nukemai/nukemai/releases/latest';

export const getFallbackDownloadUrl = () =>
  'https://github.com/nukemai/nukemai/releases/latest';

// Skill 商店
export const getSkillStoreUrl = () =>
  isTestModeEnabled()
    ? 'https://api-overmind.youdao.com/openapi/get/luna/hardware/lobsterai/test/skill-store'
    : 'https://api-overmind.youdao.com/openapi/get/luna/hardware/lobsterai/prod/skill-store';

// Kit 商店
export const getKitStoreUrl = () =>
  isTestModeEnabled()
    ? 'https://api-overmind.youdao.com/openapi/get/luna/hardware/lobsterai/test/kit-store'
    : 'https://api-overmind.youdao.com/openapi/get/luna/hardware/lobsterai/prod/kit-store';
