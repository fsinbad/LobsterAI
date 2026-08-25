import type {
  LibraryArtifactType,
  LibraryAvailability,
  LibraryCategory,
  LibraryChangeReason,
  LibraryErrorCode,
  LibraryIndexPhase,
  LibraryItemKind,
  LibraryOrigin,
  LibraryRelationKind,
  LibrarySort,
} from './constants';

export interface LibrarySuccess<T> {
  success: true;
  data: T;
}

export interface LibraryFailure {
  success: false;
  code: LibraryErrorCode;
  error: string;
}

export type LibraryResult<T> = LibrarySuccess<T> | LibraryFailure;

export interface LibrarySessionRef {
  sessionId: string;
  title: string;
  agentId: string;
  lastRelatedAt: number;
  lastMessageId?: string;
  sessionArtifactId?: string;
}

export interface LibraryItemBase {
  itemKind: LibraryItemKind;
  itemId: string;
  title: string;
  category: Exclude<LibraryCategory, 'all'>;
  sortTime: number;
  createdAt: number;
  isFavorite: boolean;
  latestSession?: LibrarySessionRef;
}

export interface LocalArtifactItem extends LibraryItemBase {
  itemKind: 'local_artifact';
  latestSession: LibrarySessionRef;
  filePath: string;
  artifactType: LibraryArtifactType;
  extension: string;
  sizeBytes?: number;
  fileMtimeMs?: number;
  availability: LibraryAvailability;
  origin: LibraryOrigin;
  relatedSessionCount: number;
  clientSourceKey?: string;
}

export type LibraryItem = LocalArtifactItem;

export interface LibraryLocalListOptions {
  category?: LibraryCategory;
  keyword?: string;
  cursor?: string;
  pageSize?: number;
  sort?: LibrarySort;
  favoritesOnly?: boolean;
}

export interface LibraryLocalCounts {
  total: number;
  available: number;
  missing: number;
}

export interface LibraryLocalListData {
  list: LocalArtifactItem[];
  nextCursor?: string;
  hasMore: boolean;
  counts: LibraryLocalCounts;
}

export interface LibraryGetLocalItemsInput {
  itemIds: string[];
}

export interface LibraryGetLocalItemsData {
  items: LocalArtifactItem[];
  unavailableItemIds: string[];
}

export interface LibraryArtifactCandidate {
  sessionId: string;
  messageId?: string;
  sessionArtifactId?: string;
  filePath: string;
  detectedType: LibraryArtifactType;
  relationKind: LibraryRelationKind;
  relatedAt: number;
  origin?: LibraryOrigin;
}

export interface LibraryRecordCandidatesData {
  recorded: number;
  ignored: number;
}

export interface LibraryAddLocalFilesData {
  items: LocalArtifactItem[];
  ignoredPaths: string[];
}

export interface LibraryFavoriteInput {
  ownerScope: string;
  itemKind: LibraryItemKind;
  itemId: string;
  favorite: boolean;
}

export interface LibraryLocalActionInput {
  itemId: string;
}

export interface LibrarySessionRelation extends LibrarySessionRef {
  relationKind: LibraryRelationKind;
  firstRelatedAt: number;
}

export interface LibraryLocalDetailData {
  item: LocalArtifactItem;
  sessions: LibrarySessionRelation[];
}

export interface LibraryIndexStatus {
  phase: LibraryIndexPhase;
  trackedCount: number;
  availableCount: number;
  missingCount: number;
  watchedDirectoryCount: number;
  watcherDegraded: boolean;
  lastReconcileAt?: number;
  backfillCompletedAt?: number;
}

export interface LibraryBackfillState {
  cursor?: string;
  completedAt?: number;
  policyVersion: number;
}

export interface LibraryChangedPayload {
  reason: LibraryChangeReason;
  itemIds?: string[];
}
