import { describe, expect, test } from 'vitest';

import { LibraryItemKind } from '../../../shared/library/constants';
import type { LocalArtifactItem } from '../../../shared/library/types';
import {
  getLibraryCardActionIds,
  getLibraryPreviewActionIds,
  LibraryItemAction,
} from './libraryItemActionPolicy';

const makeItem = (overrides: Partial<LocalArtifactItem> = {}): LocalArtifactItem => ({
  itemKind: LibraryItemKind.LocalArtifact,
  itemId: 'item-1',
  title: 'Item',
  category: 'document',
  sortTime: 1,
  createdAt: 1,
  isFavorite: false,
  latestSession: {
    sessionId: 'session-1',
    title: 'Session',
    agentId: 'main',
    lastRelatedAt: 1,
  },
  filePath: '/tmp/item.pdf',
  artifactType: 'document',
  extension: '.pdf',
  availability: 'available',
  origin: 'conversation',
  relatedSessionCount: 1,
  ...overrides,
});

describe('library item action policy', () => {
  test('offers local file management actions for a local artifact', () => {
    const actions = getLibraryCardActionIds(makeItem());
    expect(actions).toEqual([
      LibraryItemAction.ToggleFavorite,
      LibraryItemAction.OpenWithApp,
      LibraryItemAction.RevealLocal,
    ]);
  });

  test('keeps favorite in the preview header and moves local utilities into overflow', () => {
    expect(getLibraryPreviewActionIds(makeItem())).toEqual([
      LibraryItemAction.OpenWithApp,
      LibraryItemAction.RevealLocal,
    ]);
  });
});
