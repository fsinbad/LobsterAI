import { BrowserWindow, type NativeImage } from 'electron';
import fs from 'fs';
import path from 'path';

import {
  createLibraryThumbnailRenderRequest,
  isLibraryRasterThumbnailExtension,
  LibraryThumbnailLimits,
  type LibraryThumbnailRenderMetrics,
  type LibraryThumbnailRenderResult,
} from '../../shared/library/thumbnail';
import { waitForCommittedThumbnailPresentation } from './libraryThumbnailPresentation';
import { isLikelyBlankThumbnailBitmap } from './libraryThumbnailValidation';

interface ThumbnailSize {
  width: number;
  height: number;
}

interface LibraryThumbnailRendererOptions {
  developmentServerUrl?: string;
  productionHtmlPath: string;
  maxSourceBytes?: number;
  renderTimeoutMs?: number;
  captureTimeoutMs?: number;
  presentationTimeoutMs?: number;
  platform?: NodeJS.Platform;
}

const LIBRARY_THUMBNAIL_PARTITION = 'library-thumbnail-renderer';
const SLOW_RENDER_THRESHOLD_MS = 4_000;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const isRenderResult = (value: unknown): value is LibraryThumbnailRenderResult => (
  typeof value === 'object'
  && value !== null
  && typeof (value as LibraryThumbnailRenderResult).success === 'boolean'
);

export class LibraryThumbnailRenderer {
  private readonly developmentServerUrl?: string;
  private readonly productionHtmlPath: string;
  private readonly maxSourceBytes: number;
  private readonly renderTimeoutMs: number;
  private readonly captureTimeoutMs: number;
  private readonly presentationTimeoutMs: number;
  private readonly platform: NodeJS.Platform;
  private window?: BrowserWindow;
  private queueTail: Promise<void> = Promise.resolve();
  private renderGeneration = 0;

  constructor(options: LibraryThumbnailRendererOptions) {
    this.developmentServerUrl = options.developmentServerUrl;
    this.productionHtmlPath = options.productionHtmlPath;
    this.maxSourceBytes = options.maxSourceBytes ?? LibraryThumbnailLimits.MaxSourceBytes;
    this.renderTimeoutMs = options.renderTimeoutMs ?? LibraryThumbnailLimits.RenderTimeoutMs;
    this.captureTimeoutMs = options.captureTimeoutMs ?? LibraryThumbnailLimits.CaptureTimeoutMs;
    this.presentationTimeoutMs = options.presentationTimeoutMs
      ?? LibraryThumbnailLimits.PresentationTimeoutMs;
    this.platform = options.platform ?? process.platform;
  }

  render(filePath: string, size: ThumbnailSize): Promise<Buffer> {
    const task = this.queueTail.then(() => this.renderWithRecovery(filePath, size));
    this.queueTail = task.then(
      (): void => {},
      (): void => {},
    );
    return task;
  }

  dispose(): void {
    this.destroyCurrentWindow();
  }

  private async renderWithRecovery(filePath: string, size: ThumbnailSize): Promise<Buffer> {
    let lastError: unknown;
    const extension = path.extname(filePath).toLowerCase();
    for (let attempt = 1; attempt <= LibraryThumbnailLimits.MaxRenderAttempts; attempt += 1) {
      try {
        return await this.renderNow(filePath, size);
      } catch (error) {
        lastError = error;
        this.destroyCurrentWindow();
        if (attempt < LibraryThumbnailLimits.MaxRenderAttempts) {
          console.warn('[LibraryThumbnail] Retrying render in a fresh window', {
            extension,
            attempt,
            strategy: isLibraryRasterThumbnailExtension(extension)
              ? 'raster-canvas'
              : 'isolated-renderer',
          });
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Thumbnail rendering failed');
  }

  private async renderNow(filePath: string, size: ThumbnailSize): Promise<Buffer> {
    const stat = await fs.promises.stat(filePath);
    if (stat.size > this.maxSourceBytes) {
      throw new Error('File is too large for thumbnail rendering');
    }

    const content = await fs.promises.readFile(filePath);
    this.renderGeneration += 1;
    const request = createLibraryThumbnailRenderRequest(
      path.basename(filePath),
      content.toString('base64'),
      size.width,
      size.height,
      this.renderGeneration,
    );
    if (!request) throw new Error('Unsupported thumbnail format');

    const rendererWindow = await this.ensureWindow(size);
    const [currentWidth, currentHeight] = rendererWindow.getContentSize();
    if (currentWidth !== size.width || currentHeight !== size.height) {
      rendererWindow.setContentSize(size.width, size.height, false);
    }

    const script = `window.renderLibraryThumbnail(${JSON.stringify(request)})`;
    const result = await this.withTimeout(
      rendererWindow.webContents.executeJavaScript(script, true),
      this.renderTimeoutMs,
      'Thumbnail rendering timed out',
    );
    if (!isRenderResult(result)) {
      throw new Error('Invalid thumbnail renderer response');
    }
    if (result.renderGeneration !== request.renderGeneration) {
      throw new Error('Thumbnail renderer generation mismatch');
    }
    if (!result.success) {
      throw new Error(result.error || 'Thumbnail rendering failed');
    }
    if (result.metrics && result.metrics.renderDurationMs >= SLOW_RENDER_THRESHOLD_MS) {
      console.warn('[LibraryThumbnail] Slow renderer completion', {
        extension: request.extension,
        renderGeneration: request.renderGeneration,
        strategy: result.pngBase64 ? 'raster-canvas' : 'isolated-renderer',
        renderDurationMs: result.metrics.renderDurationMs,
        slideCount: result.metrics.slideCount,
        imageCount: result.metrics.imageCount,
      });
    }

    if (result.pngBase64 !== undefined) {
      if (!isLibraryRasterThumbnailExtension(request.extension)) {
        throw new Error('Unexpected direct thumbnail output');
      }
      return this.decodeDirectPng(result.pngBase64);
    }

    return this.captureRenderedPage(
      rendererWindow,
      size,
      request.extension,
      result.metrics,
    );
  }

  private async captureRenderedPage(
    rendererWindow: BrowserWindow,
    size: ThumbnailSize,
    extension: string,
    metrics?: LibraryThumbnailRenderMetrics,
  ): Promise<Buffer> {
    let image: NativeImage;
    if (this.platform === 'win32') {
      image = await waitForCommittedThumbnailPresentation(
        rendererWindow.webContents,
        this.presentationTimeoutMs,
      );
    } else {
      rendererWindow.webContents.invalidate();
      image = await this.withTimeout(
        rendererWindow.webContents.capturePage({
          x: 0,
          y: 0,
          width: size.width,
          height: size.height,
        }, {
          stayHidden: true,
          stayAwake: true,
        }),
        this.captureTimeoutMs,
        'Thumbnail capture timed out',
      );
    }
    const capturedSize = image.getSize();
    if (image.isEmpty() || capturedSize.width <= 0 || capturedSize.height <= 0) {
      throw new Error('Thumbnail capture is empty');
    }
    if (
      extension === '.pptx'
      && metrics?.hasVisualContent === true
      && isLikelyBlankThumbnailBitmap(image.toBitmap())
    ) {
      throw new Error('Thumbnail capture is visually blank');
    }
    const png = image.toPNG();
    if (png.length === 0) throw new Error('Thumbnail PNG is empty');
    return png;
  }

  private decodeDirectPng(pngBase64: string): Buffer {
    if (!pngBase64.trim()) throw new Error('Direct thumbnail output is empty');
    const png = Buffer.from(pngBase64, 'base64');
    if (png.length <= PNG_SIGNATURE.length || !png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
      throw new Error('Direct thumbnail output is not a PNG');
    }
    return png;
  }

  private async ensureWindow(size: ThumbnailSize): Promise<BrowserWindow> {
    if (this.window && !this.window.isDestroyed()) return this.window;

    const rendererWindow = new BrowserWindow({
      width: size.width,
      height: size.height,
      show: false,
      frame: false,
      transparent: false,
      backgroundColor: '#F5F6F8',
      paintWhenInitiallyHidden: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        partition: LIBRARY_THUMBNAIL_PARTITION,
        backgroundThrottling: false,
        devTools: false,
        spellcheck: false,
        enableWebSQL: false,
        disableDialogs: true,
        navigateOnDragDrop: false,
      },
    });
    rendererWindow.setMenu(null);
    rendererWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    rendererWindow.webContents.on('will-navigate', event => {
      event.preventDefault();
    });
    rendererWindow.webContents.on('render-process-gone', () => {
      this.resetWindow(rendererWindow);
    });
    rendererWindow.on('closed', () => {
      if (this.window === rendererWindow) this.window = undefined;
    });

    try {
      if (this.developmentServerUrl) {
        const rendererUrl = new URL('/library-thumbnail.html', this.developmentServerUrl);
        await rendererWindow.loadURL(rendererUrl.href);
      } else {
        await rendererWindow.loadFile(this.productionHtmlPath);
      }
      const isReady = await rendererWindow.webContents.executeJavaScript(
        'typeof window.renderLibraryThumbnail === "function"',
        true,
      );
      if (isReady !== true) throw new Error('Thumbnail renderer did not initialize');
      this.window = rendererWindow;
      return rendererWindow;
    } catch (error) {
      rendererWindow.destroy();
      throw error;
    }
  }

  private resetWindow(rendererWindow: BrowserWindow): void {
    if (!rendererWindow.isDestroyed()) rendererWindow.destroy();
    if (this.window === rendererWindow) this.window = undefined;
  }

  private destroyCurrentWindow(): void {
    const rendererWindow = this.window;
    this.window = undefined;
    if (rendererWindow && !rendererWindow.isDestroyed()) rendererWindow.destroy();
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string,
  ): Promise<T> {
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
  }
}
