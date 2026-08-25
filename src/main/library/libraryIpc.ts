import { ipcMain, shell } from 'electron';

import {
  isLibraryArtifactType,
  isLibraryCategory,
  isLibraryItemKind,
  isLibraryRelationKind,
  LibraryChangeReason,
  LibraryErrorCode,
  LibraryFavoriteScope,
  LibraryIpc,
  LibraryItemKind,
  LibraryLimits,
  LibraryOrigin,
  LibrarySort,
} from '../../shared/library/constants';
import type {
  LibraryArtifactCandidate,
  LibraryBackfillState,
  LibraryFavoriteInput,
  LibraryGetLocalItemsInput,
  LibraryLocalListOptions,
  LibraryResult,
} from '../../shared/library/types';
import { LibraryIndexService } from './libraryIndexService';
import { decodeLibraryLocalCursor, LibraryLocalStore } from './libraryLocalStore';

export interface LibraryIpcDependencies {
  localStore: LibraryLocalStore;
  indexService: LibraryIndexService;
}

const success = <T>(data: T): LibraryResult<T> => ({ success: true, data });

const failure = <T>(code: LibraryErrorCode, error: string): LibraryResult<T> => ({
  success: false,
  code,
  error,
});

const requireItemId = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) {
    throw new Error('Invalid library item identifier.');
  }
  return value.trim();
};

export const normalizeLibraryTargetItemIds = (value: unknown): string[] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid library item request.');
  }
  const input = value as Partial<LibraryGetLocalItemsInput>;
  if (
    !Array.isArray(input.itemIds)
    || input.itemIds.length < 1
    || input.itemIds.length > LibraryLimits.MaxTargetItemIds
  ) {
    throw new Error('Invalid library item identifiers.');
  }
  return [...new Set(input.itemIds.map(requireItemId))];
};

const normalizeLocalListOptions = (value: unknown): LibraryLocalListOptions => {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid list options.');
  const input = value as Record<string, unknown>;
  if (input.category !== undefined && !isLibraryCategory(input.category)) {
    throw new Error('Invalid library category.');
  }
  if (input.sort !== undefined && input.sort !== LibrarySort.RecentlyUpdated) {
    throw new Error('Invalid library sort.');
  }
  const cursor = typeof input.cursor === 'string' && input.cursor.trim()
    ? input.cursor.trim()
    : undefined;
  if (cursor && !decodeLibraryLocalCursor(cursor)) throw new Error('Invalid library cursor.');
  return {
    ...(input.category ? { category: input.category as LibraryLocalListOptions['category'] } : {}),
    ...(typeof input.keyword === 'string'
      ? { keyword: input.keyword.slice(0, LibraryLimits.MaxKeywordLength) }
      : {}),
    ...(cursor ? { cursor } : {}),
    ...(typeof input.pageSize === 'number' && Number.isInteger(input.pageSize)
      ? { pageSize: input.pageSize }
      : {}),
    ...(input.sort ? { sort: LibrarySort.RecentlyUpdated } : {}),
    ...(typeof input.favoritesOnly === 'boolean'
      ? { favoritesOnly: input.favoritesOnly }
      : {}),
  };
};

const normalizeCandidates = (value: unknown): LibraryArtifactCandidate[] => {
  if (!Array.isArray(value) || value.length > LibraryLimits.MaxCandidateBatchSize) {
    throw new Error('Invalid artifact candidate batch.');
  }
  let totalStringLength = 0;
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Invalid artifact candidate.');
    }
    const input = item as Record<string, unknown>;
    const sessionId = requireItemId(input.sessionId);
    const filePath = typeof input.filePath === 'string' ? input.filePath.trim() : '';
    if (!filePath || filePath.length > LibraryLimits.MaxCandidateStringLength) {
      throw new Error('Invalid artifact candidate path.');
    }
    if (!isLibraryArtifactType(input.detectedType)) {
      throw new Error('Invalid artifact candidate type.');
    }
    if (!isLibraryRelationKind(input.relationKind)) {
      throw new Error('Invalid artifact candidate relation.');
    }
    if (!Number.isSafeInteger(input.relatedAt) || (input.relatedAt as number) <= 0) {
      throw new Error('Invalid artifact candidate timestamp.');
    }
    const messageId = typeof input.messageId === 'string'
      ? input.messageId.trim().slice(0, 200)
      : undefined;
    const sessionArtifactId = typeof input.sessionArtifactId === 'string'
      ? input.sessionArtifactId.trim().slice(0, 200)
      : undefined;
    const allowedOrigins: readonly LibraryOrigin[] = [
      LibraryOrigin.Conversation,
      LibraryOrigin.Backfill,
    ];
    const origin = allowedOrigins.includes(input.origin as LibraryOrigin)
      ? input.origin as LibraryOrigin
      : LibraryOrigin.Conversation;
    totalStringLength += sessionId.length + filePath.length
      + (messageId?.length ?? 0) + (sessionArtifactId?.length ?? 0);
    if (totalStringLength > LibraryLimits.MaxCandidateBatchStringLength) {
      throw new Error('Artifact candidate batch is too large.');
    }
    return {
      sessionId,
      filePath,
      detectedType: input.detectedType,
      relationKind: input.relationKind,
      relatedAt: input.relatedAt as number,
      origin,
      ...(messageId ? { messageId } : {}),
      ...(sessionArtifactId ? { sessionArtifactId } : {}),
    };
  });
};

export const registerLibraryIpcHandlers = ({
  localStore,
  indexService,
}: LibraryIpcDependencies): void => {
  ipcMain.handle(LibraryIpc.ListLocal, (_event, input: unknown) => {
    try {
      return success(localStore.list(normalizeLocalListOptions(input)));
    } catch (error) {
      return failure(
        LibraryErrorCode.InvalidInput,
        error instanceof Error ? error.message : 'Invalid local library request.',
      );
    }
  });

  ipcMain.handle(LibraryIpc.GetLocalItems, (_event, input: unknown) => {
    try {
      return success(localStore.getVisibleItems(normalizeLibraryTargetItemIds(input)));
    } catch (error) {
      return failure(
        LibraryErrorCode.InvalidInput,
        error instanceof Error ? error.message : 'Invalid library item request.',
      );
    }
  });

  ipcMain.handle(LibraryIpc.GetLocalDetail, (_event, itemId: unknown) => {
    try {
      const detail = localStore.getDetail(requireItemId(itemId));
      return detail
        ? success(detail)
        : failure(LibraryErrorCode.NotFound, 'Library item was not found.');
    } catch (error) {
      return failure(
        LibraryErrorCode.InvalidInput,
        error instanceof Error ? error.message : 'Invalid library item.',
      );
    }
  });

  ipcMain.handle(LibraryIpc.RecordCandidates, async (_event, input: unknown) => {
    try {
      return success(await indexService.recordCandidates(normalizeCandidates(input)));
    } catch (error) {
      return failure(
        LibraryErrorCode.InvalidInput,
        error instanceof Error ? error.message : 'Invalid artifact candidate batch.',
      );
    }
  });

  ipcMain.handle(LibraryIpc.AddLocalFiles, async (_event, input: unknown) => {
    try {
      if (!Array.isArray(input) || input.length > LibraryLimits.MaxCandidateBatchSize) {
        throw new Error('Invalid local file selection.');
      }
      const paths = input.map(value => {
        if (
          typeof value !== 'string'
          || !value.trim()
          || value.length > LibraryLimits.MaxCandidateStringLength
        ) {
          throw new Error('Invalid local file path.');
        }
        return value.trim();
      });
      return success(await indexService.addLocalFiles(paths));
    } catch (error) {
      return failure(
        LibraryErrorCode.InvalidInput,
        error instanceof Error ? error.message : 'Invalid local file selection.',
      );
    }
  });

  ipcMain.handle(LibraryIpc.SetFavorite, (_event, value: unknown) => {
    try {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Invalid favorite request.');
      }
      const input = value as Partial<LibraryFavoriteInput>;
      if (!isLibraryItemKind(input.itemKind) || typeof input.favorite !== 'boolean') {
        throw new Error('Invalid favorite request.');
      }
      const itemId = requireItemId(input.itemId);
      if (input.itemKind !== LibraryItemKind.LocalArtifact) {
        throw new Error('Cloud favorites are not supported.');
      }
      if (!localStore.getItem(itemId)) {
        return failure(LibraryErrorCode.NotFound, 'Library item was not found.');
      }
      localStore.setFavorite({
        ownerScope: LibraryFavoriteScope.LocalDevice,
        itemKind: input.itemKind,
        itemId,
        favorite: input.favorite,
      });
      indexService.notifyChange({ reason: LibraryChangeReason.Favorite, itemIds: [itemId] });
      return success({ favorite: input.favorite });
    } catch (error) {
      return failure(
        LibraryErrorCode.InvalidInput,
        error instanceof Error ? error.message : 'Invalid favorite request.',
      );
    }
  });

  ipcMain.handle(LibraryIpc.OpenLocal, async (_event, value: unknown) => {
    try {
      const filePath = localStore.resolvePath(requireItemId(value));
      if (!filePath) return failure(LibraryErrorCode.NotFound, 'Library item was not found.');
      const error = await shell.openPath(filePath);
      return error ? failure(LibraryErrorCode.NotAvailable, error) : success(null);
    } catch (error) {
      return failure(
        LibraryErrorCode.InvalidInput,
        error instanceof Error ? error.message : 'Invalid library item.',
      );
    }
  });

  ipcMain.handle(LibraryIpc.RevealLocal, (_event, value: unknown) => {
    try {
      const filePath = localStore.resolvePath(requireItemId(value));
      if (!filePath) return failure(LibraryErrorCode.NotFound, 'Library item was not found.');
      shell.showItemInFolder(filePath);
      return success(null);
    } catch (error) {
      return failure(
        LibraryErrorCode.InvalidInput,
        error instanceof Error ? error.message : 'Invalid library item.',
      );
    }
  });

  ipcMain.handle(LibraryIpc.RepairIndex, async () => {
    try {
      return success(await indexService.repair());
    } catch (error) {
      console.error('[Library] Index repair failed.', error);
      return failure(LibraryErrorCode.Internal, 'Library index repair failed.');
    }
  });

  ipcMain.handle(LibraryIpc.GetIndexStatus, () => success(indexService.getStatus()));
  ipcMain.handle(LibraryIpc.GetBackfillState, () => success(indexService.getBackfillState()));
  ipcMain.handle(LibraryIpc.SetBackfillState, (_event, value: unknown) => {
    try {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Invalid backfill state.');
      }
      const input = value as Partial<LibraryBackfillState>;
      if (!Number.isSafeInteger(input.policyVersion) || (input.policyVersion ?? 0) < 1) {
        throw new Error('Invalid backfill policy version.');
      }
      const state: LibraryBackfillState = {
        policyVersion: input.policyVersion as number,
        ...(typeof input.cursor === 'string' && input.cursor.length <= 500
          ? { cursor: input.cursor }
          : {}),
        ...(Number.isSafeInteger(input.completedAt) && (input.completedAt ?? 0) > 0
          ? { completedAt: input.completedAt }
          : {}),
      };
      indexService.setBackfillState(state);
      return success(state);
    } catch (error) {
      return failure(
        LibraryErrorCode.InvalidInput,
        error instanceof Error ? error.message : 'Invalid backfill state.',
      );
    }
  });
};
