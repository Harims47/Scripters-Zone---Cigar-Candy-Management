import React, { useState, useMemo } from 'react';
import { useHub } from '../../context/HubContext';
import { useTableState } from '../../utils/useTableState';
import { SortableHeader } from '../../components/ui/SortableHeader';
import { TablePagination } from '../../components/ui/TablePagination';
import { TableEmptyState } from '../../components/ui/TableEmptyState';
import {
  Receipt,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  Target,
  Wallet,
  Search,
  X
} from 'lucide-react';

interface SalesmanDashboardViewProps {
  onNavigate: (tab: string) => void;
}

export const SalesmanDashboardView: React.FC<SalesmanDashboardViewProps> = ({ onNavigate }) => {
  const {
    handovers,
    activeSession,
    salesTargets,
    salesmanLedger,
    getSalesmanLedgerBalance
  } = useHub();

  const myPersonId = activeSession.personId;
  const todayStr = new Date().toISOString().split('T')[0];

  const myHandovers = handovers.filter(
    (h) => h.personId === myPersonId || h.personName === activeSession.name
  );
  const todayHandover = myHandovers.find((h) => h.date === todayStr);
  const todayActualSales = todayHandover ? todayHandover.netSales : 0;

  // Daily Sales Revenue Target (matching today's date or latest standing target)
  const todayTargetObj = salesTargets.find(
    (t) => (t.salesmanId === myPersonId || t.salesmanName === activeSession.name) &&
           t.targetType === 'VALUE' &&
           (!t.date || t.date === todayStr || t.date === 'Daily (Fixed)')
  ) || salesTargets.find(
    (t) => (t.salesmanId === myPersonId || t.salesmanName === activeSession.name) && t.targetType === 'VALUE'
  );
  const todayTarget = todayTargetObj ? Number(todayTargetObj.targetValue) || 0 : 0;
  const remainingTarget = Math.max(0, todayTarget - todayActualSales);
  const achievementPercent = todayTarget > 0 ? Math.round((todayActualSales / todayTarget) * 100) : 0;

  // Current Ledger Balance (Section 28)
  const currentLedgerBalance = myPersonId ? getSalesmanLedgerBalance(myPersonId) : 0;

  // Ledger Activity
  const allMyLedgerActivity = useMemo(() => {
    return salesmanLedger
      .filter((l) => l.salesmanId === myPersonId || l.salesmanName === activeSession.name)
      .map((l) => ({
        ...l,
        amountValue: (l.debit || 0) > 0 ? l.debit : (l.credit || 0)
      }));
  }, [salesmanLedger, myPersonId, activeSession.name]);

  const [ledgerSearch, setLedgerSearch] = useState('');
  const filteredLedgerActivity = useMemo(() => {
    if (!ledgerSearch.trim()) return allMyLedgerActivity;
    const q = ledgerSearch.toLowerCase();
    return allMyLedgerActivity.filter((l) =>
      l.reference.toLowerCase().includes(q) ||
      l.description.toLowerCase().includes(q) ||
      l.type.toLowerCase().includes(q) ||
      l.date.toLowerCase().includes(q)
    );
  }, [allMyLedgerActivity, ledgerSearch]);

  const ledgerTable = useTableState(filteredLedgerActivity, {
    initialSortField: 'date',
    initialSortDirection: 'desc',
    initialPageSize: 10
  });

  return (
    <div className="salesman-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Welcome Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #0f172a 100%)',
          color: '#ffffff',
          borderRadius: '16px',
          padding: '24px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          boxShadow: '0 8px 24px -4px rgba(6, 78, 59, 0.3)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6ee7b7', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <User size={16} />
            <span>Field Sales Representative Portal</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, margin: '6px 0', color: '#ffffff' }}>
            Welcome back, {activeSession.name}!
          </h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem', maxWidth: '520px' }}>
            Track your daily sales targets, stock issued, physical stock handover, and personal ledger balance.
          </p>
        </div>

        <div>
          {todayHandover ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', padding: '10px 18px', borderRadius: '10px' }}>
              <CheckCircle2 size={20} color="#34d399" />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#34d399' }}>Today's Handover Submitted</div>
                <div style={{ fontSize: '0.74rem', color: '#cbd5e1' }}>Ref: {todayHandover.handoverNumber} (₹{todayHandover.amountReceived.toLocaleString('en-IN')})</div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              style={{
                padding: '12px 22px',
                fontSize: '0.95rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
              }}
              onClick={() => onNavigate('handover')}
            >
              <Receipt size={18} />
              <span>Submit Today's Handover</span>
            </button>
          )}
        </div>
      </div>

      {/* Target & Performance KPI Strip — Simplified to Daily Target & Current Ledger Balance */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        {/* 1. Daily Target */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Daily Target
            </span>
            <Target size={18} color="#2563eb" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: todayTarget > 0 ? '#0f172a' : '#64748b', marginTop: '6px' }}>
            {todayTarget > 0 ? `₹${todayTarget.toLocaleString('en-IN')}` : '₹0'}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px' }}>
            {todayTarget > 0 ? 'Daily revenue quota assigned for route' : 'No target assigned for today'}
          </div>
        </div>

        {/* 2. Current Ledger Balance */}
        <div
          style={{
            background: currentLedgerBalance > 0 ? '#fef2f2' : '#ecfdf5',
            border: `1.5px solid ${currentLedgerBalance > 0 ? '#fca5a5' : '#a7f3d0'}`,
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: currentLedgerBalance > 0 ? '#b91c1c' : '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Current Ledger Balance
            </span>
            <Wallet size={18} color={currentLedgerBalance > 0 ? '#b91c1c' : '#047857'} />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: currentLedgerBalance > 0 ? '#b91c1c' : '#047857', marginTop: '6px' }}>
            ₹{currentLedgerBalance.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.74rem', color: currentLedgerBalance > 0 ? '#991b1b' : '#065f46', marginTop: '4px' }}>
            {currentLedgerBalance > 0 ? 'Pending recovery from shortages/advances' : 'Ledger in good standing'}
          </div>
        </div>
      </div>

      {/* Recent Ledger Activity (Section 28) */}
      <div className="table-container">
        <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0, flexWrap: 'wrap', gap: '10px', width: '100%' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
              My Ledger Activity ({ledgerTable.totalItems} {ledgerTable.totalItems === 1 ? 'record' : 'records'})
            </h3>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
              Shortfalls, cash advances, and repayments recorded against your profile.
            </p>
          </div>
          <div style={{ position: 'relative', width: '240px' }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search reference, type, note..."
              value={ledgerSearch}
              onChange={(e) => setLedgerSearch(e.target.value)}
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
            {ledgerSearch && (
              <button
                type="button"
                onClick={() => setLedgerSearch('')}
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
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <SortableHeader
                  label="Date"
                  field="date"
                  currentSortField={ledgerTable.sortField}
                  currentSortDirection={ledgerTable.sortDirection}
                  onSort={ledgerTable.toggleSort}
                  style={{ padding: '8px 12px' }}
                />
                <SortableHeader
                  label="Type"
                  field="type"
                  currentSortField={ledgerTable.sortField}
                  currentSortDirection={ledgerTable.sortDirection}
                  onSort={ledgerTable.toggleSort}
                  style={{ padding: '8px 12px' }}
                />
                <SortableHeader
                  label="Reference"
                  field="reference"
                  currentSortField={ledgerTable.sortField}
                  currentSortDirection={ledgerTable.sortDirection}
                  onSort={ledgerTable.toggleSort}
                  style={{ padding: '8px 12px' }}
                />
                <SortableHeader
                  label="Description"
                  field="description"
                  currentSortField={ledgerTable.sortField}
                  currentSortDirection={ledgerTable.sortDirection}
                  onSort={ledgerTable.toggleSort}
                  style={{ padding: '8px 12px' }}
                />
                <SortableHeader
                  label="Amount (₹)"
                  field="amountValue"
                  currentSortField={ledgerTable.sortField}
                  currentSortDirection={ledgerTable.sortDirection}
                  onSort={ledgerTable.toggleSort}
                  align="right"
                  style={{ padding: '8px 12px' }}
                />
              </tr>
            </thead>
            <tbody>
              {allMyLedgerActivity.length === 0 ? (
                <TableEmptyState
                  colSpan={5}
                  title="No ledger activity"
                  description="No financial ledger activity recorded against your profile yet."
                />
              ) : ledgerTable.pagedData.length === 0 ? (
                <TableEmptyState
                  colSpan={5}
                  title="No matching records"
                  description="No ledger records match your search criteria."
                  actionLabel="Clear Search"
                  onAction={() => setLedgerSearch('')}
                />
              ) : (
                ledgerTable.pagedData.map((item) => {
                  const isDebit = item.debit > 0;
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', color: '#64748b' }}>{item.date}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: isDebit ? '#fef2f2' : '#ecfdf5',
                            color: isDebit ? '#b91c1c' : '#047857'
                          }}
                        >
                          {item.type}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                        {item.reference}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#334155' }}>{item.description}</td>
                      <td
                        style={{
                          padding: '8px 12px',
                          textAlign: 'right',
                          fontWeight: 800,
                          color: isDebit ? '#dc2626' : '#059669'
                        }}
                      >
                        {isDebit ? `+₹${item.debit.toLocaleString('en-IN')}` : `-₹${item.credit.toLocaleString('en-IN')}`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          currentPage={ledgerTable.currentPage}
          totalPages={ledgerTable.totalPages}
          pageSize={ledgerTable.pageSize}
          totalItems={ledgerTable.totalItems}
          onPageChange={ledgerTable.setCurrentPage}
          onPageSizeChange={ledgerTable.setPageSize}
          itemLabel="transactions"
        />
      </div>
    </div>
  );
};
