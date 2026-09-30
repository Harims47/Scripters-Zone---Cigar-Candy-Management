import React, { useState, useMemo } from 'react';
import { useHub } from '../../context/HubContext';
import { useToast } from '../../context/ToastContext';
import { ExpenseRecord } from '../../types';
import { deriveExpensesFromHandovers, DerivedExpenseEntry } from '../../utils/financialCalculations';
import {
  Wallet,
  PlusCircle,
  Calendar,
  Filter,
  Trash2,
  Tag,
  Building,
  Home,
  CheckCircle2,
  DollarSign,
  Lock,
  AlertCircle,
  Layers,
  ArrowRight,
  Search,
  X
} from 'lucide-react';
import { TablePagination } from '../../components/ui/TablePagination';
import { SortableHeader } from '../../components/ui/SortableHeader';
import { TableEmptyState } from '../../components/ui/TableEmptyState';
import { useTableState } from '../../utils/useTableState';

// Only these three categories can be manually recorded
const MANUAL_CATEGORIES = ['Office', 'House', 'GPI'] as const;
type ManualCategory = typeof MANUAL_CATEGORIES[number];

// All six categories visible for filtering and reporting
const ALL_FILTER_CATEGORIES = [
  'ALL',
  'Office',
  'House',
  'GPI',
  'Empty Packet',
  'Coupon',
  'Discount'
] as const;

interface UnifiedExpenseRow {
  id: string;
  date: string;
  category: string;
  displayCategory: string;
  isDerived: boolean;
  isHistoricalManualDerived?: boolean;
  description: string;
  source: 'Daily Handover' | 'Manual Entry';
  reference: string;
  paidByOrRecipient: string;
  recipientRole?: 'SALESMAN' | 'DEALER';
  notes: string;
  amount: number;
}

export const ExpensesView: React.FC = () => {
  const { expenses, handovers, addExpense, deleteExpense } = useHub();
  const toast = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('ALL');

  // Form State (Only Office, House, GPI)
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<ManualCategory>('Office');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | string>('');
  const [paidBy, setPaidBy] = useState<string>('Admin (Cash)');
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>(''); // Mandatory

  // 1. Sales-derived expenses from eligible recorded Daily Handovers
  const salesDerivedExpenses = useMemo(() => {
    return deriveExpensesFromHandovers(handovers);
  }, [handovers]);

  // 2. Build Unified rows
  const unifiedRows = useMemo(() => {
    const list: UnifiedExpenseRow[] = [];

    // Add manual expense records
    expenses.forEach((e) => {
      const isSalesDerivedCategory =
        e.category === 'Empty Packet' ||
        (e.category as string) === 'Empty Pocket' ||
        e.category === 'Coupon' ||
        e.category === 'Discount';

      list.push({
        id: e.id,
        date: e.date,
        category: e.category,
        displayCategory: isSalesDerivedCategory ? `${e.category} (Historical Manual)` : e.category,
        isDerived: false,
        isHistoricalManualDerived: isSalesDerivedCategory,
        description: e.description,
        source: 'Manual Entry',
        reference: e.reference || '—',
        paidByOrRecipient: e.paidBy || 'Admin',
        notes: e.notes || '—',
        amount: e.amount
      });
    });

    // Add sales-derived records
    salesDerivedExpenses.forEach((d) => {
      list.push({
        id: d.id,
        date: d.date,
        category: d.category,
        displayCategory: d.categoryLabel,
        isDerived: true,
        isHistoricalManualDerived: false,
        description: d.description,
        source: 'Daily Handover',
        reference: d.reference,
        paidByOrRecipient: `${d.recipientName} (${d.recipientType === 'SALESMAN' ? 'Salesman' : 'Dealer'})`,
        recipientRole: d.recipientType,
        notes: d.notes,
        amount: d.amount
      });
    });

    // Sort by date descending
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, salesDerivedExpenses]);

  // 3. Category Breakdown calculations
  const breakdown = useMemo(() => {
    const office = expenses
      .filter((e) => e.category === 'Office')
      .reduce((sum, e) => sum + e.amount, 0);

    const house = expenses
      .filter((e) => e.category === 'House')
      .reduce((sum, e) => sum + e.amount, 0);

    const gpi = expenses
      .filter((e) => e.category === 'GPI')
      .reduce((sum, e) => sum + e.amount, 0);

    const emptyPacket = salesDerivedExpenses
      .filter((d) => d.category === 'Empty Packet')
      .reduce((sum, d) => sum + d.amount, 0);

    const coupon = salesDerivedExpenses
      .filter((d) => d.category === 'Coupon')
      .reduce((sum, d) => sum + d.amount, 0);

    const discount = salesDerivedExpenses
      .filter((d) => d.category === 'Discount')
      .reduce((sum, d) => sum + d.amount, 0);

    const totalBusinessImpact = office + house + gpi + emptyPacket + coupon + discount;

    return {
      office,
      house,
      gpi,
      emptyPacket,
      coupon,
      discount,
      totalBusinessImpact
    };
  }, [expenses, salesDerivedExpenses]);

  const [searchQuery, setSearchQuery] = useState('');

  // 4. Filtering
  const filteredRows = useMemo(() => {
    let result = unifiedRows.filter((r) => {
      if (selectedCategoryTab === 'ALL') return true;
      if (selectedCategoryTab === 'Empty Packet') {
        return r.category === 'Empty Packet' || (r.category as string) === 'Empty Pocket';
      }
      return r.category === selectedCategoryTab;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.description.toLowerCase().includes(q) ||
          r.reference.toLowerCase().includes(q) ||
          r.paidByOrRecipient.toLowerCase().includes(q) ||
          r.notes.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
      );
    }
    return result;
  }, [unifiedRows, selectedCategoryTab, searchQuery]);

  const sortExtractors = useMemo(() => ({
    date: (r: UnifiedExpenseRow) => new Date(r.date).getTime(),
    category: (r: UnifiedExpenseRow) => r.category || '',
    source: (r: UnifiedExpenseRow) => r.source || '',
    reference: (r: UnifiedExpenseRow) => r.reference || '',
    paidByOrRecipient: (r: UnifiedExpenseRow) => r.paidByOrRecipient || '',
    description: (r: UnifiedExpenseRow) => r.description || '',
    amount: (r: UnifiedExpenseRow) => r.amount || 0
  }), []);

  const table = useTableState({
    data: filteredRows,
    initialSortField: 'date',
    initialSortDirection: 'desc',
    initialPageSize: 10,
    pageSizeOptions: [10, 25, 50, 100],
    sortExtractors
  });

  const totalFilteredAmount = filteredRows.reduce((sum, r) => sum + r.amount, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount) || 0;

    if (numAmount <= 0) {
      toast.error('Please enter a valid expense amount.');
      return;
    }

    if (!description.trim()) {
      toast.error('Please enter a brief description for this expense.');
      return;
    }

    // Notes are mandatory for manually recorded expenses
    if (!notes.trim()) {
      toast.error('Notes/Audit remarks are mandatory for manual expense entries.');
      return;
    }

    addExpense({
      date,
      category,
      description: description.trim(),
      amount: numAmount,
      paidBy: paidBy.trim() || undefined,
      reference: reference.trim() || undefined,
      notes: notes.trim()
    });

    toast.success(`Expense of ₹${numAmount.toLocaleString('en-IN')} added under ${category}!`);
    setDescription('');
    setAmount('');
    setReference('');
    setNotes('');
    setIsFormOpen(false);
  };

  return (
    <div className="expenses-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            Operational Expense & Benefit Ledger
          </h1>
          <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
            Unified ledger: Manual expenses (Office, House, GPI) and auto-derived sales benefits (Empty Packet, Coupon, Company-Borne Discounts).
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setIsFormOpen(!isFormOpen)}
          style={{ fontWeight: 700 }}
        >
          <PlusCircle size={16} />
          <span>{isFormOpen ? 'Close Form' : 'Add New Expense'}</span>
        </button>
      </div>

      {/* Six Categories Breakdown Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>Office Expense</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
            ₹{breakdown.office.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>Manual Entry</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase' }}>House Expense</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
            ₹{breakdown.house.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>Manual Entry</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#be185d', textTransform: 'uppercase' }}>GPI Expense</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
            ₹{breakdown.gpi.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>Manual Entry</div>
        </div>

        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '14px 16px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#c2410c', textTransform: 'uppercase' }}>Empty Packet — From Sales</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#c2410c', marginTop: '4px' }}>
            ₹{breakdown.emptyPacket.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#9a3412', marginTop: '2px' }}>Auto-derived from Handovers</div>
        </div>

        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '14px 16px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>Coupon — From Sales</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#b45309', marginTop: '4px' }}>
            ₹{breakdown.coupon.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#92400e', marginTop: '2px' }}>Auto-derived from Handovers</div>
        </div>

        <div style={{ background: '#fdf2f8', border: '1px solid #fbcfe8', borderRadius: '10px', padding: '14px 16px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9d174d', textTransform: 'uppercase' }}>Discount — From Sales</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#9d174d', marginTop: '4px' }}>
            ₹{breakdown.discount.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#831843', marginTop: '2px' }}>Company-borne discounts</div>
        </div>
      </div>

      {/* Add Expense Form Card (Restricted to Office, House, GPI) */}
      {isFormOpen && (
        <div
          style={{
            background: '#ffffff',
            border: '1.5px solid #4f46e5',
            borderRadius: '14px',
            padding: '20px 24px',
            boxShadow: '0 4px 16px rgba(79, 70, 229, 0.08)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                Record New Expense Entry
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Only Office, House, and GPI can be manually recorded. Empty Packet, Coupon, and Discount are auto-derived from Daily Handovers.
              </p>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#eff6ff', color: '#2563eb', padding: '3px 8px', borderRadius: '6px' }}>
              Manual Entry
            </span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                Date *
              </label>
              <input
                type="date"
                className="input-field"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                Category * (Manual only)
              </label>
              <select
                className="input-field"
                value={category}
                onChange={(e) => setCategory(e.target.value as ManualCategory)}
                style={{ fontWeight: 700 }}
              >
                {MANUAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                Amount (₹) *
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                className="input-field"
                placeholder="₹0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ fontWeight: 800, fontSize: '1rem' }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                Paid By
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Admin (Cash)"
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                Reference / Bill #
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. EB-SEP-2026"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                Description *
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. September godown electricity bill"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                Notes / Audit Remarks * (Mandatory)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. September electricity bill paid via online bank transfer"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                required
              />
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsFormOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: '9px 24px', fontWeight: 800 }}
              >
                Save Expense Entry
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Unified Expenses Table Card */}
      <div className="table-container">
        <div className="table-toolbar">
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            {ALL_FILTER_CATEGORIES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedCategoryTab(t)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: selectedCategoryTab === t ? '#4f46e5' : '#f1f5f9',
                  color: selectedCategoryTab === t ? '#ffffff' : '#475569'
                }}
              >
                {t === 'Empty Packet' ? 'Empty Packet' : t}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search expenses..."
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
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
              Total Filtered: <span style={{ color: '#ea580c' }}>₹{totalFilteredAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table" style={{ width: '100%', minWidth: '860px' }}>
            <thead>
              <tr>
                <SortableHeader label="Date" field="date" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} />
                <SortableHeader label="Category" field="category" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} />
                <SortableHeader label="Source" field="source" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} />
                <SortableHeader label="Handover Ref / Bill" field="reference" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} />
                <SortableHeader label="Salesman / Dealer" field="paidByOrRecipient" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} />
                <SortableHeader label="Description & Notes" field="description" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} />
                <SortableHeader label="Amount" field="amount" currentSortField={table.sortField} currentSortDirection={table.sortDirection} onSort={table.toggleSort} align="right" />
                <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {table.pagedData.length === 0 ? (
                <TableEmptyState
                  colSpan={8}
                  title={searchQuery ? 'No matching expenses' : 'No expenses found'}
                  description={
                    searchQuery
                      ? `No expense records match "${searchQuery}".`
                      : 'No expenses or sales-derived records found under this category.'
                  }
                  icon={<Wallet size={28} />}
                />
              ) : (
                table.pagedData.map((row) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: row.isDerived ? '#fafafa' : '#ffffff'
                    }}
                  >
                    <td style={{ padding: '12px 14px', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {row.date}
                    </td>

                    <td style={{ padding: '12px 10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            display: 'inline-block',
                            background:
                              row.category === 'GPI'
                                ? '#fdf2f8'
                                : row.category === 'Empty Packet' || (row.category as string) === 'Empty Pocket'
                                ? '#fff7ed'
                                : row.category === 'Coupon'
                                ? '#fffbeb'
                                : row.category === 'Discount'
                                ? '#fdf2f8'
                                : '#eff6ff',
                            color:
                              row.category === 'GPI'
                                ? '#be185d'
                                : row.category === 'Empty Packet' || (row.category as string) === 'Empty Pocket'
                                ? '#c2410c'
                                : row.category === 'Coupon'
                                ? '#b45309'
                                : row.category === 'Discount'
                                ? '#9d174d'
                                : '#1d4ed8'
                          }}
                        >
                          {row.displayCategory}
                        </span>
                        {row.isHistoricalManualDerived && (
                          <span style={{ fontSize: '0.65rem', color: '#dc2626', fontWeight: 700 }}>
                            Manual / Needs Review
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '12px 10px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: row.isDerived ? '#ecfdf5' : '#f1f5f9',
                          color: row.isDerived ? '#059669' : '#475569',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {row.source}
                      </span>
                    </td>

                    <td style={{ padding: '12px 10px', color: '#475569', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                      {row.reference}
                    </td>

                    <td style={{ padding: '12px 10px', color: '#0f172a', fontWeight: 600, fontSize: '0.82rem' }}>
                      {row.paidByOrRecipient}
                    </td>

                    <td style={{ padding: '12px 14px', color: '#334155', fontSize: '0.8rem' }}>
                      <div style={{ fontWeight: 600 }}>{row.description}</div>
                      <div style={{ color: '#64748b', fontSize: '0.74rem', marginTop: '2px' }}>{row.notes}</div>
                    </td>

                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' }}>
                      ₹{row.amount.toLocaleString('en-IN')}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {row.isDerived ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: '#f1f5f9',
                            color: '#64748b'
                          }}
                          title="Sales-derived records are read-only. Source of truth is original Daily Handover."
                        >
                          <Lock size={12} />
                          <span>Read-only</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '4px 6px', color: '#ef4444' }}
                          onClick={() => {
                            if (confirm('Delete this manual expense entry?')) {
                              deleteExpense(row.id);
                            }
                          }}
                          title="Delete Expense"
                        >
                          <Trash2 size={14} />
                        </button>
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
          pageSize={table.pageSize}
          totalItems={table.totalItems}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
          itemLabel="expenses"
        />
      </div>
    </div>
  );
};
