import { useVirtualizer } from '@tanstack/react-virtual';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { LibraryViewMode } from '../../../shared/library/constants';
import type { LibraryItem, LibrarySessionRef } from '../../../shared/library/types';
import {
  MANAGEMENT_TITLE_TEXT,
} from '../common/managementTypography';

export interface LibrarySessionGroup {
  key: string;
  title: string;
  sortTime: number;
  session?: LibrarySessionRef;
  items: LibraryItem[];
}

export interface LibraryDateGroup {
  key: string;
  title: string;
  sessionGroups: LibrarySessionGroup[];
}

const LibraryVirtualRowKind = {
  DateHeader: 'date-header',
  SessionHeader: 'session-header',
  Items: 'items',
} as const;

type LibraryVirtualRow =
  | {
      kind: typeof LibraryVirtualRowKind.DateHeader;
      key: string;
      title: string;
      first: boolean;
    }
  | {
      kind: typeof LibraryVirtualRowKind.SessionHeader;
      key: string;
      group: LibrarySessionGroup;
    }
  | {
      kind: typeof LibraryVirtualRowKind.Items;
      key: string;
      items: LibraryItem[];
      first: boolean;
      last: boolean;
    };

const GRID_MIN_CARD_WIDTH_PX = 240;
const GRID_GAP_PX = 12;

export const getLibraryGridColumnCount = (width: number): number => Math.max(
  1,
  Math.floor((Math.max(0, width) + GRID_GAP_PX) / (GRID_MIN_CARD_WIDTH_PX + GRID_GAP_PX)),
);

const createVirtualRows = (
  dateGroups: LibraryDateGroup[],
  viewMode: LibraryViewMode,
  gridColumnCount: number,
): LibraryVirtualRow[] => dateGroups.flatMap((dateGroup, dateIndex) => {
  const rows: LibraryVirtualRow[] = [{
    kind: LibraryVirtualRowKind.DateHeader,
    key: `date:${dateGroup.key}`,
    title: dateGroup.title,
    first: dateIndex === 0,
  }];
  for (const group of dateGroup.sessionGroups) {
    rows.push({
      kind: LibraryVirtualRowKind.SessionHeader,
      key: `session:${group.key}`,
      group,
    });
    const chunkSize = viewMode === LibraryViewMode.Grid ? gridColumnCount : 1;
    for (let index = 0; index < group.items.length; index += chunkSize) {
      rows.push({
        kind: LibraryVirtualRowKind.Items,
        key: `items:${viewMode}:${gridColumnCount}:${group.key}:${index}`,
        items: group.items.slice(index, index + chunkSize),
        first: index === 0,
        last: index + chunkSize >= group.items.length,
      });
    }
  }
  return rows;
});

const getEstimatedRowHeight = (
  row: LibraryVirtualRow,
  viewMode: LibraryViewMode,
): number => {
  if (row.kind === LibraryVirtualRowKind.DateHeader) return row.first ? 44 : 84;
  if (row.kind === LibraryVirtualRowKind.SessionHeader) return 34;
  if (viewMode === LibraryViewMode.List) return row.last ? 84 : 56;
  return row.last ? 288 : 260;
};

const GRID_STYLE: React.CSSProperties = {
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 264px))',
};

const LibraryVirtualizedGroups: React.FC<{
  dateGroups: LibraryDateGroup[];
  viewMode: LibraryViewMode;
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  onOpenSession: (session: LibrarySessionRef) => void;
  formatSessionTime: (value: number) => string;
  renderItem: (item: LibraryItem) => React.ReactNode;
}> = ({
  dateGroups,
  viewMode,
  scrollContainerRef,
  onOpenSession,
  formatSessionTime,
  renderItem,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [listWidth, setListWidth] = useState(1);
  const [scrollMargin, setScrollMargin] = useState(0);
  const gridColumnCount = getLibraryGridColumnCount(listWidth);
  const rows = useMemo(() => createVirtualRows(
    dateGroups,
    viewMode,
    gridColumnCount,
  ), [dateGroups, gridColumnCount, viewMode]);

  useLayoutEffect(() => {
    const list = listRef.current;
    const scrollContainer = scrollContainerRef.current;
    if (!list || !scrollContainer) return undefined;
    const updateMeasurements = (): void => {
      setListWidth(list.clientWidth);
      setScrollMargin(list.offsetTop);
    };
    updateMeasurements();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(updateMeasurements);
    observer.observe(list);
    observer.observe(scrollContainer);
    return () => observer.disconnect();
  }, [scrollContainerRef]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: index => getEstimatedRowHeight(rows[index]!, viewMode),
    getItemKey: index => rows[index]?.key ?? index,
    overscan: 3,
    scrollMargin,
  });

  return (
    <div
      ref={listRef}
      className="relative mt-6 w-full"
      style={{ height: rowVirtualizer.getTotalSize() }}
    >
      {rowVirtualizer.getVirtualItems().map(virtualRow => {
        const row = rows[virtualRow.index];
        if (!row) return null;
        return (
          <div
            key={row.key}
            ref={rowVirtualizer.measureElement}
            data-index={virtualRow.index}
            className="absolute left-0 top-0 w-full"
            style={{
              transform: `translateY(${virtualRow.start - scrollMargin}px)`,
            }}
          >
            {row.kind === LibraryVirtualRowKind.DateHeader && (
              <div className={`${row.first ? '' : 'pt-10'} mb-5 flex items-center gap-3`}>
                <h2 className={`shrink-0 ${MANAGEMENT_TITLE_TEXT} font-semibold text-foreground`}>
                  {row.title}
                </h2>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}
            {row.kind === LibraryVirtualRowKind.SessionHeader && (
              <div className="mb-2.5 flex items-center justify-between gap-6">
                {row.group.session ? (
                  <button
                    type="button"
                    onClick={() => onOpenSession(row.group.session!)}
                    title={row.group.title}
                    className={`min-w-0 max-w-xl truncate text-left ${MANAGEMENT_TITLE_TEXT} font-semibold text-foreground hover:text-primary`}
                  >
                    {row.group.title}
                  </button>
                ) : (
                  <h3
                    title={row.group.title}
                    className={`min-w-0 max-w-xl truncate ${MANAGEMENT_TITLE_TEXT} font-semibold text-foreground`}
                  >
                    {row.group.title}
                  </h3>
                )}
                <time
                  dateTime={new Date(row.group.sortTime).toISOString()}
                  className="shrink-0 text-xs text-secondary"
                >
                  {formatSessionTime(row.group.sortTime)}
                </time>
              </div>
            )}
            {row.kind === LibraryVirtualRowKind.Items && (
              <div className={row.last ? 'pb-7' : viewMode === LibraryViewMode.Grid ? 'pb-3' : ''}>
                <div
                  className={viewMode === LibraryViewMode.List
                    ? `border-b border-border ${row.first ? 'border-t' : ''}`
                    : 'grid justify-start gap-3'}
                  style={viewMode === LibraryViewMode.Grid ? GRID_STYLE : undefined}
                >
                  {row.items.map(renderItem)}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default LibraryVirtualizedGroups;
