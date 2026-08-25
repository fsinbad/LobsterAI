import type { LocalArtifactItem } from '../../../shared/library/types';

export const LibraryItemAction = {
  ToggleFavorite: 'toggle_favorite',
  OpenWithApp: 'open_with_app',
  RevealLocal: 'reveal_local',
  RelatedSessions: 'related_sessions',
} as const;

export type LibraryItemAction =
  (typeof LibraryItemAction)[keyof typeof LibraryItemAction];

const LOCAL_ACTIONS = [
  LibraryItemAction.ToggleFavorite,
  LibraryItemAction.OpenWithApp,
  LibraryItemAction.RevealLocal,
] as const;

const PREVIEW_PROMOTED_ACTIONS = new Set<LibraryItemAction>([
  LibraryItemAction.ToggleFavorite,
]);

export const getLibraryCardActionIds = (_item: LocalArtifactItem): readonly LibraryItemAction[] => {
  return LOCAL_ACTIONS;
};

export const getLibraryPreviewActionIds = (item: LocalArtifactItem): readonly LibraryItemAction[] => {
  return getLibraryCardActionIds(item).filter(action => !PREVIEW_PROMOTED_ACTIONS.has(action));
};
