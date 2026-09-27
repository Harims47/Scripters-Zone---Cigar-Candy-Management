import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  totalPages?: number;
  itemLabel?: string;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  totalPages: propTotalPages,
  itemLabel = 'entries'
}) => {
  const calculatedTotalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const totalPages = propTotalPages !== undefined ? Math.max(1, propTotalPages) : calculatedTotalPages;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safeCurrentPage * pageSize);

  // Generate page numbers with ellipsis if many pages
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const effectiveOptions = Array.from(new Set([pageSize, ...pageSizeOptions])).sort((a, b) => a - b);

  return (
    <div className="table-pagination-bar">
      <div className="pagination-left">
        {onPageSizeChange && (
          <div className="pagination-size-select">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
            >
              {effectiveOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span>{itemLabel}</span>
          </div>
        )}
        <div className="pagination-info">
          Showing <strong>{startItem}</strong> to <strong>{endItem}</strong> of <strong>{totalItems}</strong> {itemLabel}
        </div>
      </div>

      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-btn icon-btn"
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          title="First Page"
        >
          <ChevronsLeft size={15} />
        </button>
        <button
          type="button"
          className="pagination-btn icon-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          title="Previous Page"
        >
          <ChevronLeft size={15} />
        </button>

        <div className="pagination-page-numbers">
          {getPageNumbers().map((p, idx) => {
            if (typeof p === 'string') {
              return (
                <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
                  …
                </span>
              );
            }
            const isActive = p === currentPage;
            return (
              <button
                key={p}
                type="button"
                className={`pagination-btn page-num ${isActive ? 'active' : ''}`}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="pagination-btn icon-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          title="Next Page"
        >
          <ChevronRight size={15} />
        </button>
        <button
          type="button"
          className="pagination-btn icon-btn"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          title="Last Page"
        >
          <ChevronsRight size={15} />
        </button>
      </div>
    </div>
  );
};
