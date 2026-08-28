export const HtmlShareIpc = {
  CreateFromHtmlFile: 'htmlShare:createFromHtmlFile',
  UpdateFromHtmlFile: 'htmlShare:updateFromHtmlFile',
  GetByHtmlFile: 'htmlShare:getByHtmlFile',
  CreateFromArtifactFile: 'htmlShare:createFromArtifactFile',
  UpdateFromArtifactFile: 'htmlShare:updateFromArtifactFile',
  GetByArtifactFile: 'htmlShare:getByArtifactFile',
  GetBySource: 'htmlShare:getBySource',
  UpdateStatus: 'htmlShare:updateStatus',
  UpdateAccessMode: 'htmlShare:updateAccessMode',
  Disable: 'htmlShare:disable',
  DeletePermanently: 'htmlShare:deletePermanently',
  Get: 'htmlShare:get',
  GetQuota: 'htmlShare:getQuota',
  GetTrialPolicy: 'htmlShare:getTrialPolicy',
  GetAnalytics: 'htmlShare:getAnalytics',
} as const;

export type HtmlShareIpc = (typeof HtmlShareIpc)[keyof typeof HtmlShareIpc];

export const HtmlShareSourceType = {
  HtmlFile: 'html_file',
  ImageFile: 'image_file',
  SvgFile: 'svg_file',
  DocumentFile: 'document_file',
  MarkdownFile: 'markdown_file',
  MermaidFile: 'mermaid_file',
  NodeServiceDeployment: 'node_service_deployment',
  StaticServiceDeployment: 'static_service_deployment',
} as const;

export type HtmlShareSourceType = (typeof HtmlShareSourceType)[keyof typeof HtmlShareSourceType];

export const HtmlShareAccessMode = {
  Code: 'code',
  Public: 'public',
} as const;

export type HtmlShareAccessMode = (typeof HtmlShareAccessMode)[keyof typeof HtmlShareAccessMode];

export const HtmlShareStatus = {
  Live: 'live',
  Disabled: 'disabled',
  Failed: 'failed',
} as const;

export type HtmlShareStatus = (typeof HtmlShareStatus)[keyof typeof HtmlShareStatus];
export type HtmlShareConfigurableStatus =
  | typeof HtmlShareStatus.Live
  | typeof HtmlShareStatus.Disabled;

export interface HtmlShareAnalytics {
  summary: {
    accesses: number;
    uniqueVisitors: number;
  };
  trend: Array<{
    date: string;
    accesses: number;
    uniqueVisitors: number;
  }>;
  meta: {
    from: string;
    to: string;
    granularity: 'day';
    timeZone: string;
    dataScope: 'share_lifetime';
    visitorMetric: 'ip_hash_estimate';
    retentionDays: number;
    dataAvailableFrom?: string | null;
  };
}

export interface HtmlShareAnalyticsInput {
  shareId: string;
  from?: string;
  to?: string;
}

export interface HtmlShareAnalyticsResult {
  success: boolean;
  analytics?: HtmlShareAnalytics;
  error?: string;
  code?: number;
}

export interface HtmlSharePermanentDeleteResult {
  success: boolean;
  error?: string;
  code?: number;
  httpStatus?: number;
}

export const HtmlShareDisabledSource = {
  User: 'user',
  Admin: 'admin',
  Moderation: 'moderation',
  ActiveLimit: 'active_limit',
  System: 'system',
} as const;

export type HtmlShareDisabledSource =
  (typeof HtmlShareDisabledSource)[keyof typeof HtmlShareDisabledSource];

export const HtmlShareErrorCode = {
  ReopenUnavailable: 41304,
  SubscriptionRequired: 41307,
  AccessCodeInvalid: 41308,
  AccessCodeRateLimited: 41309,
  AccessModeInvalid: 41310,
  ActiveShareLimitReached: 41311,
  UnsafeSvg: 41312,
  AccessExpired: 41313,
  QuotaConfigInvalid: 41314,
  DeleteRequiresDisabled: 41315,
  ActionConflict: 41316,
  FeatureUnavailable: 49001,
  DisabledCannotUpdate: 49002,
} as const;

export const HtmlSharePublicRoute = {
  Root: '/s',
} as const;

export type HtmlSharePublicRoute = (typeof HtmlSharePublicRoute)[keyof typeof HtmlSharePublicRoute];
