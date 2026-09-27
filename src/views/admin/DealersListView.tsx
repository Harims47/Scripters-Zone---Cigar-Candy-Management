import React, { useState, useMemo } from 'react';
import { useHub } from '../../context/HubContext';
import { TableExportButtons } from '../../components/ui/TableExportButtons';
import { TablePagination } from '../../components/ui/TablePagination';
import { SortableHeader } from '../../components/ui/SortableHeader';
import { TableEmptyState } from '../../components/ui/TableEmptyState';
import { IssueQuantityModal } from '../../components/modals/IssueQuantityModal';
import { exportToCSV, exportToExcel, exportToPDF } from '../../utils/exportHelpers';
import { useTableState } from '../../utils/useTableState';
import { Store, ArrowUpRight, Search, X } from 'lucide-react';

export const DealersListView: React.FC = () => {
  const { persons, handovers, quantityIssues } = useHub();

  const dealers = useMemo(() => persons.filter((p) => p.role === 'DEALER'), [persons]);

  const [selectedDealer, setSelectedDealer] = useState<string | null>(null);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dealers performance summary
  const dealersSummary = useMemo(() => {
    return dealers.map((dlr) => {
      const dHandovers = handovers.filter((h) => h.personId === dlr.id && h.type === 'DEALER');
      const dIssues = quantityIssues.filter((q) => q.personId === dlr.id);

      const uniqueCustomers = new Set<string>();
      dHandovers.forEach((h) => {
        if (h.customerName) uniqueCustomers.add(h.customerName.toLowerCase().trim());
      });

      const totalNet = dHandovers.reduce((a, h) => a + h.netSales, 0);
      const totalGross = dHandovers.reduce((a, h) => a + h.grossSales, 0);
      const totalOutstanding = dHandovers.reduce((a, h) => a + h.outstanding, 0);
      const totalQtyIssued = dIssues.reduce((a, q) => a + q.quantityIssued, 0);

      return {
        dealer: dlr,
        handoversCount: dHandovers.length,
        customersCount: uniqueCustomers.size,
        totalQtyIssued,
        totalGross,
        totalNet,
        totalOutstanding
      };
    });
  }, [dealers, handovers, quantityIssues]);

  const filteredSummary = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return dealersSummary;
    return dealersSummary.filter(
      (d) =>
        d.dealer.name.toLowerCase().includes(q) ||
        (d.dealer.phone && d.dealer.phone.includes(q)) ||
        (d.dealer.notes && d.dealer.notes.toLowerCase().includes(q))
    );
  }, [dealersSummary, searchQuery]);

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
      name: (d) => d.dealer.name,
      phone: (d) => d.dealer.phone || '',
      customersCount: (d) => d.customersCount,
      handoversCount: (d) => d.handoversCount,
      totalQtyIssued: (d) => d.totalQtyIssued,
      totalGross: (d) => d.totalGross,
      totalNet: (d) => d.totalNet,
      totalOutstanding: (d) => d.totalOutstanding
    }
  });

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    resetPage();
  };

  const handleExportCSV = () => {
    const headers = ['Dealer Counter', 'Phone', 'Buyers', 'Transactions', 'Qty Issued', 'Gross (₹)', 'Net (₹)', 'Outstanding (₹)'];
    const rows = filteredSummary.map((d) => [
      d.dealer.name,
      d.dealer.phone,
      d.customersCount,
      d.handoversCount,
      d.totalQtyIssued,
      d.totalGross,
      d.totalNet,
      d.totalOutstanding
    ]);
    exportToCSV('dealers_directory', headers, rows);
  };

  const handleExportExcel = () => {
    const headers = ['Dealer Counter', 'Phone', 'Buyers', 'Transactions', 'Qty Issued', 'Gross (₹)', 'Net (₹)', 'Outstanding (₹)'];
    const rows = filteredSummary.map((d) => [
      d.dealer.name,
      d.dealer.phone,
      d.customersCount,
      d.handoversCount,
      d.totalQtyIssued,
      d.totalGross,
      d.totalNet,
      d.totalOutstanding
    ]);
    exportToExcel('dealers_directory', headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ['Dealer', 'Phone', 'Buyers', 'Net Sales', 'Outstanding'];
    const rows = filteredSummary.map((d) => [
      d.dealer.name,
      d.dealer.phone,
      d.customersCount,
      `₹${d.totalNet.toLocaleString('en-IN')}`,
      `₹${d.totalOutstanding.toLocaleString('en-IN')}`
    ]);
    exportToPDF('Wholesale Dealers Directory', headers, rows);
  };

  const handleOpenIssue = (dealerId: string) => {
    setSelectedDealer(dealerId);
    setIsIssueModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 2px 0' }}>
            Wholesale Dealer Counters
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
            Wholesale accounts managed by Admin with customer buyer details recorded against transactions.
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
              placeholder="Search dealers..."
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
                  label="Dealer Counter"
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
                  label="Buyer Accounts"
                  field="customersCount"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={toggleSort}
                  align="center"
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
                  title={searchQuery ? 'No matching dealers' : 'No dealers configured'}
                  description={
                    searchQuery
                      ? `No dealers matched "${searchQuery}". Clear your search query.`
                      : 'No dealer accounts have been registered in the system yet.'
                  }
                  icon={<Store size={28} />}
                />
              ) : (
                pagedData.map((d) => (
                  <tr key={d.dealer.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0f172a' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#eff6ff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem' }}>
                          <Store size={14} />
                        </div>
                        <div>
                          <div>{d.dealer.name}</div>
                          {d.dealer.notes && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{d.dealer.notes}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 10px', color: '#64748b' }}>
                      {d.dealer.phone || '—'}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700, color: '#0284c7' }}>
                      {d.customersCount}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700 }}>
                      {d.handoversCount}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700, color: '#475569' }}>
                      {d.totalQtyIssued}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 600 }}>
                      ₹{d.totalGross.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 900, color: '#059669', fontSize: '0.92rem' }}>
                      ₹{d.totalNet.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      {d.totalOutstanding > 0 ? (
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: '#fef2f2', color: '#dc2626' }}>
                          ₹{d.totalOutstanding.toLocaleString('en-IN')} Due
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
                        onClick={() => handleOpenIssue(d.dealer.id)}
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
          itemLabel="dealers"
        />
      </div>

      <IssueQuantityModal
        isOpen={isIssueModalOpen}
        initialPersonId={selectedDealer || undefined}
        onClose={() => setIsIssueModalOpen(false)}
      />
    </div>
  );
};

