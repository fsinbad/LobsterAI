import { afterEach, describe, expect, test } from 'vitest';

import {
  clearLibraryThumbnailCache,
  createLibraryThumbnailCacheKey,
  getCachedLibraryThumbnail,
  LibraryThumbnailClientCacheVersion,
  loadLibraryThumbnail,
  shouldApplyLibraryThumbnailResult,
} from './libraryThumbnailCache';

afterEach(() => {
  clearLibraryThumbnailCache();
});

describe('library thumbnail cache', () => {
  test('changes the cache key when the file mtime changes', () => {
    expect(createLibraryThumbnailCacheKey('/tmp/report.pdf', 100)).not.toBe(
      createLibraryThumbnailCacheKey('/tmp/report.pdf', 200),
    );
  });

  test('includes the renderer identity version in the cache key', () => {
    expect(createLibraryThumbnailCacheKey('/tmp/report.pdf', 100)).toContain(
      `${LibraryThumbnailClientCacheVersion}\0`,
    );
  });

  test('rejects a completed request after the card identity changes', () => {
    const imageKey = createLibraryThumbnailCacheKey('/tmp/image.png', 100);
    const markdownKey = createLibraryThumbnailCacheKey('/tmp/README.md', 100);

    expect(shouldApplyLibraryThumbnailResult(imageKey, markdownKey, true)).toBe(false);
    expect(shouldApplyLibraryThumbnailResult(imageKey, imageKey, false)).toBe(false);
    expect(shouldApplyLibraryThumbnailResult(imageKey, imageKey, true)).toBe(true);
  });

  test('deduplicates requests and keeps the loaded thumbnail', async () => {
    const cacheKey = createLibraryThumbnailCacheKey('/tmp/report.pdf', 100);
    let loadCount = 0;
    const load = async () => {
      loadCount += 1;
      return 'data:image/png;base64,dGVzdA==';
    };

    const [first, second] = await Promise.all([
      loadLibraryThumbnail(cacheKey, load),
      loadLibraryThumbnail(cacheKey, load),
    ]);

    expect(first).toBe('data:image/png;base64,dGVzdA==');
    expect(second).toBe(first);
    expect(loadCount).toBe(1);
    expect(getCachedLibraryThumbnail(cacheKey)).toBe(first);
  });
});
