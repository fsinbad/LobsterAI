import { describe, expect, test } from 'vitest';

import { isLikelyBlankThumbnailBitmap } from './libraryThumbnailValidation';

const createBitmap = (
  pixelCount: number,
  colorAt: (index: number) => [number, number, number, number],
): Uint8Array => {
  const bitmap = new Uint8Array(pixelCount * 4);
  for (let index = 0; index < pixelCount; index += 1) {
    const [blue, green, red, alpha] = colorAt(index);
    bitmap.set([blue, green, red, alpha], index * 4);
  }
  return bitmap;
};

describe('library thumbnail visual validation', () => {
  test('identifies an all-white bitmap as blank', () => {
    const bitmap = createBitmap(1_000, () => [255, 255, 255, 255]);

    expect(isLikelyBlankThumbnailBitmap(bitmap)).toBe(true);
  });

  test('identifies a white slide with a light gray border as blank', () => {
    const bitmap = createBitmap(1_000, index => (
      index < 100 ? [245, 245, 245, 255] : [255, 255, 255, 255]
    ));

    expect(isLikelyBlankThumbnailBitmap(bitmap)).toBe(true);
  });

  test('keeps a light slide containing visible dark content', () => {
    const bitmap = createBitmap(1_000, index => (
      index < 20 ? [40, 40, 40, 255] : [255, 255, 255, 255]
    ));

    expect(isLikelyBlankThumbnailBitmap(bitmap)).toBe(false);
  });

  test('identifies a transparent bitmap as blank', () => {
    const bitmap = createBitmap(100, () => [0, 0, 0, 0]);

    expect(isLikelyBlankThumbnailBitmap(bitmap)).toBe(true);
  });
});
