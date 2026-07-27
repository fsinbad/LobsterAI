export const MediaSelectionMode = {
  Auto: 'auto',
  Image: 'image',
  Video: 'video',
  None: 'none',
} as const;
export type MediaSelectionMode = typeof MediaSelectionMode[keyof typeof MediaSelectionMode];

export type MediaSelectionState = {
  mode: MediaSelectionMode;
  modelId?: string;
  modelName?: string;
  imageModelId?: string;
  videoModelId?: string;
};
