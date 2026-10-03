import React, { useState, useMemo } from 'react';
import { useHub } from '../../context/HubContext';
import { useToast } from '../../context/ToastContext';
import { DailyHandover, HandoverStatus } from '../../types';
import { HandoverEntryForm } from '../../components/handover/HandoverEntryForm';
import { SortableHeader } from '../../components/ui/SortableHeader';
import { TablePagination } from '../../components/ui/TablePagination';
import { TableEmptyState } from '../../components/ui/TableEmptyState';
import { useTableState } from '../../utils/useTableState';
import {
  Receipt,
  User,
  Store,
  Search,
  Eye,
  Trash2,
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Banknote,
  PlusCircle,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { DeleteConfirmModal } from '../../components/modals/DeleteConfirmModal';

export const HandoverHubView: React.FC = () => {
  const { handovers, confirmHandoverCollection, deleteHandover, activeSession } = useHub();
  const toast = useToast();

  // Top Tabs: [ Salesman Handovers ] | [ Dealer Handover ]
  const [activeTab, setActiveTab] = useState<'SALESMAN' | 'DEALER'>('SALESMAN');

  // Sub-tab for Dealer: [ RECORD_SALE ] | [ HISTORY ]
  const [dealerSubTab, setDealerSubTab] = useState<'RECORD_SALE' | 'HISTORY'>('RECORD_SALE');

  // Search and Status filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Review & Collection Modal State (Section 11, 16)
  const [reviewHandover, setReviewHandover] = useState<DailyHandover | null>(null);
  const [reviewCash, setReviewCash] = useState<string>('');
  const [reviewGPay, setReviewGPay] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [showProductDetails, setShowProductDetails] = useState(false);

  // View Details Modal State (Audit inspection)
  const [viewHandover, setViewHandover] = useState<DailyHandover | null>(null);

  // Today's date string
  const todayStr = new Date().toISOString().split('T')[0];

  // Group handovers by type
  const salesmanHandovers = useMemo(() => handovers.filter((h) => h.type === 'SALESMAN'), [handovers]);
  const dealerHandovers = useMemo(() => handovers.filter((h) => h.type === 'DEALER'), [handovers]);

  // Operational metrics for summary banner (Section 21)
  const todaySalesmanHandovers = salesmanHandovers.filter((h) => h.date === todayStr);
  const submittedCount = salesmanHandovers.filter((h) => h.status === 'SUBMITTED').length;
  const collectedCount = salesmanHandovers.filter((h) => h.status === 'COLLECTED' || h.status === 'SETTLED').length;
  const shortCount = salesmanHandovers.filter((h) => h.status === 'SHORT' || (h.outstanding > 0 && h.status !== 'SUBMITTED')).length;
  const dealerCompletedCount = dealerHandovers.filter((h) => h.status === 'COMPLETED' || h.status === 'SETTLED').length;

  // Filtered lists
  const filteredSalesmanHandovers = useMemo(() => {
    return salesmanHandovers.filter((h) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        h.personName.toLowerCase().includes(q) ||
        h.handoverNumber.toLowerCase().includes(q);

      let matchesStatus = true;
      if (statusFilter === 'SUBMITTED') matchesStatus = h.status === 'SUBMITTED';
      else if (statusFilter === 'COLLECTED') matchesStatus = h.status === 'COLLECTED' || h.status === 'SETTLED';
      else if (statusFilter === 'SHORT') matchesStatus = h.status === 'SHORT' || ((h.outstanding || 0) > 0 && h.status !== 'SUBMITTED');
      else if (statusFilter === 'EXCESS') matchesStatus = h.status === 'EXCESS' || ((h.excess || 0) > 0);

      return matchesSearch && matchesStatus;
    });
  }, [salesmanHandovers, searchQuery, statusFilter]);

  const filteredDealerHandovers = useMemo(() => {
    return dealerHandovers.filter((h) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        h.personName.toLowerCase().includes(q) ||
        h.handoverNumber.toLowerCase().includes(q) ||
        (h.customerName && h.customerName.toLowerCase().includes(q))
      );
    });
  }, [dealerHandovers, searchQuery]);

  const salesmanTable = useTableState(filteredSalesmanHandovers, {
    initialPageSize: 10,
    initialSortField: 'date',
    initialSortDirection: 'desc',
    sortExtractors: {
      handoverNumber: (h) => h.handoverNumber,
      date: (h) => h.date,
      personName: (h) => h.personName,
      expected: (h) => h.expectedHandover ?? h.totalExpected,
      cashReceived: (h) => h.cashReceived || 0,
      gpayReceived: (h) => h.gpayReceived || 0,
      amountReceived: (h) => h.amountReceived || 0,
      status: (h) => h.status,
      collectedBy: (h) => h.collectedBy || ''
    }
  });

  const dealerTable = useTableState(filteredDealerHandovers, {
    initialPageSize: 10,
    initialSortField: 'date',
    initialSortDirection: 'desc',
    sortExtractors: {
      handoverNumber: (h) => h.handoverNumber,
      date: (h) => h.date,
      personName: (h) => h.personName,
      netSales: (h) => h.netSales,
      expected: (h) => h.expectedHandover ?? h.totalExpected,
      cashReceived: (h) => h.cashReceived || 0,
      gpayReceived: (h) => h.gpayReceived || 0,
      amountReceived: (h) => h.amountReceived || 0,
      status: (h) => h.status
    }
  });

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    salesmanTable.resetPage();
    dealerTable.resetPage();
  };

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    salesmanTable.resetPage();
  };


  // Open compact collection review panel
  const handleOpenReview = (h: DailyHandover) => {
    setReviewHandover(h);
    // Pre-fill existing collection if already partially recorded
    setReviewCash(h.cashReceived !== undefined ? String(h.cashReceived) : '');
    setReviewGPay(h.gpayReceived !== undefined ? String(h.gpayReceived) : '');
    setReviewNotes('');
    setShowProductDetails(false);
  };

  // Confirm Collection (Section 11, 13, 16)
  const handleConfirmCollection = () => {
    if (!reviewHandover) return;

    const cash = Math.max(0, parseFloat(reviewCash) || 0);
    const gpay = Math.max(0, parseFloat(reviewGPay) || 0);
    const total = cash + gpay;

    const expected = reviewHandover.expectedHandover ?? reviewHandover.totalExpected;

    const updated = confirmHandoverCollection(reviewHandover.id, {
      cashReceived: cash,
      gpayReceived: gpay,
      notes: reviewNotes.trim() || undefined,
      adminName: activeSession.name || 'Admin'
    });

    if (updated) {
      if (updated.status === 'SHORT') {
        toast.error(`Collection confirmed: ₹${total.toLocaleString('en-IN')}. Shortage of ₹${updated.outstanding.toLocaleString('en-IN')} posted to ${reviewHandover.personName}'s ledger.`);
      } else if (updated.status === 'EXCESS') {
        toast.success(`Collection confirmed: ₹${total.toLocaleString('en-IN')} (Excess ₹${(updated.excess || 0).toLocaleString('en-IN')}).`);
      } else {
        toast.success(`Collection confirmed: ₹${total.toLocaleString('en-IN')} (Settled in full).`);
      }
    }

    setReviewHandover(null);
  };

  // Quick fill expected into cash or gpay
  const handleQuickFillExpected = (method: 'CASH' | 'GPAY') => {
    if (!reviewHandover) return;
    const expected = reviewHandover.expectedHandover ?? reviewHandover.totalExpected;
    if (method === 'CASH') {
      setReviewCash(String(expected));
      setReviewGPay('0');
    } else {
      setReviewGPay(String(expected));
      setReviewCash('0');
    }
  };

  const reviewTotalCollected = (parseFloat(reviewCash) || 0) + (parseFloat(reviewGPay) || 0);
  const reviewExpected = reviewHandover ? (reviewHandover.expectedHandover ?? reviewHandover.totalExpected) : 0;
  const reviewDiff = reviewExpected - reviewTotalCollected;

  return (
    <div className="handover-hub-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            Daily Handover
          </h1>
          <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
            Salesman sheet collection queue, split payment verification, and direct dealer transactions.
          </p>
        </div>
      </div>

      {/* Main Tabs (Section 4) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '2px solid #e2e8f0', paddingBottom: '6px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={`btn ${activeTab === 'SALESMAN' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => setActiveTab('SALESMAN')}
          >
            <User size={16} />
            <span>Salesman Handovers</span>
            {submittedCount > 0 && (
              <span
                style={{
                  background: '#f59e0b',
                  color: '#ffffff',
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  padding: '2px 7px',
                  borderRadius: '12px'
                }}
              >
                {submittedCount}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'DEALER' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => setActiveTab('DEALER')}
          >
            <Store size={16} />
            <span>Dealer Handover</span>
          </button>
        </div>

        {/* Search bar */}
        <div style={{ position: 'relative', width: '240px' }}>
          <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '9px' }} />
          <input
            type="text"
            className="input-field"
            style={{ paddingLeft: '32px', paddingRight: '28px', fontSize: '0.82rem' }}
            placeholder={activeTab === 'SALESMAN' ? 'Search salesman or number...' : 'Search dealer or customer...'}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
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
      </div>

      {/* ================= TAB 1: SALESMAN HANDOVERS ================= */}
      {activeTab === 'SALESMAN' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Section 22: ADMIN "NEEDS ACTION" QUEUE */}
          <div
            style={{
              background: '#ffffff',
              border: submittedCount > 0 ? '1.5px solid #fde047' : '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '16px 20px',
              boxShadow: submittedCount > 0 ? '0 4px 14px rgba(234, 179, 8, 0.08)' : '0 2px 6px rgba(15, 23, 42, 0.03)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color={submittedCount > 0 ? '#b45309' : '#64748b'} />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  NEEDS ACTION — AWAITING COLLECTION
                </h3>
                {submittedCount > 0 && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', background: '#fef3c7', color: '#b45309' }}>
                    {submittedCount} Pending
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Salesmen have submitted these sheets. Collect Cash & GPay to complete.
              </span>
            </div>

            {salesmanHandovers.filter((h) => h.status === 'SUBMITTED').length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: '0.86rem', background: '#f8fafc', borderRadius: '10px' }}>
                <CheckCircle2 size={24} color="#059669" style={{ margin: '0 auto 6px' }} />
                <div>All salesman handovers have been collected! No pending submissions.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
                {salesmanHandovers
                  .filter((h) => h.status === 'SUBMITTED')
                  .map((h) => (
                    <div
                      key={h.id}
                      style={{
                        background: '#fffdf5',
                        border: '1px solid #fef08a',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>{h.personName}</div>
                          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                            {h.handoverNumber} • {h.date}
                          </div>
                        </div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: '#fef3c7', color: '#b45309' }}>
                          SUBMITTED
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fef3c7' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>EXPECTED HANDOVER</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1d4ed8', marginTop: '1px' }}>
                            ₹{(h.expectedHandover ?? h.totalExpected).toLocaleString('en-IN')}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{
                            padding: '8px 16px',
                            fontWeight: 800,
                            fontSize: '0.84rem',
                            background: '#059669',
                            borderColor: '#059669',
                            boxShadow: '0 2px 6px rgba(5, 150, 105, 0.2)'
                          }}
                          onClick={() => handleOpenReview(h)}
                        >
                          <Banknote size={15} />
                          <span>Review & Collect</span>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Section 10 & 26: SALESMAN HANDOVERS REGISTER / HISTORY */}
          <div className="table-container">
            <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', width: '100%', marginBottom: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                Salesman Handover Register ({filteredSalesmanHandovers.length})
              </div>

              {/* Status Filters */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {['ALL', 'SUBMITTED', 'COLLECTED', 'SHORT', 'EXCESS'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: statusFilter === st ? '1px solid #4f46e5' : '1px solid #e2e8f0',
                      background: statusFilter === st ? '#e0e7ff' : '#f8fafc',
                      color: statusFilter === st ? '#4338ca' : '#64748b'
                    }}
                    onClick={() => handleStatusFilterChange(st)}
                  >
                    {st === 'ALL' ? 'All' : st}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table" style={{ width: '100%', minWidth: '850px' }}>
                <thead>
                  <tr>
                    <SortableHeader
                      label="Handover #"
                      field="handoverNumber"
                      currentSortField={salesmanTable.sortField}
                      currentSortDirection={salesmanTable.sortDirection}
                      onSort={salesmanTable.toggleSort}
                      style={{ padding: '12px 14px' }}
                    />
                    <SortableHeader
                      label="Date"
                      field="date"
                      currentSortField={salesmanTable.sortField}
                      currentSortDirection={salesmanTable.sortDirection}
                      onSort={salesmanTable.toggleSort}
                      style={{ padding: '12px 10px' }}
                    />
                    <SortableHeader
                      label="Salesman"
                      field="personName"
                      currentSortField={salesmanTable.sortField}
                      currentSortDirection={salesmanTable.sortDirection}
                      onSort={salesmanTable.toggleSort}
                      style={{ padding: '12px 10px' }}
                    />
                    <SortableHeader
                      label="Expected"
                      field="expected"
                      currentSortField={salesmanTable.sortField}
                      currentSortDirection={salesmanTable.sortDirection}
                      onSort={salesmanTable.toggleSort}
                      align="right"
                      style={{ padding: '12px 10px' }}
                    />
                    <SortableHeader
                      label="Cash"
                      field="cashReceived"
                      currentSortField={salesmanTable.sortField}
                      currentSortDirection={salesmanTable.sortDirection}
                      onSort={salesmanTable.toggleSort}
                      align="right"
                      style={{ padding: '12px 10px' }}
                    />
                    <SortableHeader
                      label="GPay"
                      field="gpayReceived"
                      currentSortField={salesmanTable.sortField}
                      currentSortDirection={salesmanTable.sortDirection}
                      onSort={salesmanTable.toggleSort}
                      align="right"
                      style={{ padding: '12px 10px' }}
                    />
                    <SortableHeader
                      label="Total Collected"
                      field="amountReceived"
                      currentSortField={salesmanTable.sortField}
                      currentSortDirection={salesmanTable.sortDirection}
                      onSort={salesmanTable.toggleSort}
                      align="right"
                      style={{ padding: '12px 10px' }}
                    />
                    <SortableHeader
                      label="Status"
                      field="status"
                      currentSortField={salesmanTable.sortField}
                      currentSortDirection={salesmanTable.sortDirection}
                      onSort={salesmanTable.toggleSort}
                      align="center"
                      style={{ padding: '12px 10px' }}
                    />
                    <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {salesmanTable.pagedData.length === 0 ? (
                    <TableEmptyState
                      colSpan={9}
                      title="No salesman handovers found"
                      description={
                        searchQuery
                          ? `No handovers match "${searchQuery}".`
                          : 'No salesman handovers found matching filter criteria.'
                      }
                      icon={<Receipt size={28} />}
                    />
                  ) : (
                    salesmanTable.pagedData.map((h) => (
                      <tr key={h.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 800, color: '#4f46e5' }}>
                          {h.handoverNumber}
                        </td>
                        <td style={{ padding: '12px 10px', color: '#64748b', fontWeight: 600 }}>
                          {h.date}
                        </td>
                        <td style={{ padding: '12px 10px', fontWeight: 700, color: '#0f172a' }}>
                          {h.personName}
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 800, color: '#1d4ed8' }}>
                          ₹{(h.expectedHandover ?? h.totalExpected).toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'right', color: '#475569' }}>
                          {h.status === 'SUBMITTED' ? '—' : `₹${(h.cashReceived || 0).toLocaleString('en-IN')}`}
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'right', color: '#475569' }}>
                          {h.status === 'SUBMITTED' ? '—' : `₹${(h.gpayReceived || 0).toLocaleString('en-IN')}`}
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                          {h.status === 'SUBMITTED' ? '—' : `₹${h.amountReceived.toLocaleString('en-IN')}`}
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                          {h.status === 'SUBMITTED' ? (
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: '#fef3c7', color: '#b45309' }}>
                              SUBMITTED
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
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            {h.status === 'SUBMITTED' ? (
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ padding: '4px 10px', fontSize: '0.76rem', fontWeight: 800, background: '#059669', borderColor: '#059669' }}
                                onClick={() => handleOpenReview(h)}
                              >
                                Review
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '0.76rem' }}
                                onClick={() => setViewHandover(h)}
                                title="View Handover"
                              >
                                <Eye size={13} />
                                <span>View</span>
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '4px 6px', color: '#ef4444' }}
                              onClick={() => {
                                setDeleteTarget({ id: h.id, name: `handover ${h.handoverNumber}` });
                              }}
                              title="Delete record"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <TablePagination
              currentPage={salesmanTable.currentPage}
              pageSize={salesmanTable.pageSize}
              totalItems={salesmanTable.totalItems}
              totalPages={salesmanTable.totalPages}
              onPageChange={salesmanTable.setCurrentPage}
              onPageSizeChange={salesmanTable.setPageSize}
              itemLabel="handovers"
            />
          </div>
        </div>
      )}

      {/* ================= TAB 2: DEALER HANDOVER ================= */}
      {activeTab === 'DEALER' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Sub-Tabs: [ Record Dealer Sale ] | [ History ] */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={`btn ${dealerSubTab === 'RECORD_SALE' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontWeight: 700, fontSize: '0.84rem' }}
                onClick={() => setDealerSubTab('RECORD_SALE')}
              >
                <PlusCircle size={15} />
                <span>Record Dealer Sale</span>
              </button>
              <button
                type="button"
                className={`btn ${dealerSubTab === 'HISTORY' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontWeight: 700, fontSize: '0.84rem' }}
                onClick={() => setDealerSubTab('HISTORY')}
              >
                <FileText size={15} />
                <span>Dealer History ({dealerHandovers.length})</span>
              </button>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Admin-only direct dealer transactions. Dealers do not have separate logins.
            </div>
          </div>

          {dealerSubTab === 'RECORD_SALE' ? (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
              <HandoverEntryForm
                initialType="DEALER"
                onSuccess={() => setDealerSubTab('HISTORY')}
              />
            </div>
          ) : (
            <div className="table-container">
              <div className="table-responsive">
                <table className="data-table" style={{ width: '100%', minWidth: '850px' }}>
                  <thead>
                    <tr>
                      <SortableHeader
                        label="Handover #"
                        field="handoverNumber"
                        currentSortField={dealerTable.sortField}
                        currentSortDirection={dealerTable.sortDirection}
                        onSort={dealerTable.toggleSort}
                        style={{ padding: '12px 14px' }}
                      />
                      <SortableHeader
                        label="Date"
                        field="date"
                        currentSortField={dealerTable.sortField}
                        currentSortDirection={dealerTable.sortDirection}
                        onSort={dealerTable.toggleSort}
                        style={{ padding: '12px 10px' }}
                      />
                      <SortableHeader
                        label="Dealer"
                        field="personName"
                        currentSortField={dealerTable.sortField}
                        currentSortDirection={dealerTable.sortDirection}
                        onSort={dealerTable.toggleSort}
                        style={{ padding: '12px 10px' }}
                      />
                      <SortableHeader
                        label="Net Sales"
                        field="netSales"
                        currentSortField={dealerTable.sortField}
                        currentSortDirection={dealerTable.sortDirection}
                        onSort={dealerTable.toggleSort}
                        align="right"
                        style={{ padding: '12px 10px' }}
                      />
                      <SortableHeader
                        label="Expected"
                        field="expected"
                        currentSortField={dealerTable.sortField}
                        currentSortDirection={dealerTable.sortDirection}
                        onSort={dealerTable.toggleSort}
                        align="right"
                        style={{ padding: '12px 10px' }}
                      />
                      <SortableHeader
                        label="Cash"
                        field="cashReceived"
                        currentSortField={dealerTable.sortField}
                        currentSortDirection={dealerTable.sortDirection}
                        onSort={dealerTable.toggleSort}
                        align="right"
                        style={{ padding: '12px 10px' }}
                      />
                      <SortableHeader
                        label="GPay"
                        field="gpayReceived"
                        currentSortField={dealerTable.sortField}
                        currentSortDirection={dealerTable.sortDirection}
                        onSort={dealerTable.toggleSort}
                        align="right"
                        style={{ padding: '12px 10px' }}
                      />
                      <SortableHeader
                        label="Total Collected"
                        field="amountReceived"
                        currentSortField={dealerTable.sortField}
                        currentSortDirection={dealerTable.sortDirection}
                        onSort={dealerTable.toggleSort}
                        align="right"
                        style={{ padding: '12px 10px' }}
                      />
                      <SortableHeader
                        label="Status"
                        field="status"
                        currentSortField={dealerTable.sortField}
                        currentSortDirection={dealerTable.sortDirection}
                        onSort={dealerTable.toggleSort}
                        align="center"
                        style={{ padding: '12px 10px' }}
                      />
                      <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dealerTable.pagedData.length === 0 ? (
                      <TableEmptyState
                        colSpan={10}
                        title="No dealer handovers found"
                        description={
                          searchQuery
                            ? `No dealer handovers match "${searchQuery}".`
                            : 'No dealer handovers recorded yet. Click "Record Dealer Sale" above to enter one.'
                        }
                        icon={<Store size={28} />}
                      />
                    ) : (
                      dealerTable.pagedData.map((h) => (
                        <tr key={h.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 800, color: '#4f46e5' }}>
                            {h.handoverNumber}
                          </td>
                          <td style={{ padding: '12px 10px', color: '#64748b', fontWeight: 600 }}>
                            {h.date}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{h.personName}</div>
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                            ₹{h.netSales.toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                            ₹{(h.expectedHandover ?? h.totalExpected).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'right', color: '#475569' }}>
                            ₹{(h.cashReceived || 0).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'right', color: '#475569' }}>
                            ₹{(h.gpayReceived || 0).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                            ₹{h.amountReceived.toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: '#ecfdf5', color: '#047857' }}>
                              COMPLETED
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '0.76rem' }}
                                onClick={() => setViewHandover(h)}
                              >
                                <Eye size={13} />
                                <span>View</span>
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '4px 6px', color: '#ef4444' }}
                                onClick={() => {
                                  setDeleteTarget({ id: h.id, name: `dealer handover ${h.handoverNumber}` });
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <TablePagination
                currentPage={dealerTable.currentPage}
                pageSize={dealerTable.pageSize}
                totalItems={dealerTable.totalItems}
                totalPages={dealerTable.totalPages}
                onPageChange={dealerTable.setCurrentPage}
                onPageSizeChange={dealerTable.setPageSize}
                itemLabel="handovers"
              />
            </div>
          )}
        </div>
      )}

      {/* ================= COMPACT COLLECTION REVIEW MODAL (Section 11, 16) ================= */}
      {reviewHandover && (
        <div className="modal-backdrop" onClick={() => setReviewHandover(null)}>
          <div
            className="modal-content"
            style={{
              maxWidth: '520px',
              width: '92%',
              borderRadius: '16px',
              padding: 0,
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', background: '#0f172a', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>Review & Collect Handover</div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                  {reviewHandover.personName} • {reviewHandover.date} • {reviewHandover.handoverNumber}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReviewHandover(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Salesman Submission Summary Box */}
              <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>SALESMAN EXPECTED HANDOVER</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: '#fef3c7', color: '#b45309' }}>
                    {reviewHandover.status}
                  </span>
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#1d4ed8' }}>
                  ₹{reviewExpected.toLocaleString('en-IN')}
                </div>
                <div style={{ display: 'flex', gap: '14px', fontSize: '0.78rem', color: '#64748b', marginTop: '6px' }}>
                  <span>Net Sales: ₹{reviewHandover.netSales.toLocaleString('en-IN')}</span>
                  {reviewHandover.emptyPocketBenefit > 0 && <span>Packets: -₹{reviewHandover.emptyPocketBenefit.toLocaleString('en-IN')}</span>}
                  {reviewHandover.couponBenefit > 0 && <span>Coupons: -₹{reviewHandover.couponBenefit.toLocaleString('en-IN')}</span>}
                </div>

                {/* Collapsible toggle for product table */}
                <button
                  type="button"
                  style={{
                    marginTop: '10px',
                    background: 'transparent',
                    border: 'none',
                    color: '#4f46e5',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  onClick={() => setShowProductDetails(!showProductDetails)}
                >
                  <span>{showProductDetails ? 'Hide Products Sheet' : `View Products Sheet (${reviewHandover.items.length} items)`}</span>
                  {showProductDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showProductDetails && (
                  <div style={{ marginTop: '10px', maxHeight: '160px', overflowY: 'auto', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                    <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ color: '#64748b', textAlign: 'left' }}>
                          <th>Product</th>
                          <th style={{ textAlign: 'center' }}>Sold</th>
                          <th style={{ textAlign: 'right' }}>Rate</th>
                          <th style={{ textAlign: 'right' }}>Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewHandover.items.map((it) => (
                          <tr key={it.productId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 0', fontWeight: 600 }}>{it.productName}</td>
                            <td style={{ padding: '4px 0', textAlign: 'center' }}>{it.sales}</td>
                            <td style={{ padding: '4px 0', textAlign: 'right' }}>₹{it.rate}</td>
                            <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 700 }}>₹{it.netAmount.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Compact Collection Input Section (Section 11, 16) */}
              <div style={{ background: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: '12px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    RECORD ACTUAL COLLECTION
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0', cursor: 'pointer', fontWeight: 700 }}
                      onClick={() => handleQuickFillExpected('CASH')}
                    >
                      Fill All Cash
                    </button>
                    <button
                      type="button"
                      style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0', cursor: 'pointer', fontWeight: 700 }}
                      onClick={() => handleQuickFillExpected('GPAY')}
                    >
                      Fill All GPay
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#065f46', display: 'block', marginBottom: '4px' }}>
                      Cash Received (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      className="input-field"
                      style={{ width: '100%', fontWeight: 800, fontSize: '1.1rem', borderColor: '#a7f3d0' }}
                      placeholder="0.00"
                      value={reviewCash}
                      onChange={(e) => setReviewCash(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#065f46', display: 'block', marginBottom: '4px' }}>
                      GPay Received (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      className="input-field"
                      style={{ width: '100%', fontWeight: 800, fontSize: '1.1rem', borderColor: '#a7f3d0' }}
                      placeholder="0.00"
                      value={reviewGPay}
                      onChange={(e) => setReviewGPay(e.target.value)}
                    />
                  </div>
                </div>

                {/* Live Reconciliation Calculation */}
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #a7f3d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#065f46', fontWeight: 700 }}>TOTAL RECEIVED</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#047857' }}>
                      ₹{reviewTotalCollected.toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.72rem', color: reviewDiff > 0 ? '#b91c1c' : '#047857', fontWeight: 700 }}>
                      {reviewDiff > 0 ? 'SHORTFALL' : reviewDiff < 0 ? 'EXCESS' : 'STATUS'}
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: reviewDiff > 0 ? '#dc2626' : '#047857' }}>
                      {reviewDiff > 0
                        ? `SHORT ₹${reviewDiff.toLocaleString('en-IN')}`
                        : reviewDiff < 0
                        ? `EXCESS ₹${Math.abs(reviewDiff).toLocaleString('en-IN')}`
                        : 'COLLECTED'}
                    </div>
                  </div>
                </div>

                {reviewDiff > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '0.74rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={13} />
                    <span>Difference of ₹{reviewDiff.toLocaleString('en-IN')} will be posted to {reviewHandover.personName}'s Outstanding Ledger.</span>
                  </div>
                )}
              </div>

              {/* Optional Notes */}
              <div>
                <label style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Admin Collection Remarks (Optional)
                </label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%', fontSize: '0.84rem' }}
                  placeholder="e.g. Cash verified by cashier..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>

              {/* Confirm / Cancel Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '10px' }}
                  onClick={() => setReviewHandover(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{
                    flex: 2,
                    padding: '10px',
                    fontWeight: 800,
                    background: '#059669',
                    borderColor: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onClick={handleConfirmCollection}
                >
                  <CheckCircle2 size={16} />
                  <span>Confirm Collection</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW HANDOVER AUDIT BREAKDOWN MODAL ================= */}
      {viewHandover && (
        <div className="modal-backdrop" onClick={() => setViewHandover(null)}>
          <div
            className="modal-content"
            style={{
              maxWidth: '680px',
              width: '92%',
              borderRadius: '16px',
              padding: 0,
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '16px 20px', background: '#0f172a', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>Handover Audit: {viewHandover.handoverNumber}</div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                  {viewHandover.personName} • {viewHandover.date} • Type: {viewHandover.type}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewHandover(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              {/* Product Sheet Table */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>
                  WHAT {viewHandover.type === 'SALESMAN' ? 'SALESMAN SUBMITTED' : 'WAS RECORDED'} (ITEMS)
                </div>
                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>Product</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center' }}>Opening</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center' }}>Closing</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center' }}>Sales</th>
                        <th style={{ padding: '8px 6px', textAlign: 'center' }}>Free</th>
                        <th style={{ padding: '8px 8px', textAlign: 'right' }}>Rate</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Net Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewHandover.items.map((it) => (
                        <tr key={it.productId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '7px 10px', fontWeight: 700 }}>{it.productName}</td>
                          <td style={{ padding: '7px 6px', textAlign: 'center' }}>{it.opening}</td>
                          <td style={{ padding: '7px 6px', textAlign: 'center' }}>{it.closing}</td>
                          <td style={{ padding: '7px 6px', textAlign: 'center', fontWeight: 800, color: '#059669' }}>{it.sales}</td>
                          <td style={{ padding: '7px 6px', textAlign: 'center', color: '#d97706' }}>{it.free}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'right' }}>₹{it.rate}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 800 }}>₹{it.netAmount.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary Metrics */}
              <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Net Sales</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800 }}>₹{viewHandover.netSales.toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#ea580c' }}>Empty Packet</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ea580c' }}>-₹{(viewHandover.emptyPocketBenefit ?? viewHandover.emptyPocketAmount).toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#d97706' }}>Coupon</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#d97706' }}>-₹{(viewHandover.couponBenefit ?? viewHandover.couponAmount).toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#1d4ed8', fontWeight: 700 }}>Expected Handover</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#1d4ed8' }}>₹{(viewHandover.expectedHandover ?? viewHandover.totalExpected).toLocaleString('en-IN')}</div>
                </div>
              </div>

              {/* Section 27 & 28: Admin Collection Audit Block */}
              <div style={{ background: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: '12px', padding: '14px 16px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#065f46', marginBottom: '8px', textTransform: 'uppercase' }}>
                  ADMIN COLLECTION RECORD (AUDIT)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#065f46' }}>Cash Received</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#047857' }}>
                      ₹{(viewHandover.cashReceived || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#065f46' }}>GPay Received</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#047857' }}>
                      ₹{(viewHandover.gpayReceived || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#065f46' }}>Total Collected</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#047857' }}>
                      ₹{viewHandover.amountReceived.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#065f46' }}>Collection Status</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 900, color: viewHandover.status === 'SHORT' ? '#dc2626' : '#047857' }}>
                      {viewHandover.status}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #a7f3d0', display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: '#065f46' }}>
                  <span>Verified by: <strong>{viewHandover.collectedBy || 'Admin'}</strong></span>
                  {viewHandover.collectedAt && <span>Timestamp: {new Date(viewHandover.collectedAt).toLocaleString('en-IN')}</span>}
                </div>
              </div>

              {viewHandover.notes && (
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px' }}>
                  Remarks: {viewHandover.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteHandover(deleteTarget.id);
            toast.info(`Deleted ${deleteTarget.name}`);
            setDeleteTarget(null);
          }
        }}
        itemName={deleteTarget ? deleteTarget.name : ''}
      />
    </div>
  );
};
