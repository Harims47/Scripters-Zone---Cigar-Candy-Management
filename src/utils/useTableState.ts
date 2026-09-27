import { useState, useMemo, useCallback } from 'react';
import { SortDirection } from '../components/ui/SortableHeader';

export interface UseTableStateOptions<T> {
  data?: T[];
  initialPageSize?: number;
  pageSizeOptions?: number[];
  initialSortField?: string | null;
  initialSortKey?: string | null;
  initialSortDirection?: SortDirection;
  sortExtractors?: Record<string, (item: T) => string | number | boolean | Date | null | undefined>;
}

export function useTableState<T>(
  dataOrOptions: T[] | (UseTableStateOptions<T> & { data: T[] }),
  options: UseTableStateOptions<T> = {}
) {
  const isOptionsFirst = !Array.isArray(dataOrOptions);
  const data: T[] = isOptionsFirst ? (dataOrOptions as any).data || [] : (dataOrOptions as T[]) || [];
  const mergedOptions: UseTableStateOptions<T> = isOptionsFirst ? (dataOrOptions as any) : options;

  const {
    initialPageSize = 10,
    pageSizeOptions = [10, 25, 50, 100],
    initialSortField = mergedOptions.initialSortKey ?? null,
    initialSortDirection = null,
    sortExtractors = {}
  } = mergedOptions;

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const [sortField, setSortField] = useState<string | null>(initialSortField);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSortDirection);

  const toggleSort = useCallback((field: string) => {
    setCurrentPage(1);
    if (sortField !== field) {
      setSortField(field);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else if (sortDirection === 'desc') {
      setSortField(null);
      setSortDirection(null);
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField, sortDirection]);

  // Sort dataset
  const sortedData = useMemo(() => {
    if (!sortField || !sortDirection) {
      return data;
    }

    const extractor =
      sortExtractors[sortField] ||
      ((item: any) => {
        if (item && typeof item === 'object') {
          return item[sortField];
        }
        return '';
      });

    return [...data].sort((a, b) => {
      const valA = extractor(a);
      const valB = extractor(b);

      if (valA === valB) return 0;
      if (valA === null || valA === undefined || valA === '') return 1;
      if (valB === null || valB === undefined || valB === '') return -1;

      let comparison = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else {
        comparison = String(valA).localeCompare(String(valB), undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortField, sortDirection, sortExtractors]);

  // Total pages
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));

  // Bound current page (auto-step back if current page exceeds total pages)
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  // Paginated slice
  const pagedData = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, safeCurrentPage, pageSize]);

  const resetPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  return {
    currentPage: safeCurrentPage,
    setCurrentPage,
    setPage: setCurrentPage,
    goToPage: setCurrentPage,
    pageSize,
    setPageSize,
    pageSizeOptions,
    sortField,
    sortKey: sortField,
    sortDirection,
    toggleSort,
    setSort: (field: string | null, dir: SortDirection) => {
      setSortField(field);
      setSortDirection(dir);
      setCurrentPage(1);
    },
    pagedData,
    paginatedData: pagedData,
    sortedData,
    totalItems: data.length,
    totalPages,
    resetPage
  };
}
