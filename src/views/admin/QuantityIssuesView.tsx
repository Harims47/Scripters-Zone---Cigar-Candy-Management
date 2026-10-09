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
import { DeleteConfirmModal } from '../../components/modals/DeleteConfirmModal';
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
  Eye,
  X
} from 'lucide-react';
import { QuantityIssue } from '../../types';

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
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; issueNumber: string } | null>(null);
  const [viewingIssue, setViewingIssue] = useState<QuantityIssue | null>(null);

  // History Register Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'SALESMAN' | 'DEALER'>('ALL');

  // Summary Metrics
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const totalIssuedValue = useMemo(() => {
    return quantityIssues.reduce((acc, q) => {
      if (q.totalValue !== undefined) return acc + q.totalValue;
      if (q.items && q.items.length > 0) {
        return acc + q.items.reduce((s, it) => s + (it.totalValue || (it.quantityIssued * (it.rate || 0))), 0);
      }
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
      if (!search) return matchRole;
      const matchHeader =
        qi.personName.toLowerCase().includes(search) ||
        qi.issueNumber.toLowerCase().includes(search) ||
        (qi.notes && qi.notes.toLowerCase().includes(search));
      const matchItems =
        qi.items?.some((it) =>
          it.productName.toLowerCase().includes(search) ||
          (it.sku && it.sku.toLowerCase().includes(search)) ||
          (it.brand && it.brand.toLowerCase().includes(search)) ||
          (it.category && it.category.toLowerCase().includes(search))
        ) || (qi.productName && qi.productName.toLowerCase().includes(search));
      return matchRole && (matchHeader || matchItems);
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
      quantityIssued: (q) => q.totalQuantity || q.quantityIssued || 0,
      totalValue: (q) => q.totalValue || 0,
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
                <th>Products Issued</th>
                <SortableHeader
                  label="Total Quantity"
                  field="quantityIssued"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={toggleSort}
                  align="right"
                />
                <SortableHeader
                  label="Total Value"
                  field="totalValue"
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
                  colSpan={9}
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
                pagedData.map((qi) => {
                  const itemCount = qi.items?.length || 1;
                  const isMulti = itemCount > 1;

                  return (
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
                        {isMulti ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span
                                style={{
                                  background: '#e0e7ff',
                                  color: '#4338ca',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.76rem',
                                  fontWeight: 800,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  cursor: 'pointer'
                                }}
                                onClick={() => setViewingIssue(qi)}
                                title="Click to view all products"
                              >
                                <Package size={13} /> {itemCount} Products
                              </span>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '3px' }}>
                              {qi.items.slice(0, 2).map((it) => `${it.productName} (${it.quantityIssued})`).join(', ')}
                              {itemCount > 2 && ` +${itemCount - 2} more`}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>
                              {qi.items?.[0]?.productName || qi.productName}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                              {qi.items?.[0]?.sku || qi.sku || '—'} • {qi.items?.[0]?.uom || qi.uom}
                            </div>
                          </div>
                        )}
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
                          {(qi.totalQuantity || qi.quantityIssued || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="num" style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
                        ₹{(qi.totalValue || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {qi.notes || '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => setViewingIssue(qi)}
                            title="View itemized breakdown"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon danger"
                            onClick={() => {
                              setDeleteTarget({ id: qi.id, issueNumber: qi.issueNumber });
                            }}
                            title="Delete issue transaction"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteQuantityIssue(deleteTarget.id);
            toast.info('Quantity issue deleted.');
            setDeleteTarget(null);
          }
        }}
        itemName={deleteTarget ? `issue record ${deleteTarget.issueNumber}` : ''}
      />

      {/* Itemized Issue Details Breakdown Modal */}
      {viewingIssue && (
        <div className="modal-backdrop" onClick={() => setViewingIssue(null)}>
          <div
            className="modal-content"
            style={{
              maxWidth: '720px',
              width: '95vw',
              maxHeight: '90vh',
              padding: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '16px',
              background: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.45)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '16px 20px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                  Issue Transaction: {viewingIssue.issueNumber}
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#c7d2fe', marginTop: '3px' }}>
                  {viewingIssue.personName} ({viewingIssue.personRole}) • Date: {viewingIssue.date}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingIssue(null)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Product</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>SKU / Category</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>UOM</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Qty Issued</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Rate (₹)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewingIssue.items && viewingIssue.items.length > 0 ? viewingIssue.items : [{
                    id: viewingIssue.id,
                    productId: viewingIssue.productId,
                    productName: viewingIssue.productName,
                    sku: viewingIssue.sku,
                    category: viewingIssue.category,
                    brand: viewingIssue.brand,
                    uom: viewingIssue.uom,
                    quantityIssued: viewingIssue.quantityIssued,
                    rate: 0,
                    totalValue: viewingIssue.totalValue
                  }]).map((it, idx) => (
                    <tr key={it.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>{it.productName}</td>
                      <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '0.78rem' }}>
                        {it.sku ? `${it.sku} • ` : ''}{it.brand || it.category}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.74rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                          {it.uom}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                        {it.quantityIssued.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>
                        ₹{(it.rate || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                        ₹{(it.totalValue || (it.quantityIssued * (it.rate || 0))).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid #e2e8f0' }}>
                    <td colSpan={3} style={{ padding: '12px', color: '#334155' }}>
                      Transaction Total ({viewingIssue.items?.length || 1} {viewingIssue.items?.length === 1 ? 'Product' : 'Products'})
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#0f172a', fontSize: '0.92rem' }}>
                      {(viewingIssue.totalQuantity || viewingIssue.quantityIssued || 0).toLocaleString()}
                    </td>
                    <td></td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#059669', fontSize: '0.92rem' }}>
                      ₹{(viewingIssue.totalValue || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {viewingIssue.notes && (
                <div style={{ marginTop: '16px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#64748b' }}>
                  <strong>Notes / Route:</strong> {viewingIssue.notes}
                </div>
              )}
            </div>

            <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewingIssue(null)}
                style={{ minHeight: '38px', padding: '0 18px', fontWeight: 600 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
