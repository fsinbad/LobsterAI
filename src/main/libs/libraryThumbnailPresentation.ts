import type { NativeImage, Rectangle } from 'electron';

interface ThumbnailPresentationWebContents {
  beginFrameSubscription: (
    onlyDirty: boolean,
    callback: (image: NativeImage, dirtyRect: Rectangle) => void,
  ) => void;
  endFrameSubscription: () => void;
  invalidate: () => void;
  isDestroyed: () => boolean;
}

export const waitForCommittedThumbnailPresentation = (
  webContents: ThumbnailPresentationWebContents,
  timeoutMs: number,
): Promise<NativeImage> => new Promise((resolve, reject) => {
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let presentedFrameCount = 0;

  const finish = (error?: Error, image?: NativeImage): void => {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    if (!webContents.isDestroyed()) {
      try {
        webContents.endFrameSubscription();
      } catch {
        // The renderer can disappear while a frame is being delivered.
      }
    }
    if (error) reject(error);
    else if (image) resolve(image);
    else reject(new Error('Thumbnail presentation did not provide a frame'));
  };

  timer = setTimeout(() => {
    finish(new Error('Thumbnail presentation timed out'));
  }, timeoutMs);

  try {
    webContents.beginFrameSubscription(false, image => {
      if (settled) return;
      presentedFrameCount += 1;
      if (presentedFrameCount === 1) {
        try {
          webContents.invalidate();
        } catch (error) {
          finish(error instanceof Error ? error : new Error('Thumbnail repaint failed'));
        }
        return;
      }
      finish(undefined, image);
    });
    webContents.invalidate();
  } catch (error) {
    finish(error instanceof Error ? error : new Error('Thumbnail presentation failed'));
  }
});
