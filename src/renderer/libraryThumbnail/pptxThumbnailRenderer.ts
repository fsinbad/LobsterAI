export const PptxThumbnailTiming = {
  MediaReadyTimeoutMs: 3_000,
  StableLayoutMaxFrames: 8,
} as const;

interface PptxPreviewerLike {
  readonly slideCount: number;
  readonly wrapper: HTMLElement;
  load: (file: ArrayBuffer) => Promise<unknown>;
  renderSingleSlide: (slideIndex: number) => void;
  destroy: () => void;
}

export interface PptxPreviewModuleLike {
  init: (
    root: HTMLElement,
    options: { width: number; mode: 'list' },
  ) => PptxPreviewerLike;
}

export interface PptxFirstSlideRender {
  previewer: PptxPreviewerLike;
  slide: HTMLElement;
  slideCount: number;
}

export interface PptxSlideReadiness {
  imageCount: number;
  decodedImageCount: number;
  hasVisualContent: boolean;
}

type NextFrame = () => Promise<void>;

const nextAnimationFrame: NextFrame = () => new Promise(resolve => {
  requestAnimationFrame(() => resolve());
});

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const waitForImageLoad = (
  image: HTMLImageElement,
  timeoutMs: number,
): Promise<void> => {
  if (image.complete) {
    return image.naturalWidth > 0
      ? Promise.resolve()
      : Promise.reject(new Error('PPTX image could not be loaded'));
  }

  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = (): void => {
      if (timer) clearTimeout(timer);
      image.removeEventListener('load', handleLoad);
      image.removeEventListener('error', handleError);
    };
    const finish = (error?: Error): void => {
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const handleLoad = (): void => {
      finish(image.naturalWidth > 0 ? undefined : new Error('PPTX image could not be loaded'));
    };
    const handleError = (): void => {
      finish(new Error('PPTX image could not be loaded'));
    };

    image.addEventListener('load', handleLoad, { once: true });
    image.addEventListener('error', handleError, { once: true });
    timer = setTimeout(() => finish(new Error('PPTX image loading timed out')), timeoutMs);

    // The image can finish between the initial check and listener registration.
    if (image.complete) handleLoad();
  });
};

export const waitForPptxImageReady = async (
  image: HTMLImageElement,
  timeoutMs: number = PptxThumbnailTiming.MediaReadyTimeoutMs,
): Promise<void> => {
  await waitForImageLoad(image, timeoutMs);
  if (typeof image.decode === 'function') {
    await withTimeout(
      image.decode(),
      timeoutMs,
      'PPTX image decoding timed out',
    ).catch(error => {
      throw new Error(
        error instanceof Error && error.message === 'PPTX image decoding timed out'
          ? error.message
          : 'PPTX image could not be decoded',
      );
    });
  }
  if (image.naturalWidth <= 0) throw new Error('PPTX image could not be decoded');
};

export const waitForPptxSlideReady = async (
  slide: HTMLElement,
  fontsReady: Promise<unknown> | undefined = document.fonts?.ready,
  timeoutMs: number = PptxThumbnailTiming.MediaReadyTimeoutMs,
): Promise<PptxSlideReadiness> => {
  if (fontsReady) await fontsReady;
  const images = Array.from(slide.querySelectorAll<HTMLImageElement>('img'));
  await Promise.all(images.map(image => waitForPptxImageReady(image, timeoutMs)));

  const visualElements = slide.querySelectorAll(
    'img, svg, canvas, video, table, .text-wrapper, .chart-node, .smart-chart-diagram',
  );
  const hasVisualContent = images.length > 0
    || Boolean(slide.textContent?.trim())
    || visualElements.length > 0;
  return {
    imageCount: images.length,
    decodedImageCount: images.length,
    hasVisualContent,
  };
};

const hasStableBounds = (left: DOMRect, right: DOMRect): boolean => (
  Math.abs(left.left - right.left) < 0.5
  && Math.abs(left.top - right.top) < 0.5
  && Math.abs(left.width - right.width) < 0.5
  && Math.abs(left.height - right.height) < 0.5
);

export const waitForPptxSlideLayout = async (
  slide: HTMLElement,
  nextFrame: NextFrame = nextAnimationFrame,
  maxFrames: number = PptxThumbnailTiming.StableLayoutMaxFrames,
): Promise<void> => {
  let previousBounds: DOMRect | undefined;
  let stableFrameCount = 0;

  for (let frame = 0; frame < maxFrames; frame += 1) {
    await nextFrame();
    const bounds = slide.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      previousBounds = undefined;
      stableFrameCount = 0;
      continue;
    }
    if (previousBounds && hasStableBounds(previousBounds, bounds)) {
      stableFrameCount += 1;
      if (stableFrameCount >= 2) return;
    } else {
      stableFrameCount = 0;
    }
    previousBounds = bounds;
  }

  throw new Error('PPTX slide layout did not stabilize');
};

export const renderPptxFirstSlide = async (
  pptxPreview: PptxPreviewModuleLike,
  root: HTMLElement,
  content: ArrayBuffer,
  width: number,
): Promise<PptxFirstSlideRender> => {
  const previewer = pptxPreview.init(root, { width, mode: 'list' });
  try {
    await previewer.load(content);
    if (previewer.slideCount <= 0) throw new Error('PPTX has no slides');

    previewer.renderSingleSlide(0);
    const slide = previewer.wrapper.querySelector<HTMLElement>('.pptx-preview-slide-wrapper-0')
      ?? previewer.wrapper.firstElementChild as HTMLElement | null;
    if (!slide) throw new Error('PPTX slide is unavailable');

    return {
      previewer,
      slide,
      slideCount: previewer.slideCount,
    };
  } catch (error) {
    previewer.destroy();
    throw error;
  }
};
