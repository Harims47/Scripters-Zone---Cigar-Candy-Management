import React, { useState, useMemo } from 'react';
import { useHub } from '../../context/HubContext';
import { useToast } from '../../context/ToastContext';
import { TableExportButtons } from '../../components/ui/TableExportButtons';
import { TablePagination } from '../../components/ui/TablePagination';
import { SortableHeader } from '../../components/ui/SortableHeader';
import { TableEmptyState } from '../../components/ui/TableEmptyState';
import { useTableState } from '../../utils/useTableState';
import { exportToCSV, exportToExcel, exportToPDF } from '../../utils/exportHelpers';
import { IssueQuantityModal } from '../../components/modals/IssueQuantityModal';
import {
  ArrowUpRight,
  Search,
  Trash2,
  Users,
  Plus,
  Package,
  Calendar,
  Truck,
  Store,
  X
} from 'lucide-react';

interface QuantityIssuesViewProps {
  onNavigate?: (tab: string) => void;
}

export const QuantityIssuesView: React.FC<QuantityIssuesViewProps> = () => {
  const {
    quantityIssues,
    products,
    deleteQuantityIssue
  } = useHub();

  const toast = useToast();

  const [isIssueModalOpen, setIsIssueModalOpen] = useState<boolean>(false);

  // History Register Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'SALESMAN' | 'DEALER'>('ALL');

  // Summary Metrics
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const totalIssuedValue = useMemo(() => {
    return quantityIssues.reduce((acc, q) => {
      const prod = products.find((p) => p.id === q.productId);
      const rate = prod?.rate || 0;
      return acc + (q.quantityIssued || 0) * rate;
    }, 0);
  }, [quantityIssues, products]);

  const todayIssuesCount = useMemo(() => {
    return quantityIssues.filter((q) => q.date === todayStr).length;
  }, [quantityIssues, todayStr]);

  const salesmanIssuesCount = useMemo(() => {
    return quantityIssues.filter((q) => q.personRole === 'SALESMAN').length;
  }, [quantityIssues]);

  const dealerIssuesCount = useMemo(() => {
    return quantityIssues.filter((q) => q.personRole === 'DEALER').length;
  }, [quantityIssues]);

  // Filtered History
  const filteredIssues = useMemo(() => {
    return quantityIssues.filter((qi) => {
      const matchRole = roleFilter === 'ALL' || qi.personRole === roleFilter;
      const search = searchTerm.trim().toLowerCase();
      const matchSearch =
        !search ||
        qi.personName.toLowerCase().includes(search) ||
        qi.productName.toLowerCase().includes(search) ||
        (qi.sku && qi.sku.toLowerCase().includes(search)) ||
        (qi.subCategory && qi.subCategory.toLowerCase().includes(search)) ||
        qi.brand.toLowerCase().includes(search) ||
        qi.issueNumber.toLowerCase().includes(search);
      return matchRole && matchSearch;
    });
  }, [quantityIssues, roleFilter, searchTerm]);

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
  } = useTableState(filteredIssues, {
    initialPageSize: 10,
    initialSortField: 'date',
    initialSortDirection: 'desc',
    sortExtractors: {
      issueNumber: (q) => q.issueNumber,
      date: (q) => q.date,
      personName: (q) => q.personName,
      personRole: (q) => q.personRole,
      productName: (q) => q.productName,
      quantityIssued: (q) => q.quantityIssued,
      notes: (q) => q.notes || ''
    }
  });

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    resetPage();
  };

  const handleRoleChange = (val: 'ALL' | 'SALESMAN' | 'DEALER') => {
    setRoleFilter(val);
    resetPage();
  };

  // Exports
  const handleExportCSV = () => {
    const headers = ['Issue #', 'Date', 'Recipient', 'Role', 'SKU', 'Product', 'Category', 'Sub Category', 'Brand', 'Qty Issued', 'UOM', 'Notes'];
    const rows = filteredIssues.map((qi) => [
      qi.issueNumber,
      qi.date,
      qi.personName,
      qi.personRole,
      qi.sku || '—',
      qi.productName,
      qi.category,
      qi.subCategory || '—',
      qi.brand,
      qi.quantityIssued,
      qi.uom,
      qi.notes || ''
    ]);
    exportToCSV('quantity_issues', headers, rows);
  };

  const handleExportExcel = () => {
    const headers = ['Issue #', 'Date', 'Recipient', 'Role', 'SKU', 'Product', 'Category', 'Sub Category', 'Brand', 'Qty Issued', 'UOM', 'Notes'];
    const rows = filteredIssues.map((qi) => [
      qi.issueNumber,
      qi.date,
      qi.personName,
      qi.personRole,
      qi.sku || '—',
      qi.productName,
      qi.category,
      qi.subCategory || '—',
      qi.brand,
      qi.quantityIssued,
      qi.uom,
      qi.notes || ''
    ]);
    exportToExcel('quantity_issues', headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ['Issue #', 'Date', 'Recipient', 'Role', 'Product', 'Qty Issued'];
    const rows = filteredIssues.map((q) => [
      q.issueNumber,
      q.date,
      q.personName,
      q.personRole,
      q.productName,
      `${q.quantityIssued}`
    ]);
    exportToPDF('Quantity Issues Register', headers, rows);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: '#ffffff',
          padding: '18px 24px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Issue Stock
          </h2>
          <div style={{ fontSize: '0.84rem', color: '#64748b', marginTop: '3px' }}>
            Issue stock to a salesman or dealer.
          </div>
        </div>

        {/* Primary Action Button: Open Issue Stock Modal */}
        <button
          type="button"
          onClick={() => setIsIssueModalOpen(true)}
          className="btn btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            fontSize: '0.88rem',
            fontWeight: 800,
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
            minHeight: '44px'
          }}
        >
          <Plus size={18} />
          <span>+ Add Issue Stock</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            TOTAL ISSUED VALUE
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
            ₹{totalIssuedValue.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
            Calculated at sales rate
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Today's Issues
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#2563eb', marginTop: '4px' }}>
            {todayIssuesCount} Transactions
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
            Recorded on {todayStr}
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Salesmen Issues
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#4f46e5', marginTop: '4px' }}>
            {salesmanIssuesCount} Records
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
            Field sales staff
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Dealer Issues
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#d97706', marginTop: '4px' }}>
            {dealerIssuesCount} Records
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
            Wholesale dealers
          </div>
        </div>
      </div>

      {/* Register Controls & Table Card */}
      <div className="table-container">
        <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div className="table-search-box" style={{ width: '280px', position: 'relative' }}>
              <Search size={16} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search issues (name, product, #)..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              {searchTerm && (
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

            <select
              className="select-field"
              style={{ width: 'auto', minWidth: '130px', padding: '7px 12px', fontSize: '0.84rem', minHeight: '38px', background: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              value={roleFilter}
              onChange={(e) => handleRoleChange(e.target.value as any)}
            >
              <option value="ALL">All Roles</option>
              <option value="SALESMAN">Salesmen Only</option>
              <option value="DEALER">Dealers Only</option>
            </select>
          </div>

          <TableExportButtons
            onExportCSV={handleExportCSV}
            onExportExcel={handleExportExcel}
            onExportPDF={handleExportPDF}
            disabled={filteredIssues.length === 0}
          />
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <SortableHeader
                  label="Issue #"
                  field="issueNumber"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="Date Issued"
                  field="date"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="Recipient Name"
                  field="personName"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="Role"
                  field="personRole"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="Product"
                  field="productName"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="Quantity Issued"
                  field="quantityIssued"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={toggleSort}
                  align="right"
                />
                <th>Notes</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {pagedData.length === 0 ? (
                <TableEmptyState
                  colSpan={8}
                  title={searchTerm ? 'No matching stock issues' : 'No stock issues recorded'}
                  description={
                    searchTerm
                      ? `No stock issues matched "${searchTerm}".`
                      : 'No quantity stock issues have been recorded yet.'
                  }
                  icon={<Package size={28} />}
                  actionLabel="+ Add Issue Stock"
                  onAction={() => setIsIssueModalOpen(true)}
                />
              ) : (
                pagedData.map((qi) => (
                  <tr key={qi.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#4f46e5' }}>
                      {qi.issueNumber}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: '#64748b' }}>{qi.date}</td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{qi.personName}</td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: qi.personRole === 'SALESMAN' ? '#eff6ff' : '#fef3c7',
                          color: qi.personRole === 'SALESMAN' ? '#1d4ed8' : '#b45309'
                        }}
                      >
                        {qi.personRole}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{qi.productName}</div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {qi.sku} • {qi.brand}
                      </div>
                    </td>
                    <td className="num">
                      <span
                        style={{
                          fontWeight: 800,
                          color: '#0f172a',
                          fontSize: '0.9rem',
                          background: '#f8fafc',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0'
                        }}
                      >
                        {qi.quantityIssued.toLocaleString()}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      {qi.notes || '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn-icon danger"
                        onClick={() => {
                          if (window.confirm(`Delete issue record ${qi.issueNumber}?`)) {
                            deleteQuantityIssue(qi.id);
                            toast.info('Quantity issue deleted.');
                          }
                        }}
                        title="Delete issue record"
                      >
                        <Trash2 size={15} />
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
          pageSize={pageSize}
          totalItems={totalItems}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="issues"
        />
      </div>

      {/* Unified Issue Stock Modal */}
      <IssueQuantityModal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
      />
    </div>
  );
};
