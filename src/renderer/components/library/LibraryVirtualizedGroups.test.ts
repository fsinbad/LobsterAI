import { describe, expect, test } from 'vitest';

import { getLibraryGridColumnCount } from './LibraryVirtualizedGroups';

describe('LibraryVirtualizedGroups', () => {
  test.each([
    [200, 1],
    [504, 2],
    [756, 3],
    [1_120, 4],
  ])('uses %i px for %i grid columns', (width, expected) => {
    expect(getLibraryGridColumnCount(width)).toBe(expected);
  });
});
