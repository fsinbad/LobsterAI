import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ChatBubbleLeftRightIcon,
  DocumentIcon,
  FolderIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  StarIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  LibraryCategory,
  LibraryChangeReason,
  LibraryFavoriteScope,
  LibraryLimits,
  LibraryViewMode,
} from '../../../shared/library/constants';
import type {
  LibraryLocalDetailData,
  LibraryLocalListData,
  LibrarySessionRef,
  LocalArtifactItem,
} from '../../../shared/library/types';
import { i18nService } from '../../services/i18n';
import { startLibraryBackfill } from '../../services/libraryBackfill';
import CardOverflowMenu, { type CardOverflowMenuItem } from '../common/CardOverflowMenu';
import {
  MANAGEMENT_BODY_TEXT,
  MANAGEMENT_META_TEXT,
  MANAGEMENT_PAGE_TITLE_TEXT,
  MANAGEMENT_TITLE_TEXT,
} from '../common/managementTypography';
import FileTypeIcon from '../icons/fileTypes/FileTypeIcon';
import SidebarToggleIcon from '../icons/SidebarToggleIcon';
import Tooltip, { TooltipAlign, TooltipPosition } from '../ui/Tooltip';
import { LIBRARY_ACTION_MENU_WIDTH_PX } from './libraryActionMenuPresentation';
import LibraryCategoryDropdown from './LibraryCategoryDropdown';
import {
  formatLibraryDateGroupTitle,
  groupLibraryItemsByDateAndSession,
} from './libraryDateGrouping';
import {
  getLibraryCardActionIds,
  getLibraryPreviewActionIds,
  LibraryItemAction,
  type LibraryItemAction as LibraryItemActionValue,
} from './libraryItemActionPolicy';
import {
  formatLibraryTime,
  getLibraryDisplayFileName,
  getLibraryItemStatus,
  getLibrarySourceLabel,
} from './libraryItemPresentation';
import {
  applyLibraryFavoriteState,
  restoreLibraryFavoriteState,
  sanitizeLibraryLocalListData,
} from './libraryListState';
import {
  applyLibraryLocalItemChanges,
  LibraryLoadIntent,
  LibraryLoadPhase,
  shouldShowLibraryInitialSkeleton,
} from './libraryLocalQueryState';
import LibraryPreviewModal from './LibraryPreviewModal';
import {
  type LibraryRefreshBatch,
  LibraryRefreshCoordinator,
} from './libraryRefreshCoordinator';
import {
  createLibraryThumbnailCacheKey,
  getCachedLibraryThumbnail,
  loadLibraryThumbnail,
} from './libraryThumbnailCache';

interface LibraryViewProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenSession: (session: LibrarySessionRef) => void;
  updateBadge?: React.ReactNode;
}

interface LibrarySessionGroup {
  key: string;
  title: string;
  sortTime: number;
  session?: LibrarySessionRef;
  items: LocalArtifactItem[];
}

interface LibraryDateGroup {
  key: string;
  title: string;
  sessionGroups: LibrarySessionGroup[];
}

const CardDetailLoadStatus = {
  Loading: 'loading',
  Ready: 'ready',
  Error: 'error',
} as const;

type CardDetailLoadState =
  | { status: typeof CardDetailLoadStatus.Loading }
  | { status: typeof CardDetailLoadStatus.Ready; data: LibraryLocalDetailData }
  | { status: typeof CardDetailLoadStatus.Error };

const LIBRARY_GRID_CLASSNAME = 'grid justify-start gap-3';
const LIBRARY_GRID_STYLE: React.CSSProperties = {
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 264px))',
};

const EMPTY_LOCAL: LibraryLocalListData = {
  list: [],
  hasMore: false,
  counts: { total: 0, available: 0, missing: 0 },
};

const appendUniqueItems = <T extends LocalArtifactItem>(current: T[], next: T[]): T[] => {
  const items = new Map(current.map(item => [item.itemId, item]));
  for (const item of next) items.set(item.itemId, item);
  return [...items.values()];
};

const CATEGORY_FILTERS = [
  LibraryCategory.All,
  LibraryCategory.Slides,
  LibraryCategory.Web,
  LibraryCategory.Document,
  LibraryCategory.Spreadsheet,
  LibraryCategory.Image,
  LibraryCategory.Media,
  LibraryCategory.Other,
] as const;

const getLibrarySessionKey = (item: LocalArtifactItem): string => (
  `session:${item.latestSession.sessionId}`
);

const formatLibrarySessionTime = (value: number): string => new Intl.DateTimeFormat(
  i18nService.getLanguage() === 'zh' ? 'zh-CN' : 'en-US',
  { hour: '2-digit', minute: '2-digit' },
).format(new Date(value));

const LibraryThumbnail: React.FC<{ item: LocalArtifactItem }> = ({ item }) => {
  const localItem = item.availability === 'available' ? item : undefined;
  const cacheKey = localItem
    ? createLibraryThumbnailCacheKey(localItem.filePath, localItem.fileMtimeMs)
    : undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | undefined>(() => (
    cacheKey ? getCachedLibraryThumbnail(cacheKey) : undefined
  ));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setIsNearViewport(true);
      return undefined;
    }

    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      setIsNearViewport(true);
      observer.disconnect();
    }, { rootMargin: '240px' });
    observer.observe(container);
    return () => observer.disconnect();
  }, [cacheKey]);

  useEffect(() => {
    let active = true;
    const cached = cacheKey ? getCachedLibraryThumbnail(cacheKey) : undefined;
    setDataUrl(cached);
    if (!localItem || !cacheKey || !isNearViewport || cached) {
      return () => { active = false; };
    }

    void loadLibraryThumbnail(cacheKey, async () => {
      const result = await window.electron.dialog.generateThumbnail(localItem.filePath);
      return result.success ? result.dataUrl : undefined;
    }).then(value => {
      if (active && value) setDataUrl(value);
    });
    return () => { active = false; };
  }, [cacheKey, isNearViewport, localItem]);

  return (
    <div ref={containerRef} className="h-full w-full">
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={item.title}
          className="h-full w-full bg-surface-raised object-contain"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-surface-raised text-secondary">
          {item.category === LibraryCategory.Web ? (
            <FileTypeIcon
              fileName={getLibraryDisplayFileName(item)}
              className="h-6 w-6"
            />
          ) : (
            <DocumentIcon className="h-6 w-6" aria-hidden="true" />
          )}
        </div>
      )}
    </div>
  );
};

const LibraryListItemIcon: React.FC<{ item: LocalArtifactItem }> = ({ item }) => (
  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-raised">
    <FileTypeIcon fileName={getLibraryDisplayFileName(item)} className="h-[18px] w-[18px]" />
  </div>
);

const LibraryItemCard: React.FC<{
  item: LocalArtifactItem;
  viewMode: LibraryViewMode;
  onOpen: () => void;
  onMenuOpen?: () => void;
  menuItems: CardOverflowMenuItem[];
}> = ({ item, viewMode, onOpen, onMenuOpen, menuItems }) => {
  const list = viewMode === LibraryViewMode.List;
  if (list) {
    return (
      <article
        data-library-item-key={`${item.itemKind}:${item.itemId}`}
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={event => {
          if (event.key === 'Enter' && event.currentTarget === event.target) onOpen();
        }}
        className="group flex min-h-14 items-center gap-3 px-2 py-2 transition-colors hover:bg-surface-raised/60 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/30"
      >
        <LibraryListItemIcon item={item} />
        <h3 className={`min-w-0 flex-1 truncate ${MANAGEMENT_BODY_TEXT} font-medium leading-5 text-foreground`}>
          {item.title}
        </h3>
        <div className="ml-auto flex shrink-0 items-center">
          <CardOverflowMenu
            items={menuItems}
            menuWidthPx={LIBRARY_ACTION_MENU_WIDTH_PX}
            onOpen={onMenuOpen}
            className="!h-8 !w-8 text-tertiary hover:bg-surface hover:text-foreground"
          />
        </div>
      </article>
    );
  }

  return (
    <article
      data-library-item-key={`${item.itemKind}:${item.itemId}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={event => {
        if (event.key === 'Enter' && event.currentTarget === event.target) onOpen();
      }}
      className="group relative overflow-hidden rounded-xl border border-border bg-surface p-2.5 transition-colors hover:border-primary/35 hover:bg-surface-raised focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      <div className="aspect-video w-full shrink-0 overflow-hidden rounded-lg border border-border">
        <LibraryThumbnail item={item} />
      </div>
      <div className="min-w-0 pt-2 pr-10">
        <h3 className={`line-clamp-2 ${MANAGEMENT_BODY_TEXT} font-medium leading-5 text-foreground`}>
          {item.title}
        </h3>
        <div className={`mt-1 flex min-w-0 items-center gap-1.5 ${MANAGEMENT_META_TEXT} leading-[var(--lobster-leading-xs)] text-secondary`}>
          <span className="truncate">{getLibrarySourceLabel()}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{getLibraryItemStatus(item)}</span>
        </div>
        <div className={`${MANAGEMENT_META_TEXT} mt-1 leading-[var(--lobster-leading-xs)] text-tertiary`}>
          {formatLibraryTime(item.sortTime)}
        </div>
      </div>
      <div className="absolute right-2 top-2">
        <CardOverflowMenu
          items={menuItems}
          menuWidthPx={LIBRARY_ACTION_MENU_WIDTH_PX}
          onOpen={onMenuOpen}
          className="!h-8 !w-8 bg-background/85 text-secondary hover:bg-background hover:text-foreground"
        />
      </div>
    </article>
  );
};

const LibraryViewContent: React.FC<LibraryViewProps> = ({
  isSidebarCollapsed,
  onToggleSidebar,
  onOpenSession,
  updateBadge,
}) => {
  const [category, setCategory] = useState<LibraryCategory>(LibraryCategory.All);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [viewMode, setViewMode] = useState<LibraryViewMode>(LibraryViewMode.List);
  const [localData, setLocalData] = useState<LibraryLocalListData>(EMPTY_LOCAL);
  const [loadPhase, setLoadPhase] = useState<LibraryLoadPhase>(LibraryLoadPhase.Initial);
  const [resolvedQueryKey, setResolvedQueryKey] = useState('');
  const [error, setError] = useState<string>();
  const [activeItem, setActiveItem] = useState<LocalArtifactItem>();
  const [localDetail, setLocalDetail] = useState<LibraryLocalDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cardDetailStates, setCardDetailStates] = useState<Record<string, CardDetailLoadState>>({});
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const localDataRef = useRef(localData);
  const localQueryKeyRef = useRef('');
  const currentQueryKeyRef = useRef('');
  const pendingScrollAnchorRef = useRef<{
    candidates: Array<{ itemKey: string; offsetTop: number }>;
  } | undefined>(undefined);
  const refreshCoordinatorRef = useRef<LibraryRefreshCoordinator | undefined>(undefined);
  const refreshBatchHandlerRef = useRef<(batch: LibraryRefreshBatch) => Promise<void>>(
    async () => undefined,
  );
  const refreshLocalWindowRef = useRef<() => Promise<void>>(async () => undefined);
  const cardDetailRequestIdsRef = useRef(new Set<string>());
  const scrollContainerRef = useRef<HTMLElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const localSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localDataRef.current = localData;
  }, [localData]);

  useEffect(() => {
    const timer = window.setTimeout(() => setKeyword(keywordInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [keywordInput]);

  const hasActiveLocalFilter = category !== LibraryCategory.All
    || keyword.length > 0
    || favoritesOnly;
  const localQueryKey = useMemo(() => JSON.stringify({
    category,
    keyword,
    favoritesOnly,
  }), [category, favoritesOnly, keyword]);
  localQueryKeyRef.current = localQueryKey;
  currentQueryKeyRef.current = localQueryKey;
  const loading = shouldShowLibraryInitialSkeleton(
    loadPhase,
    resolvedQueryKey === localQueryKey,
  );
  const loadingMore = loadPhase === LibraryLoadPhase.Appending;

  const captureScrollAnchor = useCallback((): void => {
    const root = scrollContainerRef.current;
    if (!root) return;
    const rootTop = root.getBoundingClientRect().top;
    const candidates: Array<{ itemKey: string; offsetTop: number }> = [];
    for (const element of root.querySelectorAll<HTMLElement>('[data-library-item-key]')) {
      const rect = element.getBoundingClientRect();
      if (rect.bottom < rootTop || !element.dataset.libraryItemKey) continue;
      candidates.push({
        itemKey: element.dataset.libraryItemKey,
        offsetTop: rect.top - rootTop,
      });
      if (candidates.length >= 8) break;
    }
    if (candidates.length === 0) return;
    pendingScrollAnchorRef.current = {
      candidates,
    };
  }, []);

  useLayoutEffect(() => {
    const anchor = pendingScrollAnchorRef.current;
    const root = scrollContainerRef.current;
    if (!anchor || !root) return;
    pendingScrollAnchorRef.current = undefined;
    const elementsByKey = new Map(
      [...root.querySelectorAll<HTMLElement>('[data-library-item-key]')]
        .flatMap(element => element.dataset.libraryItemKey
          ? [[element.dataset.libraryItemKey, element] as const]
          : []),
    );
    const survivingAnchor = anchor.candidates.find(candidate => (
      elementsByKey.has(candidate.itemKey)
    ));
    if (!survivingAnchor) return;
    const anchoredElement = elementsByKey.get(survivingAnchor.itemKey);
    if (!anchoredElement) return;
    const nextOffset = anchoredElement.getBoundingClientRect().top
      - root.getBoundingClientRect().top;
    root.scrollTop += nextOffset - survivingAnchor.offsetTop;
  }, [localData.list]);

  const clearKeyword = useCallback(() => {
    setKeywordInput('');
    setKeyword('');
  }, []);

  const handleCategoryChange = (nextCategory: LibraryCategory): void => {
    if (nextCategory === category) return;
    setCategory(nextCategory);
  };

  const handleFavoritesOnlyToggle = (): void => {
    setFavoritesOnly(current => !current);
  };

  const handleViewModeChange = (nextViewMode: LibraryViewMode): void => {
    if (nextViewMode === viewMode) return;
    setViewMode(nextViewMode);
  };

  const loadData = useCallback(async (
    intent: LibraryLoadIntent = LibraryLoadIntent.Initial,
  ) => {
    const append = intent === LibraryLoadIntent.Append;
    const requestId = ++requestIdRef.current;
    const requestQueryKey = localQueryKey;
    setLoadPhase(append
      ? LibraryLoadPhase.Appending
      : intent === LibraryLoadIntent.Refresh
        ? LibraryLoadPhase.Refreshing
        : LibraryLoadPhase.Initial);
    if (!append) {
      setError(undefined);
    }
    try {
      const result = await window.electron.library.listLocal({
        category,
        keyword,
        favoritesOnly,
        pageSize: LibraryLimits.DefaultPageSize,
        ...(append && localData.nextCursor ? { cursor: localData.nextCursor } : {}),
      });
      if (requestId !== requestIdRef.current) return;
      if (result.success) {
        const sanitizedResult = sanitizeLibraryLocalListData(result.data);
        if (sanitizedResult.ignoredCount > 0) {
          console.warn(
            '[Library] Ignored local artifacts without a valid task relation.',
            { count: sanitizedResult.ignoredCount },
          );
        }
        setLocalData(current => {
          if (append) {
            return {
              ...sanitizedResult.data,
              list: appendUniqueItems(current.list, sanitizedResult.data.list),
            };
          }
          return sanitizedResult.data;
        });
      } else {
        setError(result.error);
      }
    } catch (loadError) {
      if (requestId === requestIdRef.current) {
        setError(loadError instanceof Error ? loadError.message : i18nService.t('unknownError'));
      }
    }
    if (requestId !== requestIdRef.current) return;
    if (intent === LibraryLoadIntent.Initial) setResolvedQueryKey(requestQueryKey);
    setLoadPhase(LibraryLoadPhase.Settled);
  }, [
    category,
    favoritesOnly,
    keyword,
    localData.nextCursor,
    localQueryKey,
  ]);

  const refreshLocalWindow = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) return;
    const requestId = ++requestIdRef.current;
    const requestQueryKey = localQueryKey;
    const desiredItemCount = Math.max(
      localDataRef.current.list.length,
      LibraryLimits.DefaultPageSize,
    );
    setLoadPhase(LibraryLoadPhase.Refreshing);
    setError(undefined);
    try {
      let cursor: string | undefined;
      let hasMore = true;
      let counts = localDataRef.current.counts;
      let list: LocalArtifactItem[] = [];
      do {
        const result = await window.electron.library.listLocal({
          category,
          keyword,
          favoritesOnly,
          pageSize: Math.min(
            LibraryLimits.MaxPageSize,
            Math.max(1, desiredItemCount - list.length),
          ),
          ...(cursor ? { cursor } : {}),
        });
        if (
          requestId !== requestIdRef.current
          || !mountedRef.current
          || requestQueryKey !== currentQueryKeyRef.current
        ) {
          return;
        }
        if (!result.success) throw new Error(result.error);
        const sanitizedResult = sanitizeLibraryLocalListData(result.data);
        if (sanitizedResult.ignoredCount > 0) {
          console.warn(
            '[Library] Ignored local artifacts without a valid task relation.',
            { count: sanitizedResult.ignoredCount },
          );
        }
        list = appendUniqueItems(list, sanitizedResult.data.list);
        counts = sanitizedResult.data.counts;
        hasMore = sanitizedResult.data.hasMore;
        cursor = sanitizedResult.data.nextCursor;
      } while (hasMore && cursor && list.length < desiredItemCount);

      const nextData: LibraryLocalListData = {
        list,
        counts,
        hasMore,
        ...(hasMore && cursor ? { nextCursor: cursor } : {}),
      };
      captureScrollAnchor();
      localDataRef.current = nextData;
      setLocalData(nextData);
      setResolvedQueryKey(requestQueryKey);
    } catch (refreshError) {
      if (
        requestId === requestIdRef.current
        && mountedRef.current
        && requestQueryKey === currentQueryKeyRef.current
      ) {
        setError(
          refreshError instanceof Error
            ? refreshError.message
            : i18nService.t('unknownError'),
        );
      }
    } finally {
      if (
        requestId === requestIdRef.current
        && mountedRef.current
        && requestQueryKey === currentQueryKeyRef.current
      ) {
        setLoadPhase(LibraryLoadPhase.Settled);
      }
    }
  }, [
    captureScrollAnchor,
    category,
    favoritesOnly,
    keyword,
    localQueryKey,
  ]);
  refreshLocalWindowRef.current = refreshLocalWindow;

  const handleRefresh = useCallback((): void => {
    const coordinator = refreshCoordinatorRef.current;
    if (coordinator) {
      coordinator.enqueue({ reason: LibraryChangeReason.Repair });
      coordinator.flushNow();
    } else {
      void refreshLocalWindow();
    }
  }, [refreshLocalWindow]);

  useEffect(() => {
    void loadData(LibraryLoadIntent.Initial);
  // Cursor changes are outputs of this request and must not trigger a new first page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    category,
    favoritesOnly,
    keyword,
  ]);

  refreshBatchHandlerRef.current = async batch => {
    if (!mountedRef.current) return;
    if (batch.requiresAuthoritativeRefresh || batch.itemIds.length === 0) {
      await refreshLocalWindowRef.current();
      return;
    }
    const requestQueryKey = currentQueryKeyRef.current;
    const requestLocalQueryKey = localQueryKeyRef.current;
    setLoadPhase(LibraryLoadPhase.Refreshing);
    try {
      const items: LocalArtifactItem[] = [];
      const unavailableItemIds: string[] = [];
      for (
        let index = 0;
        index < batch.itemIds.length;
        index += LibraryLimits.MaxTargetItemIds
      ) {
        const result = await window.electron.library.getLocalItems({
          itemIds: batch.itemIds.slice(index, index + LibraryLimits.MaxTargetItemIds),
        });
        if (!result.success) throw new Error(result.error);
        items.push(...result.data.items);
        unavailableItemIds.push(...result.data.unavailableItemIds);
      }
      if (
        requestQueryKey !== currentQueryKeyRef.current
        || !mountedRef.current
        || requestLocalQueryKey !== localQueryKeyRef.current
      ) {
        return;
      }
      const applied = applyLibraryLocalItemChanges(
        localDataRef.current,
        { items, unavailableItemIds },
        { category, keyword, favoritesOnly },
      );
      captureScrollAnchor();
      localDataRef.current = applied.data;
      setLocalData(applied.data);
      setActiveItem(current => {
        if (!current) return current;
        return items.find(item => item.itemId === current.itemId) ?? current;
      });
      if (applied.requiresAuthoritativeRefresh) {
        console.warn('[LibraryRefresh] Targeted merge exceeded the local window; revalidating.');
        await refreshLocalWindowRef.current();
      }
    } catch (refreshError) {
      console.warn(
        '[LibraryRefresh] Targeted refresh failed; revalidating the loaded window.',
        refreshError,
      );
      await refreshLocalWindowRef.current();
    } finally {
      if (
        mountedRef.current
        && requestQueryKey === currentQueryKeyRef.current
      ) {
        setLoadPhase(LibraryLoadPhase.Settled);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    const coordinator = new LibraryRefreshCoordinator({
      onFlush: batch => refreshBatchHandlerRef.current(batch),
      onError: refreshError => {
        console.warn('[LibraryRefresh] Refresh coordinator failed.', refreshError);
      },
    });
    refreshCoordinatorRef.current = coordinator;
    const unsubscribe = window.electron.library.onChanged(payload => coordinator.enqueue(payload));
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      unsubscribe();
      coordinator.dispose();
      if (refreshCoordinatorRef.current === coordinator) {
        refreshCoordinatorRef.current = undefined;
      }
    };
  }, []);

  useEffect(() => {
    refreshCoordinatorRef.current?.setActive(
      loadPhase === LibraryLoadPhase.Settled,
    );
  }, [loadPhase]);

  useEffect(() => {
    void startLibraryBackfill();
  }, []);

  useEffect(() => {
    let active = true;
    setLocalDetail(null);
    const hasRelatedSessionsAction = activeItem
      ? getLibraryPreviewActionIds(activeItem).includes(LibraryItemAction.RelatedSessions)
      : false;
    if (!activeItem || !hasRelatedSessionsAction) {
      setDetailLoading(false);
      return () => { active = false; };
    }
    setDetailLoading(true);
    void window.electron.library.getLocalDetail(activeItem.itemId).then(result => {
      if (active && result.success) setLocalDetail(result.data);
      if (active) setDetailLoading(false);
    });
    return () => { active = false; };
  }, [activeItem]);

  const items = useMemo(() => (
    [...localData.list].sort((left, right) => (
      right.sortTime - left.sortTime
      || right.itemId.localeCompare(left.itemId)
    ))
  ), [localData.list]);

  const dateGroups = useMemo<LibraryDateGroup[]>(() => {
    const now = Date.now();
    const locale = i18nService.getLanguage() === 'zh' ? 'zh-CN' : 'en-US';
    return groupLibraryItemsByDateAndSession(
      items,
      item => item.sortTime,
      getLibrarySessionKey,
    ).map(dateBucket => {
      const sessionGroups = dateBucket.sessionBuckets.map(sessionBucket => {
        const firstItem = sessionBucket.items[0];
        const session = firstItem.latestSession;
        return {
          key: `${dateBucket.dateKey}:${sessionBucket.sessionKey}`,
          title: session?.title ?? i18nService.t('libraryUnlinkedSession'),
          sortTime: sessionBucket.representativeTime,
          ...(session ? { session } : {}),
          items: sessionBucket.items,
        };
      });
      return {
        key: dateBucket.dateKey,
        title: formatLibraryDateGroupTitle(dateBucket.representativeTime, {
          locale,
          todayLabel: i18nService.t('libraryTime_today'),
          yesterdayLabel: i18nService.t('libraryTime_yesterday'),
          now,
        }),
        sessionGroups,
      };
    });
  }, [items]);

  const updateFavorite = async (item: LocalArtifactItem): Promise<void> => {
    const next = !item.isFavorite;
    setLocalData(current => ({
      ...current,
      list: applyLibraryFavoriteState(current.list, item, next, favoritesOnly),
    }));
    setActiveItem(current => current?.itemId === item.itemId
      ? { ...current, isFavorite: next } : current);
    const result = await window.electron.library.setFavorite({
      ownerScope: LibraryFavoriteScope.LocalDevice,
      itemKind: item.itemKind,
      itemId: item.itemId,
      favorite: next,
    });
    if (!result.success) {
      setError(result.error);
      setLocalData(current => ({
        ...current,
        list: restoreLibraryFavoriteState(current.list, item),
      }));
      setActiveItem(current => current?.itemId === item.itemId
        ? { ...current, isFavorite: item.isFavorite } : current);
    }
  };

  const openItem = (item: LocalArtifactItem): void => {
    setActiveItem(item);
  };

  const openLocalWithApp = (item: LocalArtifactItem): void => {
    void window.electron.library.openLocal(item.itemId).then(result => {
      if (!result.success) setError(result.error);
    });
  };

  const revealLocal = (item: LocalArtifactItem): void => {
    void window.electron.library.revealLocal(item.itemId).then(result => {
      if (!result.success) setError(result.error);
    });
  };

  const loadCardDetail = (item: LocalArtifactItem): void => {
    const knownSessionCount = item.latestSession ? 1 : 0;
    if (
      item.relatedSessionCount <= knownSessionCount
      || cardDetailStates[item.itemId]
      || cardDetailRequestIdsRef.current.has(item.itemId)
    ) {
      return;
    }
    cardDetailRequestIdsRef.current.add(item.itemId);
    setCardDetailStates(current => ({
      ...current,
      [item.itemId]: { status: CardDetailLoadStatus.Loading },
    }));
    void window.electron.library.getLocalDetail(item.itemId).then(result => {
      if (result.success) {
        setCardDetailStates(current => ({
          ...current,
          [item.itemId]: { status: CardDetailLoadStatus.Ready, data: result.data },
        }));
      } else {
        setCardDetailStates(current => ({
          ...current,
          [item.itemId]: { status: CardDetailLoadStatus.Error },
        }));
      }
    }).catch(() => {
      setCardDetailStates(current => ({
        ...current,
        [item.itemId]: { status: CardDetailLoadStatus.Error },
      }));
    }).finally(() => {
      cardDetailRequestIdsRef.current.delete(item.itemId);
    });
  };

  const getRelatedSessionMenuItems = (item: LocalArtifactItem): CardOverflowMenuItem[] => {
    const detailState = cardDetailStates[item.itemId];
    const sessions = detailState?.status === CardDetailLoadStatus.Ready
      ? detailState.data.sessions
      : item.latestSession
        ? [item.latestSession]
        : [];
    const uniqueSessions = [...new Map(
      sessions.map(session => [session.sessionId, session]),
    ).values()];
    const menuItems: CardOverflowMenuItem[] = uniqueSessions.map(session => ({
      key: `session:${session.sessionId}`,
      label: session.title,
      onSelect: () => onOpenSession(session),
    }));
    const expectedCount = item.relatedSessionCount;
    if (
      detailState?.status !== CardDetailLoadStatus.Ready
      && detailState?.status !== CardDetailLoadStatus.Error
      && expectedCount > uniqueSessions.length
    ) {
      menuItems.push({
        key: 'sessions-loading',
        label: i18nService.t('loading'),
        disabled: true,
      });
    } else if (
      detailState?.status === CardDetailLoadStatus.Ready
      && menuItems.length === 0
    ) {
      menuItems.push({
        key: 'sessions-empty',
        label: i18nService.t('libraryRelatedSessionsUnavailable'),
        disabled: true,
      });
    } else if (
      detailState?.status === CardDetailLoadStatus.Error
      && menuItems.length === 0
    ) {
      menuItems.push({
        key: 'sessions-unavailable',
        label: i18nService.t('libraryRelatedSessionsUnavailable'),
        disabled: true,
      });
    }
    return menuItems;
  };

  const getCardActionLabel = (
    item: LocalArtifactItem,
    action: LibraryItemActionValue,
  ): string => {
    if (action === LibraryItemAction.ToggleFavorite) {
      return item.isFavorite
        ? i18nService.t('libraryRemoveFavorite')
        : i18nService.t('libraryAddFavorite');
    }
    if (action === LibraryItemAction.OpenWithApp) return i18nService.t('libraryOpenWithApp');
    if (action === LibraryItemAction.RevealLocal) return i18nService.t('libraryRevealFile');
    if (action === LibraryItemAction.RelatedSessions) {
      return i18nService.t('libraryRelatedSessions');
    }
    return i18nService.t('libraryOpenLink');
  };

  const getCardActionIcon = (
    item: LocalArtifactItem,
    action: LibraryItemActionValue,
  ): React.ReactNode => {
    if (action === LibraryItemAction.ToggleFavorite) {
      return item.isFavorite
        ? <StarSolidIcon className="h-4 w-4 text-amber-500" />
        : <StarIcon className="h-4 w-4" />;
    }
    if (action === LibraryItemAction.RelatedSessions) {
      return <ChatBubbleLeftRightIcon className="h-4 w-4" />;
    }
    if (action === LibraryItemAction.RevealLocal) return <FolderIcon className="h-4 w-4" />;
    return <ArrowTopRightOnSquareIcon className="h-4 w-4" />;
  };

  const buildCardMenuItems = (item: LocalArtifactItem): CardOverflowMenuItem[] => (
    getLibraryCardActionIds(item).map(action => ({
      key: action,
      label: getCardActionLabel(item, action),
      icon: getCardActionIcon(item, action),
      ...(action === LibraryItemAction.RelatedSessions
        ? {
            children: getRelatedSessionMenuItems(item),
            trailing: (
              <span className="text-tertiary">{item.relatedSessionCount}</span>
            ),
          }
        : {}),
      onSelect: () => {
        if (action === LibraryItemAction.ToggleFavorite) {
          void updateFavorite(item);
          return;
        }
        if (action === LibraryItemAction.OpenWithApp) openLocalWithApp(item);
        else if (action === LibraryItemAction.RevealLocal) revealLocal(item);
      },
    }))
  );

  const hasMore = localData.hasMore;

  useEffect(() => {
    const root = scrollContainerRef.current;
    const sentinel = loadMoreSentinelRef.current;
    if (
      !root
      || !sentinel
      || loading
      || loadingMore
      || !hasMore
      || error
      || typeof IntersectionObserver === 'undefined'
    ) {
      return undefined;
    }

    let requested = false;
    const observer = new IntersectionObserver(entries => {
      if (requested || !entries.some(entry => entry.isIntersecting)) return;
      requested = true;
      observer.disconnect();
      void loadData(LibraryLoadIntent.Append);
    }, {
      root,
      rootMargin: '0px 0px 320px 0px',
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [error, hasMore, loadData, loading, loadingMore]);

  const isMac = window.electron.platform === 'darwin';
  const isWindows = window.electron.platform === 'win32';

  return (
    <div
      data-skin-management-page="true"
      className="relative z-10 flex h-full min-h-0 flex-col bg-background text-foreground"
    >
      <div className="draggable flex h-12 shrink-0 items-center border-b border-border px-4">
        {isSidebarCollapsed && !isWindows && (
          <div className={`non-draggable mr-2 flex items-center gap-1 ${isMac ? 'pl-[68px]' : ''}`}>
            <button type="button" onClick={onToggleSidebar} aria-label={i18nService.t('expand')} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-secondary hover:bg-surface-raised">
              <SidebarToggleIcon className="h-4 w-4" isCollapsed />
            </button>
            {updateBadge}
          </div>
        )}
        <h1 className={`non-draggable truncate ${MANAGEMENT_PAGE_TITLE_TEXT} font-semibold text-foreground`}>
          {i18nService.t('libraryTitle')}
        </h1>
      </div>

      <main
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]"
      >
        <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-8">
          <div
            data-skin-management-toolbar="true"
            className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-background pb-3 pt-1"
          >
            <LibraryCategoryDropdown
              value={category}
              options={CATEGORY_FILTERS}
              onChange={handleCategoryChange}
              grouped
            />
            <div className="ml-auto flex min-w-0 flex-[1_1_240px] items-center justify-end gap-2">
              <div className="relative min-w-[96px] max-w-56 flex-1">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-tertiary" />
                <input
                  ref={localSearchInputRef}
                  value={keywordInput}
                  onChange={event => setKeywordInput(event.target.value)}
                  placeholder={i18nService.t('librarySearchPlaceholder')}
                  className="h-9 w-full rounded-xl border border-border bg-surface pl-9 pr-9 text-xs text-foreground outline-none placeholder:text-tertiary focus:ring-2 focus:ring-primary/30"
                />
                {keywordInput.length > 0 && (
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                    <Tooltip
                      content={i18nService.t('libraryClearSearch')}
                      position={TooltipPosition.Bottom}
                      align={TooltipAlign.End}
                      delay={250}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          clearKeyword();
                          localSearchInputRef.current?.focus();
                        }}
                        aria-label={i18nService.t('libraryClearSearch')}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-tertiary hover:bg-surface-raised hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </Tooltip>
                  </div>
                )}
              </div>
              <Tooltip
                content={i18nService.t('libraryFavorites')}
                position={TooltipPosition.Bottom}
                delay={250}
              >
                <button type="button" onClick={handleFavoritesOnlyToggle} aria-pressed={favoritesOnly} aria-label={i18nService.t('libraryFavorites')} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border ${favoritesOnly ? 'bg-amber-500/10 text-amber-500' : 'text-secondary hover:bg-surface-raised'}`}>
                  {favoritesOnly ? <StarSolidIcon className="h-4 w-4" /> : <StarIcon className="h-4 w-4" />}
                </button>
              </Tooltip>
              <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
                <Tooltip
                  content={i18nService.t('libraryGridView')}
                  position={TooltipPosition.Bottom}
                  delay={250}
                >
                  <button type="button" onClick={() => handleViewModeChange(LibraryViewMode.Grid)} aria-label={i18nService.t('libraryGridView')} className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${viewMode === LibraryViewMode.Grid ? 'bg-surface-raised text-foreground' : 'text-secondary'}`}><Squares2X2Icon className="h-4 w-4" /></button>
                </Tooltip>
                <Tooltip
                  content={i18nService.t('libraryListView')}
                  position={TooltipPosition.Bottom}
                  align={TooltipAlign.End}
                  delay={250}
                >
                  <button type="button" onClick={() => handleViewModeChange(LibraryViewMode.List)} aria-label={i18nService.t('libraryListView')} className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${viewMode === LibraryViewMode.List ? 'bg-surface-raised text-foreground' : 'text-secondary'}`}><ListBulletIcon className="h-4 w-4" /></button>
                </Tooltip>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-center justify-between rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <span>{error}</span>
              <button type="button" onClick={handleRefresh} className="ml-3 inline-flex items-center gap-1"><ArrowPathIcon className="h-3.5 w-3.5" />{i18nService.t('retry')}</button>
            </div>
          )}

          <div>
            {loading ? (
              <div className={viewMode === LibraryViewMode.List
                ? 'mt-6 divide-y divide-border border-y border-border'
                : `mt-6 ${LIBRARY_GRID_CLASSNAME}`}
              style={viewMode === LibraryViewMode.Grid ? LIBRARY_GRID_STYLE : undefined}>
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className={viewMode === LibraryViewMode.List
                    ? 'h-14 animate-pulse bg-surface-raised/40'
                    : 'animate-pulse rounded-xl border border-border bg-surface p-2.5'}>
                    {viewMode === LibraryViewMode.Grid && (
                      <>
                        <div className="aspect-video rounded-lg bg-surface-raised" />
                        <div className="mt-2 h-4 w-3/4 rounded bg-surface-raised" />
                        <div className="mt-2 h-3 w-1/2 rounded bg-surface-raised" />
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : dateGroups.length === 0 ? (
              <div className="mt-12 rounded-2xl border border-dashed border-border py-16 text-center">
                <DocumentIcon className="mx-auto h-8 w-8 text-tertiary" />
                <h2 className={`${MANAGEMENT_TITLE_TEXT} mt-3 font-semibold text-foreground`}>
                  {i18nService.t(hasActiveLocalFilter
                    ? 'libraryEmptyTitle'
                    : 'libraryLocalEmptyTitle')}
                </h2>
                <p className={`${MANAGEMENT_BODY_TEXT} mt-1 leading-[var(--lobster-leading-sm)] text-secondary`}>
                  {i18nService.t(hasActiveLocalFilter
                    ? 'libraryEmptyDescription'
                    : 'libraryLocalEmptyDescription')}
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-10">
                {dateGroups.map(dateGroup => (
                  <section key={dateGroup.key}>
                    <div className="mb-5 flex items-center gap-3">
                      <h2 className={`shrink-0 ${MANAGEMENT_TITLE_TEXT} font-semibold text-foreground`}>
                        {dateGroup.title}
                      </h2>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    <div className="space-y-7">
                      {dateGroup.sessionGroups.map(group => (
                        <section key={group.key}>
                          <div className="mb-2.5 flex items-center justify-between gap-6">
                            {group.session ? (
                              <button
                                type="button"
                                onClick={() => onOpenSession(group.session!)}
                                title={group.title}
                                className={`min-w-0 max-w-xl truncate text-left ${MANAGEMENT_TITLE_TEXT} font-semibold text-foreground hover:text-primary`}
                              >
                                {group.title}
                              </button>
                            ) : (
                              <h3
                                title={group.title}
                                className={`min-w-0 max-w-xl truncate ${MANAGEMENT_TITLE_TEXT} font-semibold text-foreground`}
                              >
                                {group.title}
                              </h3>
                            )}
                            <time
                              dateTime={new Date(group.sortTime).toISOString()}
                              className="shrink-0 text-xs text-secondary"
                            >
                              {formatLibrarySessionTime(group.sortTime)}
                            </time>
                          </div>
                          <div
                            className={viewMode === LibraryViewMode.List
                              ? 'divide-y divide-border border-y border-border'
                              : LIBRARY_GRID_CLASSNAME}
                            style={viewMode === LibraryViewMode.Grid
                              ? LIBRARY_GRID_STYLE
                              : undefined}
                          >
                            {group.items.map(item => (
                              <LibraryItemCard
                                key={`${item.itemKind}:${item.itemId}`}
                                item={item}
                                viewMode={viewMode}
                                onOpen={() => openItem(item)}
                                onMenuOpen={getLibraryCardActionIds(item).includes(
                                  LibraryItemAction.RelatedSessions,
                                )
                                  ? () => loadCardDetail(item)
                                  : undefined}
                                menuItems={buildCardMenuItems(item)}
                              />
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
            {!loading && hasMore && (
              <div
                ref={loadMoreSentinelRef}
                className="flex h-14 items-center justify-center"
                aria-live="polite"
              >
                {loadingMore && (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin text-tertiary" aria-hidden="true" />
                    <span className="sr-only">{i18nService.t('loading')}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {activeItem && (
        <LibraryPreviewModal
          item={activeItem}
          detail={localDetail}
          detailLoading={detailLoading}
          onClose={() => setActiveItem(undefined)}
          onToggleFavorite={() => void updateFavorite(activeItem)}
          onOpenWithApp={() => openLocalWithApp(activeItem)}
          onReveal={() => revealLocal(activeItem)}
          onOpenSession={session => {
            setActiveItem(undefined);
            onOpenSession(session);
          }}
        />
      )}
    </div>
  );
};

const LibraryView: React.FC<LibraryViewProps> = props => <LibraryViewContent {...props} />;

export default LibraryView;
