import { describe, expect, test } from 'vitest';

import {
  LibraryChangeReason,
  LibraryItemKind,
} from '../../../shared/library/constants';
import type { LocalArtifactItem } from '../../../shared/library/types';
import {
  applyLibraryFavoriteState,
  hideLibraryLocalItems,
  restoreLibraryFavoriteState,
  sanitizeLibraryLocalListData,
  shouldReloadLibraryAfterChange,
} from './libraryListState';

const makeLocalItem = (itemId: string, isFavorite: boolean): LocalArtifactItem => ({
  itemKind: LibraryItemKind.LocalArtifact,
  itemId,
  title: `${itemId}.pdf`,
  category: 'document',
  sortTime: 1,
  createdAt: 1,
  isFavorite,
  latestSession: {
    sessionId: 'session-1',
    title: 'Task',
    agentId: 'main',
    lastRelatedAt: 1,
  },
  filePath: `/tmp/${itemId}.pdf`,
  artifactType: 'document',
  extension: '.pdf',
  availability: 'available',
  origin: 'conversation',
  relatedSessionCount: 1,
});

describe('library list state', () => {
  test('does not reload the list for an optimistically applied favorite event', () => {
    expect(shouldReloadLibraryAfterChange({
      reason: LibraryChangeReason.Favorite,
      itemIds: ['item-1'],
    })).toBe(false);
    expect(shouldReloadLibraryAfterChange({
      reason: LibraryChangeReason.FileChanged,
      itemIds: ['item-1'],
    })).toBe(true);
  });

  test('updates favorite state in place and removes an unfavorited filtered item', () => {
    const first = makeLocalItem('first', false);
    const second = makeLocalItem('second', true);

    expect(applyLibraryFavoriteState([first, second], first, true, false)).toEqual([
      { ...first, isFavorite: true },
      second,
    ]);
    expect(applyLibraryFavoriteState([first, second], second, false, true)).toEqual([first]);
  });

  test('restores a filtered item when persisting its favorite state fails', () => {
    const item = makeLocalItem('item-1', true);
    expect(restoreLibraryFavoriteState([], item)).toEqual([item]);
  });

  test('hides local items without clearing the source count', () => {
    expect(hideLibraryLocalItems({
      list: [],
      nextCursor: 'local-next',
      hasMore: true,
      counts: { total: 12, available: 10, missing: 2 },
    })).toEqual({
      list: [],
      hasMore: false,
      counts: { total: 12, available: 10, missing: 2 },
    });
  });

  test('defensively ignores malformed local items without a valid task relation', () => {
    const valid = makeLocalItem('valid', false);
    const missingTask = {
      ...makeLocalItem('missing-task', false),
      latestSession: undefined,
      relatedSessionCount: 0,
    } as unknown as LocalArtifactItem;
    const result = sanitizeLibraryLocalListData({
      list: [valid, missingTask],
      hasMore: false,
      counts: { total: 2, available: 2, missing: 0 },
    });

    expect(result.ignoredCount).toBe(1);
    expect(result.data.list).toEqual([valid]);
    expect(result.data.counts.total).toBe(2);
  });
});
