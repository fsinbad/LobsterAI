import type { NativeImage, Rectangle } from 'electron';
import { describe, expect, test, vi } from 'vitest';

import { waitForCommittedThumbnailPresentation } from './libraryThumbnailPresentation';

const createWebContents = (frames: NativeImage[]) => {
  let callback: ((image: NativeImage, dirtyRect: Rectangle) => void) | undefined;
  const endFrameSubscription = vi.fn();
  const invalidate = vi.fn(() => {
    const image = frames.shift();
    if (image) {
      queueMicrotask(() => callback?.(image, {
        x: 0,
        y: 0,
        width: 480,
        height: 270,
      }));
    }
  });
  return {
    beginFrameSubscription: vi.fn((
      _onlyDirty: boolean,
      nextCallback: (image: NativeImage, dirtyRect: Rectangle) => void,
    ) => {
      callback = nextCallback;
    }),
    endFrameSubscription,
    invalidate,
    isDestroyed: () => false,
  };
};

describe('library thumbnail presentation barrier', () => {
  test('ignores the first frame and returns the frame committed after a second repaint', async () => {
    const firstFrame = { frame: 'previous' } as unknown as NativeImage;
    const committedFrame = { frame: 'current' } as unknown as NativeImage;
    const webContents = createWebContents([firstFrame, committedFrame]);

    await expect(waitForCommittedThumbnailPresentation(webContents, 50)).resolves.toBe(
      committedFrame,
    );

    expect(webContents.beginFrameSubscription).toHaveBeenCalledWith(false, expect.any(Function));
    expect(webContents.invalidate).toHaveBeenCalledTimes(2);
    expect(webContents.endFrameSubscription).toHaveBeenCalledTimes(1);
  });

  test('ends the frame subscription when presentation times out', async () => {
    const webContents = createWebContents([]);

    await expect(waitForCommittedThumbnailPresentation(webContents, 5)).rejects.toThrow(
      'Thumbnail presentation timed out',
    );

    expect(webContents.endFrameSubscription).toHaveBeenCalledTimes(1);
  });
});
