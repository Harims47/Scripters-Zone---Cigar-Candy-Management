import React, { useState, useMemo } from 'react';
import { useHub } from '../../context/HubContext';
import { useToast } from '../../context/ToastContext';
import { SalesTarget, TargetPeriod, TargetType, ProductUOM } from '../../types';
import { toBaseQuantity } from '../../utils/inventoryConversion';
import { SortableHeader } from '../../components/ui/SortableHeader';
import { TablePagination } from '../../components/ui/TablePagination';
import { TableEmptyState } from '../../components/ui/TableEmptyState';
import { useTableState } from '../../utils/useTableState';
import {
  Target,
  PlusCircle,
  Calendar,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  User,
  Package,
  Trash2,
  Edit2,
  X
} from 'lucide-react';
import { DeleteConfirmModal } from '../../components/modals/DeleteConfirmModal';

export const SalesTargetsView: React.FC = () => {
  const { persons, products, handovers, salesTargets, addSalesTarget, updateSalesTarget, deleteSalesTarget } = useHub();
  const toast = useToast();

  const salesmen = useMemo(() => persons.filter((p) => p.role === 'SALESMAN'), [persons]);

  const [filterSalesmanId, setFilterSalesmanId] = useState<string>('ALL');
  const [filterPeriod, setFilterPeriod] = useState<'ALL' | 'DAILY' | 'MONTHLY'>('ALL');
  const [filterDate, setFilterDate] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [targetSalesmanId, setTargetSalesmanId] = useState<string>(salesmen[0]?.id || '');
  const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [period, setPeriod] = useState<TargetPeriod>('DAILY');
  const [targetType, setTargetType] = useState<TargetType>('VALUE');
  const [targetValue, setTargetValue] = useState<number | string>(4000);
  const [productId, setProductId] = useState<string>('');
  const [targetQuantity, setTargetQuantity] = useState<number | string>(100);
  const [targetUOM, setTargetUOM] = useState<ProductUOM>('Packet');
  const [targetNotes, setTargetNotes] = useState<string>('');

  // Performance calculations: IMPORTANT Section 23:
  // Stock Issued is NOT actual sales. Achievement must use actual sales/handover transactions!
  const targetPerformance = useMemo(() => {
    return salesTargets
      .filter((t) => t.active !== false)
      .filter((t) => t.targetType === 'VALUE')
      .filter((t) => Number(t.targetValue) > 0)
      .filter((t) => filterSalesmanId === 'ALL' || t.salesmanId === filterSalesmanId)
      .filter((t) => filterPeriod === 'ALL' || t.period === filterPeriod)
      .filter((t) => {
        // If filterDate is selected, match by date
        if (filterDate && t.date && t.date !== 'Daily (Fixed)') {
          if (t.period === 'MONTHLY') {
            return filterDate.startsWith(t.date.slice(0, 7));
          }
          return t.date === filterDate;
        }
        return true;
      })
      .map((target) => {
        // Find relevant handovers for this salesman on the target's date (or filterDate if selected)
        const dateToMatch = filterDate || (target.date && target.date !== 'Daily (Fixed)' ? target.date : null);
        const matchingHandovers = handovers.filter((h) => {
          if (h.personId !== target.salesmanId) return false;
          if (!dateToMatch) return true;
          if (target.period === 'MONTHLY') {
            const monthPrefix = dateToMatch.slice(0, 7);
            return h.date.startsWith(monthPrefix);
          }
          return h.date === dateToMatch;
        });

        let actual = 0;
        let targetAmount = 0;

        if (target.targetType === 'VALUE') {
          targetAmount = Number(target.targetValue) || 0;
          // Actual is sum of net sales from today's handovers
          actual = matchingHandovers.reduce((sum, h) => sum + (h.netSales || 0), 0);
        } else {
          // QUANTITY target for a specific product
          targetAmount = Number(target.targetQuantity) || 0;
          const prod = products.find((p) => p.id === target.productId);

          // Calculate actual sales quantity in target UOM using normalized base units
          matchingHandovers.forEach((h) => {
            h.items.forEach((item) => {
              if (item.productId === target.productId) {
                if (prod && target.targetUOM) {
                  // Normalize item sales to base units
                  const itemBase = toBaseQuantity(prod, item.sales, item.uom).baseQuantity;
                  // Normalize target 1 unit to base units
                  const targetBasePerUnit = toBaseQuantity(prod, 1, target.targetUOM).baseQuantity || 1;
                  actual += itemBase / targetBasePerUnit;
                } else {
                  actual += item.sales;
                }
              }
            });
          });
        }

        const remaining = Math.max(0, targetAmount - actual);
        const achievementPercent = targetAmount > 0 ? Math.round((actual / targetAmount) * 100) : 0;

        return {
          ...target,
          actual,
          targetAmount,
          remaining,
          achievementPercent
        };
      });
  }, [salesTargets, handovers, products, filterSalesmanId, filterPeriod, filterDate]);

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
  } = useTableState(targetPerformance, {
    initialPageSize: 10,
    initialSortField: 'salesmanName',
    initialSortDirection: 'asc',
    sortExtractors: {
      salesmanName: (t) => t.salesmanName,
      date: (t) => t.date,
      targetAmount: (t) => t.targetAmount,
      actual: (t) => t.actual,
      remaining: (t) => t.remaining,
      achievementPercent: (t) => t.achievementPercent
    }
  });

  const handleOpenAdd = () => {
    setEditingTargetId(null);
    const defaultSmId = salesmen[0]?.id || '';
    setTargetSalesmanId(defaultSmId);
    setTargetDate(filterDate || new Date().toISOString().split('T')[0]);
    setPeriod('DAILY');
    setTargetType('VALUE');
    const existing = salesTargets.find((t) => t.salesmanId === defaultSmId && t.targetType === 'VALUE');
    setTargetValue(existing?.targetValue || 2500);
    setProductId(products[0]?.id || '');
    setTargetQuantity(100);
    setTargetUOM(products[0]?.uom || 'Packet');
    setTargetNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (target: SalesTarget) => {
    setEditingTargetId(target.id);
    setTargetSalesmanId(target.salesmanId);
    setTargetType(target.targetType);
    setPeriod(target.period || 'DAILY');
    setTargetDate(target.date && target.date !== 'Daily (Fixed)' ? target.date : filterDate || new Date().toISOString().split('T')[0]);
    setTargetValue(target.targetValue ?? 2500);
    setProductId(target.productId || products[0]?.id || '');
    setTargetQuantity(target.targetQuantity ?? 100);
    setTargetUOM(target.targetUOM || products[0]?.uom || 'Packet');
    setTargetNotes(target.notes || '');
    setIsModalOpen(true);
  };

  const handleSalesmanChange = (smId: string) => {
    setTargetSalesmanId(smId);
    if (!editingTargetId) {
      const existing = salesTargets.find((t) => t.salesmanId === smId && t.targetType === 'VALUE');
      if (existing?.targetValue) {
        setTargetValue(existing.targetValue);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sm = salesmen.find((s) => s.id === targetSalesmanId);
    if (!sm) return;

    if (Number(targetValue) <= 0) {
      toast.error('Daily revenue target must be greater than zero.');
      return;
    }

    const chosenDate = targetDate || filterDate || new Date().toISOString().split('T')[0];

    const targetToEdit = editingTargetId ? salesTargets.find((t) => t.id === editingTargetId) : undefined;
    const existing = salesTargets.find((t) => t.salesmanId === sm.id && (t.date === chosenDate || t.date === 'Daily (Fixed)'));
    const existingProductTargets = targetToEdit?.productTargets || existing?.productTargets || [];

    if (editingTargetId) {
      if (targetToEdit) {
        updateSalesTarget({
          ...targetToEdit,
          salesmanId: sm.id,
          salesmanName: sm.name,
          date: chosenDate,
          period: 'DAILY',
          targetType: 'VALUE',
          targetValue: Number(targetValue),
          productTargets: existingProductTargets,
          notes: targetNotes.trim() || undefined
        });
        toast.success(`Updated daily sales target (₹${Number(targetValue).toLocaleString('en-IN')}) for ${sm.name}`);
        setIsModalOpen(false);
        setEditingTargetId(null);
        return;
      }
    }

    if (existing) {
      updateSalesTarget({
        ...existing,
        date: chosenDate,
        targetValue: Number(targetValue),
        productTargets: existingProductTargets,
        notes: targetNotes.trim() || existing.notes,
        salesmanName: sm.name
      });
      toast.success(`Updated daily sales target to ₹${Number(targetValue).toLocaleString('en-IN')} for ${sm.name}`);
    } else {
      addSalesTarget({
        salesmanId: sm.id,
        salesmanName: sm.name,
        date: chosenDate,
        period: 'DAILY',
        targetType: 'VALUE',
        targetValue: Number(targetValue),
        productTargets: existingProductTargets,
        notes: targetNotes.trim() || undefined
      });
      toast.success(`Daily sales target ₹${Number(targetValue).toLocaleString('en-IN')} assigned to ${sm.name}`);
    }

    setIsModalOpen(false);
    setEditingTargetId(null);
  };

  const handleDelete = (id: string, salesmanName?: string) => {
    setDeleteTarget({
      id,
      name: salesmanName ? `sales target for ${salesmanName}` : 'this sales target'
    });
  };

  const avgAchievement =
    targetPerformance.length > 0
      ? Math.round(
          targetPerformance.reduce((sum, t) => sum + t.achievementPercent, 0) / targetPerformance.length
        )
      : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            Sales Targets & Performance
          </h1>
          <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
            Review daily sales revenue targets and achievement. Product targets are assigned during <strong>Issue Stock</strong>.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleOpenAdd}
          style={{ fontWeight: 700 }}
        >
          <PlusCircle size={16} />
          <span>Assign New Target</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Active Targets</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
            {targetPerformance.length}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>Assigned for field route execution</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>Average Achievement</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#059669', marginTop: '4px' }}>
            {avgAchievement}%
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>Calculated from actual Handover sales</div>
        </div>
      </div>

      {/* Targets Table Card */}
      <div className="table-container">
        <div className="table-toolbar">
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>Salesman:</label>
              <select
                className="input-field"
                value={filterSalesmanId}
                onChange={(e) => {
                  setFilterSalesmanId(e.target.value);
                  resetPage();
                }}
                style={{ padding: '6px 10px', fontSize: '0.82rem' }}
              >
                <option value="ALL">All Salesmen</option>
                {salesmen.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>Period:</label>
              <select
                className="input-field"
                value={filterPeriod}
                onChange={(e) => {
                  setFilterPeriod(e.target.value as any);
                  resetPage();
                }}
                style={{ padding: '6px 10px', fontSize: '0.82rem' }}
              >
                <option value="ALL">All Periods</option>
                <option value="DAILY">Daily</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} color="#64748b" />
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>Target Date:</label>
              <input
                type="date"
                className="input-field"
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  resetPage();
                }}
                style={{ padding: '5px 10px', fontSize: '0.82rem', fontWeight: 600 }}
              />
              {filterDate ? (
                <button
                  type="button"
                  onClick={() => {
                    setFilterDate('');
                    resetPage();
                  }}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                  title="Show targets across all dates"
                >
                  All Dates
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setFilterDate(new Date().toISOString().split('T')[0]);
                    resetPage();
                  }}
                  style={{
                    background: '#e0e7ff',
                    border: '1px solid #c7d2fe',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#4338ca',
                    cursor: 'pointer'
                  }}
                  title="Filter to today's targets"
                >
                  Today
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table" style={{ width: '100%', minWidth: '850px' }}>
            <thead>
              <tr>
              <SortableHeader
                label="Salesman"
                field="salesmanName"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={toggleSort}
                style={{ padding: '12px 16px' }}
              />
              <SortableHeader
                label="Date / Month"
                field="date"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={toggleSort}
                style={{ padding: '12px 12px' }}
              />
              <SortableHeader
                label="Target"
                field="targetAmount"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={toggleSort}
                align="right"
                style={{ padding: '12px 12px' }}
              />
              <SortableHeader
                label="Actual Sold"
                field="actual"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={toggleSort}
                align="right"
                style={{ padding: '12px 12px' }}
              />
              <SortableHeader
                label="Remaining"
                field="remaining"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={toggleSort}
                align="right"
                style={{ padding: '12px 12px' }}
              />
              <SortableHeader
                label="Achievement"
                field="achievementPercent"
                currentSortField={sortField}
                currentSortDirection={sortDirection}
                onSort={toggleSort}
                align="center"
                style={{ padding: '12px 12px' }}
              />
              <th style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {pagedData.length === 0 ? (
              <TableEmptyState
                colSpan={7}
                title="No sales targets found"
                description="No sales performance targets matched the selected salesman, period, or date filter."
                icon={<Target size={28} />}
                actionLabel="+ Add New Target"
                onAction={handleOpenAdd}
              />
            ) : (
              pagedData.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0f172a' }}>{t.salesmanName}</td>
                  <td style={{ padding: '12px 12px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#334155' }}>
                      {t.date && t.date !== 'Daily (Fixed)' ? t.date : 'Daily (Standing)'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 700 }}>
                    {t.targetType === 'VALUE' ? `₹${t.targetAmount.toLocaleString('en-IN')}` : `${t.targetAmount}`}
                  </td>
                  <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                    {t.targetType === 'VALUE' ? `₹${t.actual.toLocaleString('en-IN')}` : `${t.actual}`}
                  </td>
                  <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 700, color: t.remaining > 0 ? '#d97706' : '#059669' }}>
                    {t.targetType === 'VALUE' ? `₹${t.remaining.toLocaleString('en-IN')}` : `${t.remaining}`}
                  </td>
                  <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <div style={{ width: '60px', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(100, t.achievementPercent)}%`,
                            height: '100%',
                            background: t.achievementPercent >= 100 ? '#059669' : t.achievementPercent >= 80 ? '#2563eb' : '#eab308'
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.78rem', fontWeight: 900, color: t.achievementPercent >= 80 ? '#059669' : '#b45309' }}>
                        {t.achievementPercent}%
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{
                          padding: '5px 9px',
                          color: '#2563eb',
                          borderColor: '#bfdbfe',
                          background: '#eff6ff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.78rem',
                          fontWeight: 700
                        }}
                        onClick={() => handleOpenEdit(t)}
                        title="Edit Target"
                      >
                        <Edit2 size={13} />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '5px 7px', color: '#ef4444' }}
                        onClick={() => handleDelete(t.id, t.salesmanName)}
                        title="Delete Target"
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
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={totalItems}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="targets"
        />
      </div>

      {/* Target Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div
            className="modal-content"
            style={{
              maxWidth: '560px',
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
            {/* Modal Header */}
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
                <Target size={20} color="#ffffff" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                  {editingTargetId ? 'Edit Sales Target' : 'Assign Sales Target'}
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

            {/* Modal Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 800 }}>Sales Representative *</label>
                  <select
                    className="input-field"
                    value={targetSalesmanId}
                    onChange={(e) => handleSalesmanChange(e.target.value)}
                    style={{ fontWeight: 700 }}
                  >
                    {salesmen.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 800 }}>Target Date *</label>
                  <input
                    type="date"
                    className="input-field"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    required
                    style={{ fontWeight: 700, fontSize: '0.95rem' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                    Business date for which this daily sales target applies
                  </span>
                </div>

                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontSize: '0.82rem',
                    color: '#166534',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Target size={16} color="#16a34a" />
                  <span>
                    <strong>Daily Revenue Target:</strong> Set the daily sales revenue target for the salesman's route. Product targets are assigned when issuing stock to the salesman.
                  </span>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 800 }}>Daily Revenue Target (₹) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    className="input-field"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    required
                    placeholder="e.g. 4000.00"
                    style={{ fontWeight: 700, fontSize: '0.95rem' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                    Revenue quota assigned per day for the salesman's route (e.g. ₹4,000 / day)
                  </span>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 800 }}>Notes / Instructions</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Focus on high-margin packs during route"
                    value={targetNotes}
                    onChange={(e) => setTargetNotes(e.target.value)}
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
                  style={{ fontWeight: 700, minWidth: '130px' }}
                >
                  {editingTargetId ? 'Save Changes' : 'Assign Sales Target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteSalesTarget(deleteTarget.id);
            toast.info('Sales target removed.');
            setDeleteTarget(null);
          }
        }}
        itemName={deleteTarget ? deleteTarget.name : ''}
      />
    </div>
  );
};
