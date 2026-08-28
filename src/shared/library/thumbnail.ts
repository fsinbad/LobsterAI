import {
  getLibraryArtifactTypeForExtension,
  type LibraryArtifactType,
} from './constants';

export const LibraryThumbnailDimensions = {
  Width: 480,
  Height: 270,
} as const;

export const LibraryThumbnailLimits = {
  MaxSourceBytes: 64 * 1024 * 1024,
  RenderTimeoutMs: 12_000,
  CaptureTimeoutMs: 5_000,
  PresentationTimeoutMs: 1_500,
  MaxRenderAttempts: 2,
} as const;

export const LibraryRasterThumbnailExtensions = [
  '.avif',
  '.bmp',
  '.gif',
  '.jpeg',
  '.jpg',
  '.png',
  '.webp',
] as const;

const LIBRARY_RASTER_THUMBNAIL_EXTENSION_SET = new Set<string>(
  LibraryRasterThumbnailExtensions,
);

export const isLibraryRasterThumbnailExtension = (extension: string): boolean => (
  LIBRARY_RASTER_THUMBNAIL_EXTENSION_SET.has(extension.trim().toLowerCase())
);

export interface LibraryThumbnailRenderRequest {
  fileName: string;
  extension: string;
  artifactType: LibraryArtifactType;
  contentBase64: string;
  width: number;
  height: number;
  renderGeneration: number;
}

export interface LibraryThumbnailRenderResult {
  success: boolean;
  renderGeneration: number;
  pngBase64?: string;
  error?: string;
  metrics?: LibraryThumbnailRenderMetrics;
}

export interface LibraryThumbnailRenderMetrics {
  renderDurationMs: number;
  slideCount?: number;
  renderedSlideIndex?: number;
  imageCount?: number;
  decodedImageCount?: number;
  hasVisualContent?: boolean;
}

export const createLibraryThumbnailRenderRequest = (
  fileName: string,
  contentBase64: string,
  width: number = LibraryThumbnailDimensions.Width,
  height: number = LibraryThumbnailDimensions.Height,
  renderGeneration = 0,
): LibraryThumbnailRenderRequest | null => {
  const dotIndex = fileName.lastIndexOf('.');
  const extension = dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';
  const artifactType = getLibraryArtifactTypeForExtension(extension);
  if (!artifactType) return null;
  return {
    fileName,
    extension,
    artifactType,
    contentBase64,
    width,
    height,
    renderGeneration,
  };
};
