import React, { useState, useMemo } from 'react';
import { useHub } from '../../context/HubContext';
import { TableExportButtons } from '../../components/ui/TableExportButtons';
import { TablePagination } from '../../components/ui/TablePagination';
import { SortableHeader } from '../../components/ui/SortableHeader';
import { TableEmptyState } from '../../components/ui/TableEmptyState';
import { IssueQuantityModal } from '../../components/modals/IssueQuantityModal';
import { exportToCSV, exportToExcel, exportToPDF } from '../../utils/exportHelpers';
import { useTableState } from '../../utils/useTableState';
import { Users, ArrowUpRight, Search, X } from 'lucide-react';

export const SalesmenListView: React.FC = () => {
  const { persons, handovers, quantityIssues } = useHub();

  const salesmen = useMemo(() => persons.filter((p) => p.role === 'SALESMAN'), [persons]);

  const [selectedSalesman, setSelectedSalesman] = useState<string | null>(null);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Salesmen performance summary
  const salesmenSummary = useMemo(() => {
    return salesmen.map((sm) => {
      const sHandovers = handovers.filter((h) => h.personId === sm.id && h.type === 'SALESMAN');
      const sIssues = quantityIssues.filter((q) => q.personId === sm.id);

      const handoversCount = sHandovers.length;
      const totalNet = sHandovers.reduce((a, h) => a + h.netSales, 0);
      const totalGross = sHandovers.reduce((a, h) => a + h.grossSales, 0);
      const totalPacketDisc = sHandovers.reduce((a, h) => a + (h.emptyPocketBenefit ?? h.emptyPocketAmount), 0);
      const totalCouponDisc = sHandovers.reduce((a, h) => a + h.couponAmount, 0);
      const totalOutstanding = sHandovers.reduce((a, h) => a + h.outstanding, 0);
      const totalQtyIssued = sIssues.reduce((a, q) => a + q.quantityIssued, 0);

      return {
        salesman: sm,
        handoversCount,
        totalQtyIssued,
        totalGross,
        totalPacketDisc,
        totalCouponDisc,
        totalNet,
        totalOutstanding
      };
    });
  }, [salesmen, handovers, quantityIssues]);

  const filteredSummary = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return salesmenSummary;
    return salesmenSummary.filter(
      (s) =>
        s.salesman.name.toLowerCase().includes(q) ||
        (s.salesman.phone && s.salesman.phone.includes(q)) ||
        (s.salesman.notes && s.salesman.notes.toLowerCase().includes(q))
    );
  }, [salesmenSummary, searchQuery]);

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    sortField,
    sortDirection,
    toggleSort,
    pagedData,
    totalItems,
    totalPages,
    resetPage
  } = useTableState(filteredSummary, {
    initialPageSize: 10,
    initialSortField: 'name',
    initialSortDirection: 'asc',
    sortExtractors: {
      name: (s) => s.salesman.name,
      phone: (s) => s.salesman.phone || '',
      handoversCount: (s) => s.handoversCount,
      totalQtyIssued: (s) => s.totalQtyIssued,
      totalGross: (s) => s.totalGross,
      totalPacketDisc: (s) => s.totalPacketDisc,
      totalNet: (s) => s.totalNet,
      totalOutstanding: (s) => s.totalOutstanding
    }
  });

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    resetPage();
  };

  const handleExportCSV = () => {
    const headers = ['Salesman', 'Phone', 'Handovers', 'Qty Issued', 'Gross (₹)', 'Packet Credit (₹)', 'Coupon Credit (₹)', 'Net Sales (₹)', 'Outstanding (₹)'];
    const rows = filteredSummary.map((s) => [
      s.salesman.name,
      s.salesman.phone,
      s.handoversCount,
      s.totalQtyIssued,
      s.totalGross,
      s.totalPacketDisc,
      s.totalCouponDisc,
      s.totalNet,
      s.totalOutstanding
    ]);
    exportToCSV('salesmen_directory', headers, rows);
  };

  const handleExportExcel = () => {
    const headers = ['Salesman', 'Phone', 'Handovers', 'Qty Issued', 'Gross (₹)', 'Packet Credit (₹)', 'Coupon Credit (₹)', 'Net Sales (₹)', 'Outstanding (₹)'];
    const rows = filteredSummary.map((s) => [
      s.salesman.name,
      s.salesman.phone,
      s.handoversCount,
      s.totalQtyIssued,
      s.totalGross,
      s.totalPacketDisc,
      s.totalCouponDisc,
      s.totalNet,
      s.totalOutstanding
    ]);
    exportToExcel('salesmen_directory', headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ['Salesman', 'Phone', 'Handovers', 'Issued', 'Net Sales', 'Outstanding'];
    const rows = filteredSummary.map((s) => [
      s.salesman.name,
      s.salesman.phone,
      s.handoversCount,
      s.totalQtyIssued,
      `₹${s.totalNet.toLocaleString('en-IN')}`,
      `₹${s.totalOutstanding.toLocaleString('en-IN')}`
    ]);
    exportToPDF('Sales Staff Directory', headers, rows);
  };

  const handleOpenIssue = (salesmanId: string) => {
    setSelectedSalesman(salesmanId);
    setIsIssueModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 2px 0' }}>
            Field Sales Representatives
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
            Active route salesmen receiving daily inventory consignments and handing over daily collections.
          </p>
        </div>
      </div>

      {/* Directory Table Card */}
      <div className="table-container">
        <div className="table-toolbar">
          <div style={{ position: 'relative', width: '280px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
            <input
              type="text"
              placeholder="Search salesmen..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 28px 7px 32px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                outline: 'none'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
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

          <TableExportButtons
            onExportCSV={handleExportCSV}
            onExportExcel={handleExportExcel}
            onExportPDF={handleExportPDF}
          />
        </div>

        <div className="table-responsive">
          <table className="data-table" style={{ width: '100%', minWidth: '820px' }}>
            <thead>
              <tr>
                <SortableHeader
                  label="Salesman"
                  field="name"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={toggleSort}
                  style={{ padding: '12px 14px' }}
                />
                <SortableHeader
                  label="Phone"
                  field="phone"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={toggleSort}
                  style={{ padding: '12px 10px' }}
                />
                <SortableHeader
                  label="Handovers"
                  field="handoversCount"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={toggleSort}
                  align="center"
                  style={{ padding: '12px 10px' }}
                />
                <SortableHeader
                  label="Total Issued"
                  field="totalQtyIssued"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={toggleSort}
                  align="center"
                  style={{ padding: '12px 10px' }}
                />
                <SortableHeader
                  label="Gross Total"
                  field="totalGross"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={toggleSort}
                  align="right"
                  style={{ padding: '12px 10px' }}
                />
                <SortableHeader
                  label="Empty Packet"
                  field="totalPacketDisc"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={toggleSort}
                  align="right"
                  style={{ padding: '12px 10px' }}
                />
                <SortableHeader
                  label="Net Sales"
                  field="totalNet"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={toggleSort}
                  align="right"
                  style={{ padding: '12px 10px' }}
                />
                <SortableHeader
                  label="Outstanding"
                  field="totalOutstanding"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={toggleSort}
                  align="center"
                  style={{ padding: '12px 10px' }}
                />
                <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedData.length === 0 ? (
                <TableEmptyState
                  colSpan={9}
                  title={searchQuery ? 'No matching salesmen' : 'No salesmen configured'}
                  description={
                    searchQuery
                      ? `No salesmen matched "${searchQuery}". Clear your search query.`
                      : 'No salesmen have been registered in the system yet.'
                  }
                  icon={<Users size={28} />}
                />
              ) : (
                pagedData.map((s) => (
                  <tr key={s.salesman.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0f172a' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem' }}>
                          {s.salesman.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div>{s.salesman.name}</div>
                          {s.salesman.notes && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{s.salesman.notes}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 10px', color: '#64748b' }}>
                      {s.salesman.phone || '—'}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700 }}>
                      {s.handoversCount}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700, color: '#0284c7' }}>
                      {s.totalQtyIssued}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 600 }}>
                      ₹{s.totalGross.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', color: '#ea580c', fontWeight: 600 }}>
                      ₹{s.totalPacketDisc.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 900, color: '#059669', fontSize: '0.92rem' }}>
                      ₹{s.totalNet.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      {s.totalOutstanding > 0 ? (
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: '#fef2f2', color: '#dc2626' }}>
                          ₹{s.totalOutstanding.toLocaleString('en-IN')} Due
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: '#ecfdf5', color: '#047857' }}>
                          Settled
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700 }}
                        onClick={() => handleOpenIssue(s.salesman.id)}
                      >
                        <ArrowUpRight size={13} />
                        <span>Issue Stock</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="salesmen"
        />
      </div>

      <IssueQuantityModal
        isOpen={isIssueModalOpen}
        initialPersonId={selectedSalesman || undefined}
        onClose={() => setIsIssueModalOpen(false)}
      />
    </div>
  );
};

