import React, { useState, useMemo } from 'react';
import { useHub } from '../../context/HubContext';
import { useToast } from '../../context/ToastContext';
import { SalaryRecord } from '../../types';
import {
  Wallet,
  PlusCircle,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  DollarSign,
  User,
  X,
  Search
} from 'lucide-react';
import { TablePagination } from '../../components/ui/TablePagination';
import { SortableHeader } from '../../components/ui/SortableHeader';
import { TableEmptyState } from '../../components/ui/TableEmptyState';
import { useTableState } from '../../utils/useTableState';

export const SalaryManagementView: React.FC = () => {
  const {
    persons,
    salaries,
    attendance,
    addSalaryRecord,
    updateSalaryRecord,
    getSalesmanLedgerBalance
  } = useHub();
  const toast = useToast();

  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [modalPersonId, setModalPersonId] = useState<string>(persons[0]?.id || '');
  const [month, setMonth] = useState<string>('2026-09');
  const [baseSalary, setBaseSalary] = useState<number>(20000);
  const [lopDeduction, setLopDeduction] = useState<number>(0);
  const [ledgerRecovery, setLedgerRecovery] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(20000);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');

  const selectedPerson = persons.find((p) => p.id === modalPersonId);
  const currentRecoverableBalance = selectedPerson ? getSalesmanLedgerBalance(selectedPerson.id) : 0;

  // Compute attendance stats for the person in that month for reference (Item 20: PRESENT / ABSENT only)
  const personAttendanceStats = useMemo(() => {
    if (!modalPersonId || !month) return { present: 0, absent: 0 };
    const monthAtt = attendance.filter((a) => a.personId === modalPersonId && a.date.startsWith(month));
    let present = 0;
    let absent = 0;
    monthAtt.forEach((r) => {
      if (r.status === 'PRESENT') present++;
      if (r.status === 'ABSENT') absent++;
    });
    return { present, absent };
  }, [attendance, modalPersonId, month]);

  // Net Disbursable Salary = Base Salary - LOP Deduction - Salesman Ledger Recovery
  const calculatedNetSalary = useMemo(() => {
    const net = Number(baseSalary || 0) - Number(lopDeduction || 0) - Number(ledgerRecovery || 0);
    return Math.max(0, net);
  }, [baseSalary, lopDeduction, ledgerRecovery]);

  const handleOpenAdd = () => {
    const p = persons[0];
    if (p) {
      setModalPersonId(p.id);
      setBaseSalary(p.baseSalary || 20000);
      setPaidAmount(p.baseSalary || 20000);
    }
    setMonth(selectedMonth);
    setLopDeduction(0);
    setLedgerRecovery(0);
    setNotes('');
    setIsModalOpen(true);
  };

  const handlePersonChange = (personId: string) => {
    setModalPersonId(personId);
    const p = persons.find((pers) => pers.id === personId);
    if (p) {
      const bSalary = p.baseSalary || 20000;
      setBaseSalary(bSalary);
      setPaidAmount(Math.max(0, bSalary - lopDeduction - ledgerRecovery));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson) return;

    if (baseSalary <= 0) {
      toast.error('Base salary must be greater than zero.');
      return;
    }

    if (lopDeduction < 0) {
      toast.error('LOP deduction cannot be negative.');
      return;
    }

    if (ledgerRecovery < 0) {
      toast.error('Ledger recovery cannot be negative.');
      return;
    }

    // Critical Section 8 & 34 Validation
    if (ledgerRecovery > currentRecoverableBalance) {
      toast.error(
        `Ledger recovery (₹${ledgerRecovery.toLocaleString('en-IN')}) cannot exceed current recoverable balance (₹${currentRecoverableBalance.toLocaleString('en-IN')}).`
      );
      return;
    }

    const res = addSalaryRecord({
      personId: selectedPerson.id,
      personName: selectedPerson.name,
      month,
      baseSalary,
      lopDeduction: Number(lopDeduction) || 0,
      ledgerRecovery,
      netSalary: calculatedNetSalary,
      paidAmount: Number(paidAmount) || calculatedNetSalary,
      paymentDate,
      status: 'PAID', // Status ALWAYS PAID per Item 22
      notes: notes.trim() || undefined
    });

    if (res.error) {
      toast.error(res.error);
      return;
    }

    if (ledgerRecovery > 0) {
      toast.success(
        `Salary processed with ₹${ledgerRecovery.toLocaleString('en-IN')} ledger recovery credited automatically!`
      );
    } else {
      toast.success(`Salary record saved for ${selectedPerson.name}!`);
    }
    setIsModalOpen(false);
  };

  const [searchQuery, setSearchQuery] = useState('');

  const filteredSalaries = useMemo(() => {
    return salaries.filter((s) => s.month === selectedMonth);
  }, [salaries, selectedMonth]);

  const searchedSalaries = useMemo(() => {
    if (!searchQuery.trim()) return filteredSalaries;
    const q = searchQuery.toLowerCase().trim();
    return filteredSalaries.filter(
      (s) =>
        s.personName.toLowerCase().includes(q) ||
        (s.notes && s.notes.toLowerCase().includes(q))
    );
  }, [filteredSalaries, searchQuery]);

  const totalDisbursedThisMonth = filteredSalaries.reduce((sum, s) => sum + s.paidAmount, 0);
  const totalLedgerRecoveredThisMonth = filteredSalaries.reduce((sum, s) => sum + s.ledgerRecovery, 0);

  const sortExtractors = useMemo(() => ({
    personName: (s: SalaryRecord) => s.personName || '',
    month: (s: SalaryRecord) => s.month || '',
    baseSalary: (s: SalaryRecord) => s.baseSalary || 0,
    deductions: (s: SalaryRecord) => ((s.lopDeduction || 0) + (s.otherDeductions || 0)),
    ledgerRecovery: (s: SalaryRecord) => s.ledgerRecovery || 0,
    netSalary: (s: SalaryRecord) => s.netSalary || 0,
    paidAmount: (s: SalaryRecord) => s.paidAmount || 0,
    status: (s: SalaryRecord) => s.status || '',
    notes: (s: SalaryRecord) => s.notes || ''
  }), []);

  const table = useTableState({
    data: searchedSalaries,
    initialSortField: 'personName',
    initialSortDirection: 'asc',
    initialPageSize: 10,
    pageSizeOptions: [10, 25, 50, 100],
    sortExtractors
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            Salary & Payroll Management
          </h1>
          <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
            Monthly payroll disbursement with automatic salesman financial ledger recovery deductions.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleOpenAdd}
          style={{ fontWeight: 700 }}
        >
          <PlusCircle size={16} />
          <span>Process Staff Salary</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Selected Month Payroll</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
            ₹{totalDisbursedThisMonth.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>{filteredSalaries.length} records processed</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' }}>Ledger Recoveries Deducted</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#7c3aed', marginTop: '4px' }}>
            ₹{totalLedgerRecoveredThisMonth.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>Automatically credited to Salesman Ledgers</div>
        </div>
      </div>

      {/* Payroll Table Card */}
      <div className="table-container">
        <div className="table-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={18} color="#2563eb" />
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Payroll Month:</label>
            <input
              type="month"
              className="input-field"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ width: 'auto', padding: '6px 12px' }}
            />
          </div>

          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search staff / notes..."
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
        </div>

        <div className="table-responsive">
          <table className="data-table" style={{ width: '100%', minWidth: '820px' }}>
            <thead>
              <tr>
                <SortableHeader label="Staff Name" field="personName" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} />
                <SortableHeader label="Month" field="month" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} />
                <SortableHeader label="Base Salary" field="baseSalary" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} align="right" />
                <SortableHeader label="LOP Deduction" field="deductions" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} align="right" />
                <SortableHeader label="Ledger Recovery" field="ledgerRecovery" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} align="right" />
                <SortableHeader label="Net Salary" field="netSalary" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} align="right" />
                <SortableHeader label="Paid Amount" field="paidAmount" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} align="right" />
                <SortableHeader label="Status" field="status" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} align="center" />
                <SortableHeader label="Notes" field="notes" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} />
              </tr>
            </thead>
            <tbody>
              {table.pagedData.length === 0 ? (
                <TableEmptyState
                  colSpan={9}
                  title={searchQuery ? 'No matching salary records' : 'No salary records found'}
                  description={
                    searchQuery
                      ? `No salary records matched "${searchQuery}".`
                      : `No salary records found for ${selectedMonth}. Click "Process Staff Salary" to create payroll.`
                  }
                  icon={<Wallet size={28} />}
                />
              ) : (
                table.pagedData.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0f172a' }}>{s.personName}</td>
                    <td style={{ padding: '12px 12px', whiteSpace: 'nowrap' }}>{s.month}</td>
                    <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 700 }}>
                      ₹{s.baseSalary.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 12px', textAlign: 'right', color: ((s.lopDeduction || 0) + (s.otherDeductions || 0)) > 0 ? '#dc2626' : '#64748b', fontWeight: ((s.lopDeduction || 0) + (s.otherDeductions || 0)) > 0 ? 700 : 400 }}>
                      {((s.lopDeduction || 0) + (s.otherDeductions || 0)) > 0
                        ? `-₹${((s.lopDeduction || 0) + (s.otherDeductions || 0)).toLocaleString('en-IN')}`
                        : '—'}
                    </td>
                    <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: '#7c3aed' }}>
                      {s.ledgerRecovery > 0 ? `-₹${s.ledgerRecovery.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 900, color: '#059669' }}>
                      ₹{s.netSalary.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                      ₹{s.paidAmount.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: s.status === 'PAID' ? '#ecfdf5' : '#fffbeb',
                          color: s.status === 'PAID' ? '#047857' : '#b45309'
                        }}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{s.notes || '—'}</td>
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
          itemLabel="salary records"
        />
      </div>

      {/* Salary Modal (Section 8) */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div
            className="modal-content"
            style={{
              maxWidth: '580px',
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
            {/* Header */}
            <div
              style={{
                padding: '16px 20px',
                background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wallet size={20} color="#ffffff" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                  Process Monthly Salary
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
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

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Staff Member *</label>
                    <select
                      className="input-field"
                      value={modalPersonId}
                      onChange={(e) => handlePersonChange(e.target.value)}
                      style={{ fontWeight: 700 }}
                    >
                      {persons.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Month *</label>
                    <input
                      type="month"
                      className="input-field"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Attendance & Ledger Info Banner */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Attendance Reference: </span>
                    <strong>{personAttendanceStats.present} Present</strong> / <strong>{personAttendanceStats.absent} Absent</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Recoverable Balance Due: </span>
                    <strong style={{ color: currentRecoverableBalance > 0 ? '#dc2626' : '#059669' }}>
                      ₹{currentRecoverableBalance.toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Base Salary (₹) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    className="input-field"
                    value={baseSalary}
                    onChange={(e) => {
                      const b = parseFloat(e.target.value) || 0;
                      setBaseSalary(b);
                      setPaidAmount(Math.max(0, b - lopDeduction - ledgerRecovery));
                    }}
                    required
                  />
                </div>

                {/* Loss of Pay (LOP) Deduction */}
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1.5px solid #fecaca',
                    borderRadius: '10px',
                    padding: '12px 14px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ fontWeight: 800, color: '#991b1b', margin: 0 }}>
                      LOP Deduction (-₹)
                    </label>
                    <span style={{ fontSize: '0.74rem', color: '#b91c1c', fontWeight: 600 }}>
                      Loss of Pay / Absence Deductions
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    className="input-field"
                    value={lopDeduction}
                    onChange={(e) => {
                      const lop = parseFloat(e.target.value) || 0;
                      setLopDeduction(lop);
                      setPaidAmount(Math.max(0, baseSalary - lop - ledgerRecovery));
                    }}
                    placeholder="Enter LOP deduction amount (default ₹0)"
                    style={{ fontWeight: 800, color: '#991b1b' }}
                  />
                  <div style={{ fontSize: '0.72rem', color: '#991b1b', marginTop: '4px' }}>
                    * Deducts unpaid absence or loss of pay directly from monthly base salary.
                  </div>
                </div>

                {/* Section 8: Ledger Recovery (Linked to Salesman Financial Ledger) */}
                <div
                  style={{
                    background: '#faf5ff',
                    border: '1.5px solid #d8b4fe',
                    borderRadius: '10px',
                    padding: '12px 14px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ fontWeight: 800, color: '#6b21a8', margin: 0 }}>
                      Salesman Ledger Recovery (-₹)
                    </label>
                    <span style={{ fontSize: '0.74rem', color: '#7c3aed', fontWeight: 600 }}>
                      Max Recoverable: ₹{currentRecoverableBalance.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    max={currentRecoverableBalance}
                    className="input-field"
                    value={ledgerRecovery}
                    onChange={(e) => {
                      const rec = parseFloat(e.target.value) || 0;
                      setLedgerRecovery(rec);
                      setPaidAmount(Math.max(0, baseSalary - lopDeduction - rec));
                    }}
                    placeholder="Amount to recover from salesman balance"
                    style={{ fontWeight: 800, color: '#6b21a8' }}
                  />
                  <div style={{ fontSize: '0.72rem', color: '#6b21a8', marginTop: '4px' }}>
                    * Deducted amount posts a SALARY_DEDUCTION credit to the salesman ledger.
                  </div>
                </div>

                {/* Net Salary Calculation Banner */}
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                      Net Disbursable Salary
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#15803d' }}>
                      Base Salary (₹{baseSalary.toLocaleString('en-IN')})
                      {lopDeduction > 0 ? ` - LOP Deduction (₹${lopDeduction.toLocaleString('en-IN')})` : ''}
                      {ledgerRecovery > 0 ? ` - Ledger Recovery (₹${ledgerRecovery.toLocaleString('en-IN')})` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#166534' }}>
                    ₹{calculatedNetSalary.toLocaleString('en-IN')}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Payment Date</label>
                    <input
                      type="date"
                      className="input-field"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                    />
                  </div>

                  {/* Status: Always PAID badge (Item 22) */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Status</label>
                    <div style={{ display: 'flex', alignItems: 'center', height: '42px' }}>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          padding: '6px 14px',
                          borderRadius: '6px',
                          background: '#ecfdf5',
                          color: '#047857',
                          border: '1px solid #a7f3d0'
                        }}
                      >
                        ✓ PAID
                      </span>
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Payment Notes / Bank Ref</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Bank IMPS Ref #99201"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '14px 24px',
                  background: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  flexShrink: 0
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  style={{ minWidth: '90px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ fontWeight: 700, background: '#7c3aed', borderColor: '#7c3aed', minWidth: '180px' }}
                >
                  Disburse & Deduct Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
