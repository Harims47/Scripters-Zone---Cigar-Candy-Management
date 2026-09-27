import React, { useState, useMemo } from 'react';
import { useHub } from '../../context/HubContext';
import { useTableState } from '../../utils/useTableState';
import { SortableHeader } from '../../components/ui/SortableHeader';
import { TablePagination } from '../../components/ui/TablePagination';
import { TableEmptyState } from '../../components/ui/TableEmptyState';
import { AlertTriangle, CheckCircle2, Calendar, Banknote, Search, X } from 'lucide-react';

export const SalesmanOutstandingView: React.FC = () => {
  const { outstandings, activeSession } = useHub();
  const [search, setSearch] = useState('');

  const myOutstandings = useMemo(() => {
    return outstandings.filter(
      (o) => o.personId === activeSession.personId || o.personName === activeSession.name
    );
  }, [outstandings, activeSession.personId, activeSession.name]);

  const totalDue = useMemo(() => {
    return myOutstandings.reduce((sum, o) => sum + o.remainingAmount, 0);
  }, [myOutstandings]);

  const filteredOutstandings = useMemo(() => {
    if (!search.trim()) return myOutstandings;
    const q = search.toLowerCase();
    return myOutstandings.filter((o) =>
      o.handoverNumber.toLowerCase().includes(q) ||
      o.date.toLowerCase().includes(q) ||
      o.status.toLowerCase().includes(q)
    );
  }, [myOutstandings, search]);

  const table = useTableState(filteredOutstandings, {
    initialSortField: 'date',
    initialSortDirection: 'desc',
    initialPageSize: 10
  });

  return (
    <div className="salesman-outstanding-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
          My Outstanding Ledger
        </h1>
        <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
          Track past daily handovers where the amount handed over was less than expected, and review payment clearances.
        </p>
      </div>

      {/* Summary Card */}
      <div
        style={{
          background: totalDue > 0 ? '#fff1f2' : '#ecfdf5',
          border: `1.5px solid ${totalDue > 0 ? '#fecdd3' : '#a7f3d0'}`,
          borderRadius: '14px',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: totalDue > 0 ? '#e11d48' : '#047857' }}>
            Current Outstanding Balance
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: totalDue > 0 ? '#be123c' : '#047857', marginTop: '4px' }}>
            ₹{totalDue.toLocaleString('en-IN')}
          </div>
        </div>

        <div style={{ fontSize: '0.85rem', color: totalDue > 0 ? '#9f1239' : '#065f46' }}>
          {totalDue > 0
            ? 'Please coordinate with Central Admin to settle outstanding amounts.'
            : 'All your previous sales handovers have been cleared and settled in full!'}
        </div>
      </div>

      {/* Outstanding Records Table */}
      <div className="table-container">
        <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', width: '100%', marginBottom: 0 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
            Records ({table.totalItems} {table.totalItems === 1 ? 'record' : 'records'})
          </div>
          <div style={{ position: 'relative', width: '240px' }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search reference, date..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 12px 6px 30px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                outline: 'none',
                background: '#f8fafc'
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: 0
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table" style={{ width: '100%', minWidth: '760px' }}>
            <thead>
              <tr>
                <SortableHeader
                  label="Handover Ref"
                  field="handoverNumber"
                  currentSortField={table.sortField}
                  currentSortDirection={table.sortDirection}
                  onSort={table.toggleSort}
                  style={{ padding: '12px 14px' }}
                />
                <SortableHeader
                  label="Date"
                  field="date"
                  currentSortField={table.sortField}
                  currentSortDirection={table.sortDirection}
                  onSort={table.toggleSort}
                  style={{ padding: '12px 10px' }}
                />
                <SortableHeader
                  label="Total Expected"
                  field="expectedAmount"
                  currentSortField={table.sortField}
                  currentSortDirection={table.sortDirection}
                  onSort={table.toggleSort}
                  align="right"
                  style={{ padding: '12px 10px' }}
                />
                <SortableHeader
                  label="Initial Handover"
                  field="initialReceived"
                  currentSortField={table.sortField}
                  currentSortDirection={table.sortDirection}
                  onSort={table.toggleSort}
                  align="right"
                  style={{ padding: '12px 10px' }}
                />
                <SortableHeader
                  label="Original Shortage"
                  field="originalOutstanding"
                  currentSortField={table.sortField}
                  currentSortDirection={table.sortDirection}
                  onSort={table.toggleSort}
                  align="right"
                  style={{ padding: '12px 10px' }}
                />
                <SortableHeader
                  label="Remaining Due"
                  field="remainingAmount"
                  currentSortField={table.sortField}
                  currentSortDirection={table.sortDirection}
                  onSort={table.toggleSort}
                  align="right"
                  style={{ padding: '12px 10px' }}
                />
                <SortableHeader
                  label="Status"
                  field="status"
                  currentSortField={table.sortField}
                  currentSortDirection={table.sortDirection}
                  onSort={table.toggleSort}
                  align="center"
                  style={{ padding: '12px 14px' }}
                />
              </tr>
            </thead>
            <tbody>
              {myOutstandings.length === 0 ? (
                <TableEmptyState
                  colSpan={7}
                  title="No outstanding records"
                  description="No outstanding records found for your account."
                />
              ) : table.pagedData.length === 0 ? (
                <TableEmptyState
                  colSpan={7}
                  title="No matching records"
                  description="No outstanding records match your search criteria."
                  actionLabel="Clear Search"
                  onAction={() => setSearch('')}
                />
              ) : (
                table.pagedData.map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#4f46e5' }}>
                      {o.handoverNumber}
                    </td>
                    <td style={{ padding: '12px 10px', color: '#64748b', fontWeight: 600 }}>
                      {o.date}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700 }}>
                      ₹{o.expectedAmount.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                      ₹{o.initialReceived.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', color: '#64748b' }}>
                      ₹{o.originalOutstanding.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 900, color: o.remainingAmount > 0 ? '#dc2626' : '#059669', fontSize: '0.94rem' }}>
                      ₹{o.remainingAmount.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {o.status === 'SETTLED' || o.remainingAmount === 0 ? (
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: '#ecfdf5', color: '#047857' }}>
                          SETTLED
                        </span>
                      ) : o.status === 'PARTIALLY PAID' ? (
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
                          PARTIALLY PAID (₹{o.remainingAmount.toLocaleString('en-IN')})
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: '#fef2f2', color: '#dc2626' }}>
                          DUE ₹{o.remainingAmount.toLocaleString('en-IN')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          currentPage={table.currentPage}
          totalPages={table.totalPages}
          pageSize={table.pageSize}
          totalItems={table.totalItems}
          onPageChange={table.setCurrentPage}
          onPageSizeChange={table.setPageSize}
          itemLabel="records"
        />
      </div>
    </div>
  );
};
