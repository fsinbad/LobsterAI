import { configService } from './config';

export const LogReporterEndpoint = {
  YoudaoAnalyzer: '',
} as const;

export const LogReporterProduct = {
  NukemAI: 'wisdom',
} as const;

export const LogReporterCategory = {
  Actions: 'actions',
} as const;

export const LogReporterActionPrefix = {
  NukemAI: 'nukemai_',
} as const;

export const LogReporterAction = {
  AgentCreateAction: 'nukemai_agent_create_action',
  AgentSettingsAction: 'nukemai_agent_settings_action',
  AgentEngineMaintenanceAction: 'nukemai_agent_engine_maintenance_action',
  AgentEngineSettingChanged: 'nukemai_agent_engine_setting_changed',
  AboutAction: 'nukemai_about_action',
  AccountMenuAction: 'nukemai_account_menu_action',
  AppStarted: 'nukemai_app_started',
  AppearanceSettingChanged: 'nukemai_appearance_setting_changed',
  ArtifactPreviewAction: 'nukemai_artifact_preview_action',
  BrowserSettingChanged: 'nukemai_browser_setting_changed',
  CustomModelConnectionTested: 'nukemai_custom_model_connection_tested',
  CustomModelSettingsSaved: 'nukemai_custom_model_settings_saved',
  ConversationBlockAction: 'nukemai_conversation_block_action',
  ConversationMessageAction: 'nukemai_conversation_message_action',
  ConversationNavigationAction: 'nukemai_conversation_navigation_action',
  DreamingSettingChanged: 'nukemai_dreaming_setting_changed',
  EmailSkillConnectionTested: 'nukemai_email_skill_connection_tested',
  EmailSkillSettingsSaved: 'nukemai_email_skill_settings_saved',
  ExpertKitAction: 'nukemai_expert_kit_action',
  ExpertKitSelected: 'nukemai_expert_kit_selected',
  GeneralSettingChanged: 'nukemai_general_setting_changed',
  ImConnectionTested: 'nukemai_im_connection_tested',
  ImGatewayToggled: 'nukemai_im_gateway_toggled',
  ImInstanceChanged: 'nukemai_im_instance_changed',
  ImSettingsSaved: 'nukemai_im_settings_saved',
  MemoryEntryChanged: 'nukemai_memory_entry_changed',
  MemorySettingChanged: 'nukemai_memory_setting_changed',
  McpEnabled: 'nukemai_mcp_enabled',
  McpAction: 'nukemai_mcp_action',
  ModelSelected: 'nukemai_model_selected',
  PlanModeEnabled: 'nukemai_plan_mode_enabled',
  PluginAction: 'nukemai_plugin_action',
  PluginSettingsSaved: 'nukemai_plugin_settings_saved',
  PromptControlAction: 'nukemai_prompt_control_action',
  PromptSubmit: 'nukemai_prompt_submit',
  PromptTemplateAction: 'nukemai_prompt_template_action',
  ShortcutSettingChanged: 'nukemai_shortcut_setting_changed',
  SidebarAction: 'nukemai_sidebar_action',
  SkillAction: 'nukemai_skill_action',
  SkillEnabled: 'nukemai_skill_enabled',
  ScheduledTaskAction: 'nukemai_scheduled_task_action',
  TaskSearchAction: 'nukemai_task_search_action',
  UsageAnalyticsEnabled: 'nukemai_usage_analytics_enabled',
} as const;

export const LogReporterEntry = {
  PromptToolsMenu: 'prompt_tools_menu',
} as const;

type LogParamValue = string | number | boolean | null | undefined;

export type LogEventAction = `${typeof LogReporterActionPrefix.NukemAI}${string}`;

export type LogEventParams = Record<string, LogParamValue> & {
  action: LogEventAction;
};

const logCommons = {
  _npid: LogReporterProduct.NukemAI,
  _ncat: LogReporterCategory.Actions,
} as const;

export interface BuildLogUrlOptions {
  appVersion?: string;
  arch?: string;
  firstKeyfrom?: string;
  installationId?: string | null;
  language?: string;
  latestKeyfrom?: string;
  platform?: string;
  userId?: string;
  timestamp?: number;
}

let cachedAppVersion = '';
let cachedInstallationId: string | null = null;

const writeReporterLog = (level: 'debug' | 'warn', message: string, error?: unknown): void => {
  if (level === 'warn') {
    if (error === undefined) {
      console.warn(`[LogReporter] ${message}`);
    } else {
      console.warn(`[LogReporter] ${message}:`, error);
    }
  } else {
    console.debug(`[LogReporter] ${message}`);
  }
  window.electron?.log?.fromRenderer?.(level, 'LogReporter', message);
};

const getWindowPlatform = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.electron?.platform || '';
};

const getWindowArch = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.electron?.arch || '';
};

export const buildLogUrl = (
  params: LogEventParams,
  options: BuildLogUrlOptions = {},
): string => {
  if (!LogReporterEndpoint.YoudaoAnalyzer) {
    return '';
  }
  const url = new URL(LogReporterEndpoint.YoudaoAnalyzer);
  const config = configService.getConfig();
  const userId = options.userId ?? '';
  const firstKeyfrom = options.firstKeyfrom;
  const latestKeyfrom = options.latestKeyfrom;
  const installationId = options.installationId ?? cachedInstallationId;
  const logParams: Record<string, LogParamValue> = {
    ...params,
    ...logCommons,
    app_version: options.appVersion ?? cachedAppVersion,
    os_platform: options.platform ?? getWindowPlatform(),
    os_arch: options.arch ?? getWindowArch(),
    language: options.language ?? config.language,
    uuid: installationId,
    firstKeyfrom,
    latestKeyfrom,
    is_logged_in: userId.trim().length > 0,
    log_Usid: userId,
    uts: options.timestamp ?? Date.now(),
  };

  Object.entries(logParams).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  return url.href;
};

export const reportYdAnalyzer = async (params: LogEventParams): Promise<boolean> => {
  writeReporterLog('debug', `skipped event ${params.action} (analytics endpoint removed)`);
  return false;
};
