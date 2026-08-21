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
  ActivityClaimClick: 'nukemai_activity_claim_click',
  ActivityClaimFail: 'nukemai_activity_claim_fail',
  ActivityClaimSuccess: 'nukemai_activity_claim_success',
  ActivityEntryClick: 'nukemai_activity_entry_click',
  ActivityLoginRedirect: 'nukemai_activity_login_redirect',
  ActivityLoginSuccess: 'nukemai_activity_login_success',
  ActivityPopupClose: 'nukemai_activity_popup_close',
  ActivityPopupExposure: 'nukemai_activity_popup_exposure',
  AuthLifecycle: 'nukemai_auth_lifecycle',
  BrowserSettingChanged: 'nukemai_browser_setting_changed',
  CustomModelConnectionTested: 'nukemai_custom_model_connection_tested',
  CustomModelSettingsSaved: 'nukemai_custom_model_settings_saved',
  ConversationBlockAction: 'nukemai_conversation_block_action',
  ConversationMessageAction: 'nukemai_conversation_message_action',
  ConversationNavigationAction: 'nukemai_conversation_navigation_action',
  DreamingSettingChanged: 'nukemai_dreaming_setting_changed',
  DshAction: 'nukemai_dsh_action',
  EmailSkillConnectionTested: 'nukemai_email_skill_connection_tested',
  EmailSkillSettingsSaved: 'nukemai_email_skill_settings_saved',
  ExpertKitAction: 'nukemai_expert_kit_action',
  ExpertKitSelected: 'nukemai_expert_kit_selected',
  ExperimentalSettingChanged: 'nukemai_experimental_setting_changed',
  GeneralSettingChanged: 'nukemai_general_setting_changed',
  ImConnectionTested: 'nukemai_im_connection_tested',
  ImGatewayToggled: 'nukemai_im_gateway_toggled',
  ImInstanceChanged: 'nukemai_im_instance_changed',
  ImPromptSubmit: 'nukemai_im_prompt_submit',
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

export type LogEventAction = `${typeof LogReporterActionPrefix.NukemAI}${string}`;

export const LogReporterEntry = {
  PromptToolsMenu: 'prompt_tools_menu',
} as const;

export const LogReporterSource = {
  OpenClawChannel: 'openclaw_channel',
  SettingsExperimental: 'settings_experimental',
} as const;

export const PromptAnalyticsSurface = {
  Home: 'home',
  Conversation: 'conversation',
} as const;

export type PromptAnalyticsSurface =
  typeof PromptAnalyticsSurface[keyof typeof PromptAnalyticsSurface];

export const PromptAnalyticsConversationState = {
  NewTask: 'new_task',
  ContinueSession: 'continue_session',
} as const;

export type PromptAnalyticsConversationState =
  typeof PromptAnalyticsConversationState[keyof typeof PromptAnalyticsConversationState];

export const LogReporterStoreKey = {
  AppConfig: 'app_config',
  AuthUser: 'auth_user',
  InstallationUuid: 'installation_uuid',
} as const;
