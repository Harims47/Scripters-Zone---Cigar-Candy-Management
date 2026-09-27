import React, { useState, useMemo } from 'react';
import { useHub } from '../../context/HubContext';
import { DailyHandover } from '../../types';
import { useTableState } from '../../utils/useTableState';
import { SortableHeader } from '../../components/ui/SortableHeader';
import { TablePagination } from '../../components/ui/TablePagination';
import { TableEmptyState } from '../../components/ui/TableEmptyState';
import { Receipt, Eye, X, Calendar, CheckCircle2, AlertTriangle, Search } from 'lucide-react';

interface SalesmanHistoryViewProps {
  showHeader?: boolean;
  title?: string;
  subtitle?: string;
}

export const SalesmanHistoryView: React.FC<SalesmanHistoryViewProps> = ({
  showHeader = true,
  title,
  subtitle
}) => {
  const { handovers, activeSession } = useHub();
  const [selectedHandover, setSelectedHandover] = useState<DailyHandover | null>(null);
  const [search, setSearch] = useState('');

  // Filter to this salesman's handovers
  const myHandovers = useMemo(() => {
    return handovers.filter((h) => h.personId === activeSession.personId || h.personName === activeSession.name);
  }, [handovers, activeSession.personId, activeSession.name]);

  const filteredHandovers = useMemo(() => {
    if (!search.trim()) return myHandovers;
    const q = search.toLowerCase();
    return myHandovers.filter((h) =>
      h.handoverNumber.toLowerCase().includes(q) ||
      h.date.toLowerCase().includes(q) ||
      h.status.toLowerCase().includes(q)
    );
  }, [myHandovers, search]);

  const table = useTableState(filteredHandovers, {
    initialSortField: 'date',
    initialSortDirection: 'desc',
    initialPageSize: 10
  });

  return (
    <div className="salesman-history-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {showHeader && (
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            {title || 'My Handover History'}
          </h2>
          <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
            {subtitle || 'View all your previously submitted daily sales handovers, collected packets, and cash settlements.'}
          </p>
        </div>
      )}

      <div className="table-container">
        <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', width: '100%', marginBottom: 0 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
            Handovers ({table.totalItems} {table.totalItems === 1 ? 'record' : 'records'})
          </div>
          <div style={{ position: 'relative', width: '240px' }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search handover #, date..."
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
          <table className="data-table" style={{ width: '100%', minWidth: '780px' }}>
            <thead>
              <tr>
                <SortableHeader
                  label="Handover #"
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
                  label="Net Sales"
                  field="netSales"
                  currentSortField={table.sortField}
                  currentSortDirection={table.sortDirection}
                  onSort={table.toggleSort}
                  align="right"
                  style={{ padding: '12px 10px' }}
                />
                <SortableHeader
                  label="Empty Packets"
                  field="emptyPocketBenefit"
                  currentSortField={table.sortField}
                  currentSortDirection={table.sortDirection}
                  onSort={table.toggleSort}
                  align="right"
                  style={{ padding: '12px 10px' }}
                />
                <SortableHeader
                  label="Coupons"
                  field="couponBenefit"
                  currentSortField={table.sortField}
                  currentSortDirection={table.sortDirection}
                  onSort={table.toggleSort}
                  align="right"
                  style={{ padding: '12px 10px' }}
                />
                <SortableHeader
                  label="Expected"
                  field="expectedHandover"
                  currentSortField={table.sortField}
                  currentSortDirection={table.sortDirection}
                  onSort={table.toggleSort}
                  align="right"
                  style={{ padding: '12px 10px' }}
                />
                <SortableHeader
                  label="Handed Over"
                  field="amountReceived"
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
                  style={{ padding: '12px 10px' }}
                />
                <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {myHandovers.length === 0 ? (
                <TableEmptyState
                  colSpan={9}
                  title="No handovers found"
                  description="No daily handovers submitted yet. Use 'Today's Handover' to submit your sales."
                />
              ) : table.pagedData.length === 0 ? (
                <TableEmptyState
                  colSpan={9}
                  title="No matching handovers"
                  description="No handover records match your search criteria."
                  actionLabel="Clear Search"
                  onAction={() => setSearch('')}
                />
              ) : (
                table.pagedData.map((h) => (
                  <tr key={h.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#4f46e5' }}>
                      {h.handoverNumber}
                    </td>
                    <td style={{ padding: '12px 10px', color: '#64748b', fontWeight: 600 }}>
                      {h.date}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                      ₹{h.netSales.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', color: '#ea580c', fontWeight: 600 }}>
                      -₹{(h.emptyPocketBenefit ?? h.emptyPocketAmount).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', color: '#d97706', fontWeight: 600 }}>
                      -₹{(h.couponBenefit ?? h.couponAmount).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                      ₹{(h.expectedHandover ?? h.totalExpected).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                      ₹{h.amountReceived.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      {h.status === 'SUBMITTED' ? (
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: '#fef3c7', color: '#b45309' }}>
                          WAITING FOR COLLECTION
                        </span>
                      ) : h.status === 'COLLECTED' || h.status === 'SETTLED' ? (
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: '#ecfdf5', color: '#047857' }}>
                          COLLECTED
                        </span>
                      ) : h.status === 'EXCESS' || (h.excess && h.excess > 0) ? (
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: '#ecfdf5', color: '#059669', border: '1px solid #10b981' }}>
                          EXCESS ₹{(h.excess || 0).toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: '#fef2f2', color: '#dc2626' }}>
                          SHORT ₹{h.outstanding.toLocaleString('en-IN')}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => setSelectedHandover(h)}
                      >
                        <Eye size={14} />
                        <span>Breakdown</span>
                      </button>
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
          itemLabel="handovers"
        />
      </div>

      {/* Breakdown Modal */}
      {selectedHandover && (
        <div className="modal-backdrop" onClick={() => setSelectedHandover(null)}>
          <div
            className="modal-content"
            style={{
              maxWidth: '850px',
              width: '94vw',
              background: '#ffffff',
              borderRadius: '16px',
              overflow: 'hidden',
              padding: 0
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', background: '#0f172a', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                  Handover #{selectedHandover.handoverNumber}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{selectedHandover.date}</span>
              </div>
              <button type="button" onClick={() => setSelectedHandover(null)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Product</th>
                      <th style={{ padding: '8px 6px', textAlign: 'center' }}>Opening</th>
                      <th style={{ padding: '8px 6px', textAlign: 'center' }}>Closing</th>
                      <th style={{ padding: '8px 6px', textAlign: 'center' }}>Sales</th>
                      <th style={{ padding: '8px 6px', textAlign: 'center' }}>Free</th>
                      <th style={{ padding: '8px 6px', textAlign: 'center', background: '#f1f5f9' }}>Chargeable</th>
                      <th style={{ padding: '8px 8px', textAlign: 'right' }}>Rate</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Net Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedHandover.items.map((it) => (
                      <tr key={it.productId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700 }}>{it.productName}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>{it.opening}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>{it.closing}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 800, color: '#059669' }}>{it.sales}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center', color: '#d97706' }}>{it.free}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 800, background: '#f8fafc' }}>
                          {it.chargeable ?? Math.max(0, it.sales - it.free)}
                        </td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>₹{it.rate}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>₹{it.netAmount.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Net Sales</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800 }}>₹{selectedHandover.netSales.toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#c2410c' }}>Less: Empty Packet</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ea580c' }}>-₹{(selectedHandover.emptyPocketBenefit ?? selectedHandover.emptyPocketAmount).toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#b45309' }}>Less: Coupon</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#d97706' }}>-₹{(selectedHandover.couponBenefit ?? selectedHandover.couponAmount).toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#4f46e5', fontWeight: 700 }}>Expected Handover</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#4f46e5' }}>₹{(selectedHandover.expectedHandover ?? selectedHandover.totalExpected).toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>
                    {selectedHandover.status === 'SUBMITTED' ? 'Collection Status' : 'Total Collected'}
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: selectedHandover.status === 'SUBMITTED' ? '#ca8a04' : '#059669' }}>
                    {selectedHandover.status === 'SUBMITTED' ? 'Awaiting Admin' : `₹${selectedHandover.amountReceived.toLocaleString('en-IN')}`}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 700 }}>Status</div>
                  {selectedHandover.status === 'SUBMITTED' ? (
                    <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#b45309' }}>
                      WAITING FOR COLLECTION
                    </div>
                  ) : selectedHandover.status === 'EXCESS' || (selectedHandover.excess && selectedHandover.excess > 0) ? (
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#059669' }}>
                      EXCESS ₹{(selectedHandover.excess || 0).toLocaleString('en-IN')}
                    </div>
                  ) : selectedHandover.outstanding > 0 ? (
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#dc2626' }}>
                      SHORT ₹{selectedHandover.outstanding.toLocaleString('en-IN')}
                    </div>
                  ) : (
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#047857' }}>
                      COLLECTED (SETTLED)
                    </div>
                  )}
                </div>
              </div>

              {/* Admin Collection Details if collected */}
              {selectedHandover.status !== 'SUBMITTED' && (selectedHandover.cashReceived !== undefined || selectedHandover.collectedBy) && (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '12px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', gap: '14px', color: '#065f46' }}>
                    <span>Cash: <strong>₹{(selectedHandover.cashReceived || 0).toLocaleString('en-IN')}</strong></span>
                    <span>GPay: <strong>₹{(selectedHandover.gpayReceived || 0).toLocaleString('en-IN')}</strong></span>
                    <span>Total: <strong>₹{selectedHandover.amountReceived.toLocaleString('en-IN')}</strong></span>
                  </div>
                  {selectedHandover.collectedBy && (
                    <div style={{ color: '#047857', fontSize: '0.75rem' }}>
                      Verified by: <strong>{selectedHandover.collectedBy}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
