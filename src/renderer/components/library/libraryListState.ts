import { LibraryChangeReason } from '../../../shared/library/constants';
import type {
  LibraryChangedPayload,
  LibraryItem,
  LibraryLocalListData,
} from '../../../shared/library/types';

const isSameLibraryItem = (
  left: Pick<LibraryItem, 'itemId' | 'itemKind'>,
  right: Pick<LibraryItem, 'itemId' | 'itemKind'>,
): boolean => left.itemId === right.itemId && left.itemKind === right.itemKind;

export const shouldReloadLibraryAfterChange = (
  payload: LibraryChangedPayload,
): boolean => payload.reason !== LibraryChangeReason.Favorite;

export const applyLibraryFavoriteState = <T extends LibraryItem>(
  items: T[],
  target: T,
  favorite: boolean,
  favoritesOnly: boolean,
): T[] => items.flatMap(item => {
  if (!isSameLibraryItem(item, target)) return [item];
  if (favoritesOnly && !favorite) return [];
  return [{ ...item, isFavorite: favorite } as T];
});

export const restoreLibraryFavoriteState = <T extends LibraryItem>(
  items: T[],
  target: T,
): T[] => {
  let found = false;
  const restored = items.map(item => {
    if (!isSameLibraryItem(item, target)) return item;
    found = true;
    return { ...item, isFavorite: target.isFavorite } as T;
  });
  return found ? restored : [...restored, target];
};

export const hideLibraryLocalItems = (
  data: LibraryLocalListData,
): LibraryLocalListData => ({
  list: [],
  hasMore: false,
  counts: data.counts,
});

export const sanitizeLibraryLocalListData = (
  data: LibraryLocalListData,
): { data: LibraryLocalListData; ignoredCount: number } => {
  const list = data.list.filter(item => (
    Boolean(item.latestSession) && item.relatedSessionCount > 0
  ));
  return {
    data: list.length === data.list.length ? data : { ...data, list },
    ignoredCount: data.list.length - list.length,
  };
};
