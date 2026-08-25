import { describe, expect, test } from 'vitest';

import { LibraryItemKind } from '../../../shared/library/constants';
import type { LocalArtifactItem } from '../../../shared/library/types';
import { getLibraryDisplayFileName } from './libraryItemPresentation';

const makeLocalItem = (overrides: Partial<LocalArtifactItem> = {}): LocalArtifactItem => ({
  itemKind: LibraryItemKind.LocalArtifact,
  itemId: 'local-item-1',
  title: 'report.pdf',
  category: 'document',
  sortTime: 1,
  createdAt: 1,
  isFavorite: false,
  latestSession: {
    sessionId: 'session-1',
    title: 'Task',
    agentId: 'main',
    lastRelatedAt: 1,
  },
  filePath: '/tmp/report.pdf',
  artifactType: 'document',
  extension: '.pdf',
  availability: 'available',
  origin: 'conversation',
  relatedSessionCount: 1,
  ...overrides,
});

describe('library item presentation', () => {
  test('uses the item title as the display file name for local artifacts', () => {
    expect(getLibraryDisplayFileName(makeLocalItem())).toBe('report.pdf');
  });

  test('keeps the unicode title for local artifacts', () => {
    expect(getLibraryDisplayFileName(makeLocalItem({ title: '员工信息表.xlsx' }))).toBe(
      '员工信息表.xlsx',
    );
  });
});
