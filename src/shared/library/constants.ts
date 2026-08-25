export const LibraryItemKind = {
  LocalArtifact: 'local_artifact',
} as const;
export type LibraryItemKind = typeof LibraryItemKind[keyof typeof LibraryItemKind];

export const LibrarySourceFilter = {
  Local: 'local',
} as const;
export type LibrarySourceFilter = typeof LibrarySourceFilter[keyof typeof LibrarySourceFilter];

export const LibraryCategory = {
  All: 'all',
  Web: 'web',
  Slides: 'slides',
  Document: 'document',
  Spreadsheet: 'spreadsheet',
  Image: 'image',
  Media: 'media',
  Site: 'site',
  Other: 'other',
} as const;
export type LibraryCategory = typeof LibraryCategory[keyof typeof LibraryCategory];

export const LibraryRelationKind = {
  Created: 'created',
  Modified: 'modified',
  Referenced: 'referenced',
} as const;
export type LibraryRelationKind = typeof LibraryRelationKind[keyof typeof LibraryRelationKind];

export const LibraryAvailability = {
  Available: 'available',
  Missing: 'missing',
  PermissionDenied: 'permission_denied',
} as const;
export type LibraryAvailability = typeof LibraryAvailability[keyof typeof LibraryAvailability];

export const LibraryOrigin = {
  Conversation: 'conversation',
  Manual: 'manual',
  Backfill: 'backfill',
} as const;
export type LibraryOrigin = typeof LibraryOrigin[keyof typeof LibraryOrigin];

export const LibrarySort = {
  RecentlyUpdated: 'recently_updated',
} as const;
export type LibrarySort = typeof LibrarySort[keyof typeof LibrarySort];

export const LibraryViewMode = {
  Grid: 'grid',
  List: 'list',
} as const;
export type LibraryViewMode = typeof LibraryViewMode[keyof typeof LibraryViewMode];

export const LibraryArtifactType = {
  Html: 'html',
  Svg: 'svg',
  Image: 'image',
  Video: 'video',
  Mermaid: 'mermaid',
  Code: 'code',
  Markdown: 'markdown',
  Text: 'text',
  Document: 'document',
} as const;
export type LibraryArtifactType = typeof LibraryArtifactType[keyof typeof LibraryArtifactType];

export const LibraryIndexPhase = {
  Idle: 'idle',
  Backfill: 'backfill',
  Repair: 'repair',
} as const;
export type LibraryIndexPhase = typeof LibraryIndexPhase[keyof typeof LibraryIndexPhase];

export const LibraryErrorCode = {
  InvalidInput: 'invalid_input',
  NotFound: 'not_found',
  NotAvailable: 'not_available',
  PermissionDenied: 'permission_denied',
  NotAuthenticated: 'not_authenticated',
  CloudUnavailable: 'cloud_unavailable',
  Internal: 'internal_error',
} as const;
export type LibraryErrorCode = typeof LibraryErrorCode[keyof typeof LibraryErrorCode];

export const LibraryChangeReason = {
  Recorded: 'recorded',
  FileChanged: 'file_changed',
  Favorite: 'favorite',
  Repair: 'repair',
  SessionDeleted: 'session_deleted',
} as const;
export type LibraryChangeReason =
  typeof LibraryChangeReason[keyof typeof LibraryChangeReason];

export const LibraryIpc = {
  ListLocal: 'library:listLocal',
  GetLocalItems: 'library:getLocalItems',
  GetLocalDetail: 'library:getLocalDetail',
  RecordCandidates: 'library:recordCandidates',
  AddLocalFiles: 'library:addLocalFiles',
  SetFavorite: 'library:setFavorite',
  OpenLocal: 'library:openLocal',
  RevealLocal: 'library:revealLocal',
  RepairIndex: 'library:repairIndex',
  GetIndexStatus: 'library:getIndexStatus',
  GetBackfillState: 'library:getBackfillState',
  SetBackfillState: 'library:setBackfillState',
  Changed: 'library:changed',
} as const;
export type LibraryIpc = typeof LibraryIpc[keyof typeof LibraryIpc];

export const LibraryLimits = {
  DefaultPageSize: 24,
  MaxPageSize: 100,
  MaxTargetItemIds: 100,
  MaxKeywordLength: 100,
  MaxCandidateBatchSize: 100,
  MaxCandidateStringLength: 4096,
  MaxCandidateBatchStringLength: 200_000,
  WatchDirectoryLimit: 512,
  WatchDebounceMs: 300,
  ReconcileBatchSize: 100,
  ReconcileIntervalMs: 60_000,
  RecentVerificationWindowMs: 10 * 60_000,
  MissingRetentionMs: 7 * 24 * 60 * 60_000,
} as const;

export const LIBRARY_INDEX_POLICY_VERSION = 2;

export const LibraryFavoriteScope = {
  LocalDevice: 'device',
} as const;

const WEB_EXTENSIONS = new Set(['.html', '.htm']);
const SLIDE_EXTENSIONS = new Set(['.pptx']);
const DOCUMENT_EXTENSIONS = new Set(['.docx', '.pdf', '.md', '.txt', '.log']);
const SPREADSHEET_EXTENSIONS = new Set(['.xls', '.xlsx', '.csv', '.tsv']);
const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.avif', '.svg',
]);
const MEDIA_EXTENSIONS = new Set(['.mp4', '.webm', '.mov']);

export const LIBRARY_PREVIEWABLE_EXTENSIONS = new Set([
  ...WEB_EXTENSIONS,
  ...SLIDE_EXTENSIONS,
  ...DOCUMENT_EXTENSIONS,
  ...SPREADSHEET_EXTENSIONS,
  ...IMAGE_EXTENSIONS,
  ...MEDIA_EXTENSIONS,
  '.mermaid', '.mmd', '.jsx', '.tsx', '.css',
]);

export const getLibraryCategoryForExtension = (extension: string): LibraryCategory => {
  const normalized = extension.trim().toLowerCase();
  if (WEB_EXTENSIONS.has(normalized)) return LibraryCategory.Web;
  if (SLIDE_EXTENSIONS.has(normalized)) return LibraryCategory.Slides;
  if (DOCUMENT_EXTENSIONS.has(normalized)) return LibraryCategory.Document;
  if (SPREADSHEET_EXTENSIONS.has(normalized)) return LibraryCategory.Spreadsheet;
  if (IMAGE_EXTENSIONS.has(normalized)) return LibraryCategory.Image;
  if (MEDIA_EXTENSIONS.has(normalized)) return LibraryCategory.Media;
  return LibraryCategory.Other;
};

export const getLibraryArtifactTypeForExtension = (
  extension: string,
): LibraryArtifactType | null => {
  const normalized = extension.trim().toLowerCase();
  if (!LIBRARY_PREVIEWABLE_EXTENSIONS.has(normalized)) return null;
  if (WEB_EXTENSIONS.has(normalized)) return LibraryArtifactType.Html;
  if (normalized === '.svg') return LibraryArtifactType.Svg;
  if (IMAGE_EXTENSIONS.has(normalized)) return LibraryArtifactType.Image;
  if (MEDIA_EXTENSIONS.has(normalized)) return LibraryArtifactType.Video;
  if (normalized === '.mermaid' || normalized === '.mmd') return LibraryArtifactType.Mermaid;
  if (normalized === '.md') return LibraryArtifactType.Markdown;
  if (normalized === '.txt' || normalized === '.log') return LibraryArtifactType.Text;
  if (
    SLIDE_EXTENSIONS.has(normalized)
    || normalized === '.docx'
    || normalized === '.pdf'
    || SPREADSHEET_EXTENSIONS.has(normalized)
  ) {
    return LibraryArtifactType.Document;
  }
  return LibraryArtifactType.Code;
};

export const isLibraryItemKind = (value: unknown): value is LibraryItemKind => (
  typeof value === 'string' && Object.values(LibraryItemKind).includes(value as LibraryItemKind)
);

export const isLibraryCategory = (value: unknown): value is LibraryCategory => (
  typeof value === 'string' && Object.values(LibraryCategory).includes(value as LibraryCategory)
);

export const isLibraryRelationKind = (value: unknown): value is LibraryRelationKind => (
  typeof value === 'string'
  && Object.values(LibraryRelationKind).includes(value as LibraryRelationKind)
);

export const isLibraryArtifactType = (value: unknown): value is LibraryArtifactType => (
  typeof value === 'string'
  && Object.values(LibraryArtifactType).includes(value as LibraryArtifactType)
);