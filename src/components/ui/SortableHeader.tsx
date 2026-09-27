import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export type SortDirection = 'asc' | 'desc' | null;

interface SortableHeaderProps {
  label: string;
  field: string;
  currentSortField?: string | null;
  currentSortDirection?: SortDirection;
  onSort: (field: string) => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
  style?: React.CSSProperties;
}

export const SortableHeader: React.FC<SortableHeaderProps> = ({
  label,
  field,
  currentSortField,
  currentSortDirection,
  onSort,
  align = 'left',
  className = '',
  style = {}
}) => {
  const isSorted = currentSortField === field;
  const direction = isSorted ? currentSortDirection : null;

  const handleClick = () => {
    onSort(field);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSort(field);
    }
  };

  const justify =
    align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start';

  return (
    <th
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        textAlign: align,
        padding: '12px 14px',
        fontWeight: 800,
        background: '#4f46e5',
        color: '#ffffff',
        borderRight: '1px solid rgba(255, 255, 255, 0.15)',
        ...style
      }}
      className={`sortable-th ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="columnheader"
      aria-sort={
        direction === 'asc'
          ? 'ascending'
          : direction === 'desc'
          ? 'descending'
          : 'none'
      }
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: justify,
          gap: '6px',
          width: '100%',
          color: '#ffffff'
        }}
      >
        <span style={{ color: '#ffffff' }}>{label}</span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            color: isSorted ? '#ffffff' : 'rgba(255, 255, 255, 0.7)'
          }}
        >
          {direction === 'asc' ? (
            <ArrowUp size={14} strokeWidth={2.5} color={isSorted ? '#ffffff' : 'rgba(255, 255, 255, 0.7)'} />
          ) : direction === 'desc' ? (
            <ArrowDown size={14} strokeWidth={2.5} color={isSorted ? '#ffffff' : 'rgba(255, 255, 255, 0.7)'} />
          ) : (
            <ArrowUpDown size={13} strokeWidth={1.75} style={{ opacity: 0.7 }} color="rgba(255, 255, 255, 0.7)" />
          )}
        </span>
      </div>
    </th>
  );
};
