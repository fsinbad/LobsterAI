import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type {
  LibraryThumbnailRenderRequest,
  LibraryThumbnailRenderResult,
} from '../../shared/library/thumbnail';

type RenderResponseFactory = (
  request: LibraryThumbnailRenderRequest,
) => LibraryThumbnailRenderResult;

const electronMocks = vi.hoisted(() => {
  const renderResponses: RenderResponseFactory[] = [];
  const presentationFrames: Array<{
    getSize: () => { width: number; height: number };
    isEmpty: () => boolean;
    toBitmap: () => Buffer;
    toPNG: () => Buffer;
  }> = [];
  const windows: Array<{
    destroy: ReturnType<typeof vi.fn>;
    isDestroyed: () => boolean;
    webContents: {
      capturePage: ReturnType<typeof vi.fn>;
      beginFrameSubscription: ReturnType<typeof vi.fn>;
      endFrameSubscription: ReturnType<typeof vi.fn>;
      executeJavaScript: ReturnType<typeof vi.fn>;
      invalidate: ReturnType<typeof vi.fn>;
      isDestroyed: () => boolean;
      on: ReturnType<typeof vi.fn>;
      setWindowOpenHandler: ReturnType<typeof vi.fn>;
    };
  }> = [];

  const BrowserWindow = vi.fn(function FakeBrowserWindow() {
    let destroyed = false;
    let frameCallback: ((image: typeof presentationFrames[number]) => void) | undefined;
    const webContents = {
      beginFrameSubscription: vi.fn((
        _onlyDirty: boolean,
        callback: (image: typeof presentationFrames[number]) => void,
      ) => {
        frameCallback = callback;
      }),
      capturePage: vi.fn(),
      endFrameSubscription: vi.fn(),
      executeJavaScript: vi.fn((script: string) => {
        if (script.includes('typeof window.renderLibraryThumbnail')) return Promise.resolve(true);
        const prefix = 'window.renderLibraryThumbnail(';
        const request = JSON.parse(script.slice(prefix.length, -1)) as LibraryThumbnailRenderRequest;
        const response = renderResponses.shift();
        if (!response) throw new Error('Missing mocked thumbnail response');
        return Promise.resolve(response(request));
      }),
      invalidate: vi.fn(() => {
        const image = presentationFrames.shift();
        if (image) queueMicrotask(() => frameCallback?.(image));
      }),
      isDestroyed: () => destroyed,
      on: vi.fn(),
      setWindowOpenHandler: vi.fn(),
    };
    const instance = {
      destroy: vi.fn(() => { destroyed = true; }),
      getContentSize: () => [480, 270],
      isDestroyed: () => destroyed,
      loadFile: vi.fn(() => Promise.resolve()),
      loadURL: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      setContentSize: vi.fn(),
      setMenu: vi.fn(),
      webContents,
    };
    windows.push(instance);
    return instance;
  });

  return { BrowserWindow, presentationFrames, renderResponses, windows };
});

vi.mock('electron', () => ({ BrowserWindow: electronMocks.BrowserWindow }));

import { LibraryThumbnailRenderer } from './libraryThumbnailRenderer';

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01,
]);

let testDirectory: string;
let renderer: LibraryThumbnailRenderer | undefined;

beforeEach(async () => {
  electronMocks.renderResponses.length = 0;
  electronMocks.presentationFrames.length = 0;
  electronMocks.windows.length = 0;
  electronMocks.BrowserWindow.mockClear();
  testDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'library-thumbnail-renderer-'));
});

afterEach(async () => {
  renderer?.dispose();
  renderer = undefined;
  await fs.promises.rm(testDirectory, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const writeRasterFile = async (fileName = 'photo.png'): Promise<string> => {
  const filePath = path.join(testDirectory, fileName);
  await fs.promises.writeFile(filePath, Buffer.from('source-image'));
  return filePath;
};

const writeMarkdownFile = async (): Promise<string> => {
  const filePath = path.join(testDirectory, 'README.md');
  await fs.promises.writeFile(filePath, '# Current document');
  return filePath;
};

const createFrame = (png: Buffer) => ({
  getSize: () => ({ width: 480, height: 270 }),
  isEmpty: () => false,
  toBitmap: () => Buffer.alloc(480 * 270 * 4),
  toPNG: () => png,
});

const successfulDirectResponse = (
  request: LibraryThumbnailRenderRequest,
): LibraryThumbnailRenderResult => ({
  success: true,
  renderGeneration: request.renderGeneration,
  pngBase64: PNG_BYTES.toString('base64'),
  metrics: { renderDurationMs: 1 },
});

describe('LibraryThumbnailRenderer', () => {
  test('returns direct raster PNG output without capturing the shared window', async () => {
    electronMocks.renderResponses.push(successfulDirectResponse);
    renderer = new LibraryThumbnailRenderer({ productionHtmlPath: '/tmp/thumbnail.html' });

    const thumbnail = await renderer.render(await writeRasterFile(), { width: 480, height: 270 });

    expect(thumbnail).toEqual(PNG_BYTES);
    expect(electronMocks.windows).toHaveLength(1);
    expect(electronMocks.windows[0]?.webContents.capturePage).not.toHaveBeenCalled();
  });

  test('destroys the shared window and fully rerenders after a generation mismatch', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    electronMocks.renderResponses.push(
      request => ({
        success: true,
        renderGeneration: request.renderGeneration - 1,
        pngBase64: PNG_BYTES.toString('base64'),
        metrics: { renderDurationMs: 1 },
      }),
      successfulDirectResponse,
    );
    renderer = new LibraryThumbnailRenderer({ productionHtmlPath: '/tmp/thumbnail.html' });

    await expect(
      renderer.render(await writeRasterFile(), { width: 480, height: 270 }),
    ).resolves.toEqual(PNG_BYTES);

    expect(electronMocks.windows).toHaveLength(2);
    expect(electronMocks.windows[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith(
      '[LibraryThumbnail] Retrying render in a fresh window',
      expect.objectContaining({ extension: '.png', attempt: 1 }),
    );
  });

  test('uses the second presentation frame directly on Windows without capturePage', async () => {
    const previousFramePng = Buffer.from('previous-frame');
    electronMocks.presentationFrames.push(
      createFrame(previousFramePng),
      createFrame(PNG_BYTES),
    );
    electronMocks.renderResponses.push(request => ({
      success: true,
      renderGeneration: request.renderGeneration,
      metrics: { renderDurationMs: 1 },
    }));
    renderer = new LibraryThumbnailRenderer({
      platform: 'win32',
      presentationTimeoutMs: 50,
      productionHtmlPath: '/tmp/thumbnail.html',
    });

    await expect(
      renderer.render(await writeMarkdownFile(), { width: 480, height: 270 }),
    ).resolves.toEqual(PNG_BYTES);

    expect(electronMocks.windows[0]?.webContents.invalidate).toHaveBeenCalledTimes(2);
    expect(electronMocks.windows[0]?.webContents.capturePage).not.toHaveBeenCalled();
  });

  test('keeps alternating raster and document thumbnails bound to their own request', async () => {
    const documentPng = Buffer.concat([PNG_BYTES.subarray(0, 8), Buffer.from([0x02])]);
    const finalImagePng = Buffer.concat([PNG_BYTES.subarray(0, 8), Buffer.from([0x03])]);
    electronMocks.presentationFrames.push(
      createFrame(PNG_BYTES),
      createFrame(documentPng),
    );
    electronMocks.renderResponses.push(
      successfulDirectResponse,
      request => ({
        success: true,
        renderGeneration: request.renderGeneration,
        metrics: { renderDurationMs: 1 },
      }),
      request => ({
        success: true,
        renderGeneration: request.renderGeneration,
        pngBase64: finalImagePng.toString('base64'),
        metrics: { renderDurationMs: 1 },
      }),
    );
    renderer = new LibraryThumbnailRenderer({
      platform: 'win32',
      presentationTimeoutMs: 50,
      productionHtmlPath: '/tmp/thumbnail.html',
    });

    const firstImage = await renderer.render(
      await writeRasterFile('first.png'),
      { width: 480, height: 270 },
    );
    const document = await renderer.render(
      await writeMarkdownFile(),
      { width: 480, height: 270 },
    );
    const finalImage = await renderer.render(
      await writeRasterFile('final.png'),
      { width: 480, height: 270 },
    );

    expect([firstImage, document, finalImage]).toEqual([
      PNG_BYTES,
      documentPng,
      finalImagePng,
    ]);
    expect(electronMocks.windows).toHaveLength(1);
    expect(electronMocks.windows[0]?.webContents.capturePage).not.toHaveBeenCalled();
  });
});
