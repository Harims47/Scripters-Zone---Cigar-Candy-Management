import React, { useState, useMemo } from 'react';
import { useHub } from '../../context/HubContext';
import { useToast } from '../../context/ToastContext';
import { LedgerTransactionType, SalesmanLedgerEntry } from '../../types';
import {
  Wallet,
  PlusCircle,
  Calendar,
  Filter,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  User,
  X,
  Search
} from 'lucide-react';
import { TablePagination } from '../../components/ui/TablePagination';
import { SortableHeader } from '../../components/ui/SortableHeader';
import { TableEmptyState } from '../../components/ui/TableEmptyState';
import { useTableState } from '../../utils/useTableState';

export const SalesmanLedgerView: React.FC = () => {
  const { persons, salesmanLedger, advances, addAdvance, addLedgerEntry, getSalesmanLedgerBalance } = useHub();
  const toast = useToast();

  const salesmen = useMemo(() => persons.filter((p) => p.role === 'SALESMAN'), [persons]);
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<string>(salesmen[0]?.id || '');

  // Date Range Filter (Section 9: From Date and To Date)
  const [fromDate, setFromDate] = useState<string>('2026-09-01');
  const [toDate, setToDate] = useState<string>('2026-09-30');

  // Advance Modal State
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advSalesmanId, setAdvSalesmanId] = useState<string>(salesmen[0]?.id || '');
  const [advAmount, setAdvAmount] = useState<number | string>(1000);
  const [advDate, setAdvDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [advReason, setAdvReason] = useState<string>('Route Travel & Fuel Advance');
  const [advNotes, setAdvNotes] = useState<string>('');

  // Manual Recovery / Adjustment Modal State
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [recSalesmanId, setRecSalesmanId] = useState<string>(salesmen[0]?.id || '');
  const [recAmount, setRecAmount] = useState<number | string>(500);
  const [recDate, setRecDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [recType, setRecType] = useState<'RECOVERY' | 'MANUAL_ADJUSTMENT'>('RECOVERY');
  const [recRef, setRecRef] = useState<string>('');
  const [recNotes, setRecNotes] = useState<string>('Cash counter direct recovery');

  const selectedSalesman = salesmen.find((s) => s.id === selectedSalesmanId);

  // All entries for selected salesman across all time with progressive running balance
  const allSalesmanEntries = useMemo(() => {
    const sorted = [...salesmanLedger]
      .filter((e) => e.salesmanId === selectedSalesmanId)
      .sort((a, b) => {
        const timeDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (timeDiff !== 0) return timeDiff;
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      });

    let running = 0;
    return sorted.map((e) => {
      running += (e.debit || 0) - (e.credit || 0);
      return {
        ...e,
        runningBalance: running,
      };
    });
  }, [salesmanLedger, selectedSalesmanId]);

  // Section 9: Opening Balance, Debits, Credits, Closing Balance
  const periodLedgerMetrics = useMemo(() => {
    // 1. Transactions strictly before selected From Date
    const beforePeriodEntries = allSalesmanEntries.filter((e) => e.date < fromDate);
    const openingDebits = beforePeriodEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const openingCredits = beforePeriodEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
    const openingBalance = openingDebits - openingCredits;

    // 2. Transactions during selected period (fromDate to toDate)
    const periodEntries = allSalesmanEntries.filter((e) => e.date >= fromDate && e.date <= toDate);
    const periodDebits = periodEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const periodCredits = periodEntries.reduce((sum, e) => sum + (e.credit || 0), 0);

    // 3. Closing Balance at end of selected period
    const closingBalance = openingBalance + periodDebits - periodCredits;

    // 4. Overall All-Time Balance (must not be altered by date filter)
    const allDebits = allSalesmanEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const allCredits = allSalesmanEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
    const totalAllTimeBalance = Math.max(0, allDebits - allCredits);

    return {
      openingBalance,
      periodDebits,
      periodCredits,
      closingBalance,
      totalAllTimeBalance,
      periodEntriesCount: periodEntries.length
    };
  }, [allSalesmanEntries, fromDate, toDate]);

  const [searchQuery, setSearchQuery] = useState('');

  // Filtered transactions for the selected salesman in date range
  const filteredEntries = useMemo(() => {
    let result = allSalesmanEntries.filter((e) => e.date >= fromDate && e.date <= toDate);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (e) =>
          e.reference?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.type?.toLowerCase().includes(q) ||
          (e.notes && e.notes.toLowerCase().includes(q))
      );
    }
    return result;
  }, [allSalesmanEntries, fromDate, toDate, searchQuery]);

  const sortExtractors = useMemo(() => ({
    date: (e: SalesmanLedgerEntry) => new Date(e.date).getTime(),
    type: (e: SalesmanLedgerEntry) => e.type || '',
    reference: (e: SalesmanLedgerEntry) => e.reference || '',
    description: (e: SalesmanLedgerEntry) => e.description || '',
    debit: (e: SalesmanLedgerEntry) => e.debit || 0,
    credit: (e: SalesmanLedgerEntry) => e.credit || 0,
    runningBalance: (e: SalesmanLedgerEntry) => e.runningBalance || 0,
    notes: (e: SalesmanLedgerEntry) => e.notes || ''
  }), []);

  const table = useTableState({
    data: filteredEntries,
    initialSortField: 'date',
    initialSortDirection: 'desc',
    initialPageSize: 10,
    pageSizeOptions: [10, 25, 50, 100],
    sortExtractors
  });

  const handleCreateAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    const sm = salesmen.find((s) => s.id === advSalesmanId);
    if (!sm) return;

    const amt = Number(advAmount) || 0;
    if (amt <= 0) {
      toast.error('Advance amount must be greater than zero.');
      return;
    }

    addAdvance({
      salesmanId: sm.id,
      salesmanName: sm.name,
      date: advDate,
      amount: amt,
      reason: advReason.trim(),
      notes: advNotes.trim() || undefined
    });

    toast.success(`Advance of ₹${amt.toLocaleString('en-IN')} issued to ${sm.name} and posted to ledger.`);
    setIsAdvanceModalOpen(false);
  };

  const handleCreateRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    const sm = salesmen.find((s) => s.id === recSalesmanId);
    if (!sm) return;

    const amt = Number(recAmount) || 0;
    if (amt <= 0) {
      toast.error('Recovery amount must be greater than zero.');
      return;
    }

    const currentBal = getSalesmanLedgerBalance(sm.id);
    if (amt > currentBal) {
      toast.error(`Recovery amount (₹${amt.toLocaleString('en-IN')}) cannot exceed current recoverable balance (₹${currentBal.toLocaleString('en-IN')}).`);
      return;
    }

    addLedgerEntry({
      date: recDate,
      salesmanId: sm.id,
      salesmanName: sm.name,
      type: recType,
      reference: recRef.trim() || `REC-${Date.now().toString().slice(-4)}`,
      description: recType === 'RECOVERY' ? 'Direct Cash Repayment' : 'Manual Ledger Adjustment',
      debit: 0,
      credit: amt,
      notes: recNotes.trim() || undefined
    });

    toast.success(`Direct recovery of ₹${amt.toLocaleString('en-IN')} credited for ${sm.name}.`);
    setIsRecoveryModalOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            Salesman Financial Ledger & Statement
          </h1>
          <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
            Unified recoverable balance ledger tracking handover shortages, employee advances, direct recoveries, and payroll deductions.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setRecSalesmanId(selectedSalesmanId);
              setIsRecoveryModalOpen(true);
            }}
            style={{ fontWeight: 700 }}
          >
            <DollarSign size={16} />
            <span>Record Direct Recovery</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setAdvSalesmanId(selectedSalesmanId);
              setIsAdvanceModalOpen(true);
            }}
            style={{ fontWeight: 700 }}
          >
            <PlusCircle size={16} />
            <span>Issue Advance</span>
          </button>
        </div>
      </div>

      {/* Controls Bar: Salesman Selector + Date Filter Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          background: '#ffffff',
          padding: '14px 18px',
          border: '1px solid #e2e8f0',
          borderRadius: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <User size={18} color="#2563eb" />
          <label style={{ fontSize: '0.84rem', fontWeight: 700, color: '#334155' }}>Sales Representative:</label>
          <select
            className="input-field"
            value={selectedSalesmanId}
            onChange={(e) => setSelectedSalesmanId(e.target.value)}
            style={{ width: 'auto', minWidth: '220px', fontWeight: 700, padding: '6px 12px' }}
          >
            {salesmen.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>
            ))}
          </select>
        </div>

        {/* Date Filter (Section 9: From Date and To Date reusing Reports Hub style) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={16} color="#64748b" />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Period:</span>
          </div>
          <input
            type="date"
            className="input-field"
            style={{ width: '135px', padding: '6px 10px', fontSize: '0.8rem', fontWeight: 600 }}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <span style={{ color: '#94a3b8' }}>→</span>
          <input
            type="date"
            className="input-field"
            style={{ width: '135px', padding: '6px 10px', fontSize: '0.8rem', fontWeight: 600 }}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      {/* Section 9: Primary 4 KPI Cards for the Selected Period */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        {/* 1. Opening Balance */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Opening Balance
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: periodLedgerMetrics.openingBalance > 0 ? '#b45309' : '#0f172a', marginTop: '4px' }}>
            ₹{periodLedgerMetrics.openingBalance.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
            Balance before {fromDate}
          </div>
        </div>

        {/* 2. Debits during period */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
            Debits During Period
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#dc2626', marginTop: '4px' }}>
            ₹{periodLedgerMetrics.periodDebits.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
            Shortages & advances in period
          </div>
        </div>

        {/* 3. Credits during period */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>
            Credits During Period
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#059669', marginTop: '4px' }}>
            ₹{periodLedgerMetrics.periodCredits.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
            Recoveries & salary deductions
          </div>
        </div>

        {/* 4. Closing Balance at end of selected period */}
        <div
          style={{
            background: periodLedgerMetrics.closingBalance > 0 ? '#fef2f2' : '#ecfdf5',
            border: `1.5px solid ${periodLedgerMetrics.closingBalance > 0 ? '#fca5a5' : '#a7f3d0'}`,
            borderRadius: '12px',
            padding: '16px 20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: periodLedgerMetrics.closingBalance > 0 ? '#b91c1c' : '#047857', textTransform: 'uppercase' }}>
            Closing Balance
          </div>
          <div style={{ fontSize: '1.55rem', fontWeight: 900, color: periodLedgerMetrics.closingBalance > 0 ? '#b91c1c' : '#047857', marginTop: '4px' }}>
            ₹{periodLedgerMetrics.closingBalance.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: periodLedgerMetrics.closingBalance > 0 ? '#dc2626' : '#059669', marginTop: '2px' }}>
            As of {toDate} • All-Time Due: ₹{periodLedgerMetrics.totalAllTimeBalance.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Ledger Transactions Table Card */}
      <div className="table-container">
        <div className="table-toolbar">
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
              Statement Period ({fromDate} to {toDate}) — {selectedSalesman?.name}
            </h3>
            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
              Showing {table.totalItems} transactions in selected period
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search ledger..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 12px 7px 32px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  outline: 'none',
                  background: '#f8fafc'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
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
            <div style={{ fontSize: '0.76rem', color: '#059669', fontWeight: 700, background: '#ecfdf5', padding: '4px 10px', borderRadius: '6px' }}>
              Company-borne discounts excluded from ledger
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table" style={{ width: '100%', minWidth: '760px' }}>
            <thead>
              <tr>
                <SortableHeader label="Date" field="date" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} />
                <SortableHeader label="Type" field="type" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} />
                <SortableHeader label="Reference" field="reference" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} />
                <SortableHeader label="Description" field="description" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} />
                <SortableHeader label="Debit (Owed)" field="debit" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} align="right" />
                <SortableHeader label="Credit (Paid)" field="credit" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} align="right" />
                <SortableHeader label="Balance" field="runningBalance" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} align="right" />
                <SortableHeader label="Notes" field="notes" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} />
              </tr>
            </thead>
            <tbody>
              {table.pagedData.length === 0 ? (
                <TableEmptyState
                  colSpan={8}
                  title={searchQuery ? 'No matching transactions' : 'No transactions found'}
                  description={
                    searchQuery
                      ? `No financial transactions match "${searchQuery}".`
                      : 'No financial ledger transactions in the selected period for this salesman.'
                  }
                  icon={<Receipt size={28} />}
                />
              ) : (
                table.pagedData.map((e) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{e.date}</td>
                    <td style={{ padding: '12px 12px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background:
                            e.type === 'HANDOVER_SHORTAGE'
                              ? '#fef2f2'
                              : e.type === 'ADVANCE'
                              ? '#fffbeb'
                              : e.type === 'RECOVERY'
                              ? '#ecfdf5'
                              : e.type === 'SALARY_DEDUCTION'
                              ? '#f5f3ff'
                              : '#f1f5f9',
                          color:
                            e.type === 'HANDOVER_SHORTAGE'
                              ? '#b91c1c'
                              : e.type === 'ADVANCE'
                              ? '#b45309'
                              : e.type === 'RECOVERY'
                              ? '#047857'
                              : e.type === 'SALARY_DEDUCTION'
                              ? '#6d28d9'
                              : '#475569'
                        }}
                      >
                        {e.type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                      {e.reference}
                    </td>
                    <td style={{ padding: '12px 12px', fontWeight: 600 }}>{e.description}</td>
                    <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: e.debit > 0 ? '#dc2626' : '#94a3b8' }}>
                      {e.debit > 0 ? `₹${e.debit.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: e.credit > 0 ? '#059669' : '#94a3b8' }}>
                      {e.credit > 0 ? `₹${e.credit.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>
                      ₹{e.runningBalance.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{e.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          currentPage={table.currentPage}
          pageSize={table.pageSize}
          totalItems={table.totalItems}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
          itemLabel="transactions"
        />
      </div>

      {/* Advance Modal */}
      {isAdvanceModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsAdvanceModalOpen(false)}>
          <div
            className="modal-content"
            style={{
              maxWidth: '500px',
              width: '95vw',
              maxHeight: '92vh',
              padding: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              background: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.45), 0 0 0 1px rgba(15, 23, 42, 0.1)'
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
                justifyContent: 'space-between',
                flexShrink: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowUpRight size={20} color="#ffffff" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                  Issue Salesman Advance
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAdvanceModalOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '32px',
                  minHeight: '32px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAdvance} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Salesman *</label>
                  <select
                    className="input-field"
                    value={advSalesmanId}
                    onChange={(e) => setAdvSalesmanId(e.target.value)}
                    style={{ fontWeight: 700 }}
                  >
                    {salesmen.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Advance Amount (₹) *</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="input-field"
                      value={advAmount}
                      onChange={(e) => setAdvAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Date *</label>
                    <input
                      type="date"
                      className="input-field"
                      value={advDate}
                      onChange={(e) => setAdvDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Reason *</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Route travel, fuel, or emergency advance"
                    value={advReason}
                    onChange={(e) => setAdvReason(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Notes (Optional)</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Additional details..."
                    value={advNotes}
                    onChange={(e) => setAdvNotes(e.target.value)}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: '14px 20px',
                  background: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px'
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAdvanceModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ fontWeight: 800, padding: '8px 20px' }}
                >
                  Confirm & Post Advance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Direct Recovery Modal */}
      {isRecoveryModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsRecoveryModalOpen(false)}>
          <div
            className="modal-content"
            style={{
              maxWidth: '500px',
              width: '95vw',
              maxHeight: '92vh',
              padding: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              background: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.45), 0 0 0 1px rgba(15, 23, 42, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '16px 20px',
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign size={20} color="#ffffff" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                  Record Direct Salesman Recovery
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRecoveryModalOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '32px',
                  minHeight: '32px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRecovery} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Salesman *</label>
                  <select
                    className="input-field"
                    value={recSalesmanId}
                    onChange={(e) => setRecSalesmanId(e.target.value)}
                    style={{ fontWeight: 700 }}
                  >
                    {salesmen.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} (Current Due: ₹{getSalesmanLedgerBalance(s.id).toLocaleString('en-IN')})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Recovery Amount (₹) *</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="input-field"
                      value={recAmount}
                      onChange={(e) => setRecAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Date *</label>
                    <input
                      type="date"
                      className="input-field"
                      value={recDate}
                      onChange={(e) => setRecDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Type</label>
                    <select
                      className="input-field"
                      value={recType}
                      onChange={(e) => setRecType(e.target.value as any)}
                    >
                      <option value="RECOVERY">Direct Cash Recovery</option>
                      <option value="MANUAL_ADJUSTMENT">Manual Adjustment</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Reference #</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. REC-1001"
                      value={recRef}
                      onChange={(e) => setRecRef(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Notes</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Cash received at office counter"
                    value={recNotes}
                    onChange={(e) => setRecNotes(e.target.value)}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: '14px 20px',
                  background: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px'
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsRecoveryModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: '#059669', borderColor: '#059669', fontWeight: 800, padding: '8px 20px' }}
                >
                  Credit & Save Recovery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
