import React, { useState, useMemo } from 'react';
import { useHub } from '../../context/HubContext';
import { calculateCumulativeItemsSold } from '../../utils/financialCalculations';
import { useTableState } from '../../utils/useTableState';
import { SortableHeader } from '../../components/ui/SortableHeader';
import { TablePagination } from '../../components/ui/TablePagination';
import { TableEmptyState } from '../../components/ui/TableEmptyState';
import {
  Receipt,
  AlertTriangle,
  Wallet,
  Tag,
  Package,
  ArrowRight,
  User,
  Store,
  CheckCircle2,
  Clock,
  Target,
  Truck,
  Layers,
  Users,
  ShoppingBag,
  TrendingUp,
  Search,
  X
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const {
    handovers,
    outstandings,
    products,
    persons,
    attendance,
    salesmanLedger,
    salesTargets,
    quantityIssues
  } = useHub();

  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = todayStr.slice(0, 7); // e.g. "2026-09"

  // 1. SALES SECTION
  const todayHandovers = handovers.filter((h) => h.date === todayStr && h.status !== 'CANCELLED');
  const todayGrossSales = todayHandovers.reduce((sum, h) => sum + h.grossSales, 0);
  const todayNetSales = todayHandovers.reduce((sum, h) => sum + h.netSales, 0);
  const todayExpected = todayHandovers.reduce((sum, h) => sum + (h.expectedHandover ?? h.totalExpected), 0);
  const todayOutstanding = todayHandovers.reduce((sum, h) => sum + h.outstanding, 0);
  const todayDealerSales = todayHandovers.filter((h) => h.type === 'DEALER').reduce((sum, h) => sum + h.netSales, 0);

  // 2. SALESMAN SECTION
  const salesmen = persons.filter((p) => p.role === 'SALESMAN');
  const todayTargets = salesTargets.filter((t) => t.targetType === 'VALUE');
  const todayTargetTotal = todayTargets.reduce((sum, t) => sum + (t.targetValue || 0), 0);
  const targetAchieved = todayTargetTotal > 0 ? Math.round((todayNetSales / todayTargetTotal) * 100) : 0;

  // Current Recoverable Balance (Total debits - Total credits across all salesmen)
  const totalLedgerDebits = salesmanLedger.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalLedgerCredits = salesmanLedger.reduce((sum, l) => sum + (l.credit || 0), 0);
  const totalSalesmanRecoverableBalance = Math.max(0, totalLedgerDebits - totalLedgerCredits);

  // 3. INVENTORY & DISPATCH SECTION
  const todayIssues = quantityIssues.filter((q) => q.date === todayStr);
  const todayIssueQty = todayIssues.reduce((sum, q) => sum + q.quantityIssued, 0);

  // 4. STAFF ATTENDANCE SECTION
  const todayAttendance = attendance.filter((a) => a.date === todayStr);
  const todayPresent = todayAttendance.filter((a) => a.status === 'PRESENT').length;
  const todayAbsent = todayAttendance.filter((a) => a.status === 'ABSENT').length;

  // 5. CUMULATIVE ITEMS SOLD (Section 12: Replaces Recent Purchases and Financial P&L)
  // Combines both Salesman and Dealer handovers for current month
  const cumulativeSales = useMemo(() => {
    return calculateCumulativeItemsSold(
      handovers,
      `${currentMonthStr}-01`,
      `${currentMonthStr}-31`
    );
  }, [handovers, currentMonthStr]);

  const [productSearch, setProductSearch] = useState('');
  const filteredCumulativeItems = useMemo(() => {
    if (!productSearch.trim()) return cumulativeSales.items;
    const q = productSearch.toLowerCase();
    return cumulativeSales.items.filter((it) =>
      it.productName.toLowerCase().includes(q) ||
      (it.brand && it.brand.toLowerCase().includes(q)) ||
      (it.category && it.category.toLowerCase().includes(q))
    );
  }, [cumulativeSales.items, productSearch]);

  const cumulativeTotals = useMemo(() => {
    return {
      totalSalesQty: filteredCumulativeItems.reduce((sum, r) => sum + r.salesQuantity, 0),
      totalFreeQty: filteredCumulativeItems.reduce((sum, r) => sum + r.freeQuantity, 0),
      totalChargeableQty: filteredCumulativeItems.reduce((sum, r) => sum + r.chargeableQuantity, 0),
      totalGrossValue: filteredCumulativeItems.reduce((sum, r) => sum + r.grossSalesValue, 0),
      totalItemDiscount: filteredCumulativeItems.reduce((sum, r) => sum + r.itemDiscount, 0),
      totalNetItemsSoldValue: filteredCumulativeItems.reduce((sum, r) => sum + r.netItemSalesValue, 0)
    };
  }, [filteredCumulativeItems]);

  const itemsTable = useTableState(filteredCumulativeItems, {
    initialSortField: 'netItemSalesValue',
    initialSortDirection: 'desc',
    initialPageSize: 10
  });

  return (
    <div className="admin-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Welcome Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            Operational Command Center
          </h1>
          <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
            Unified real-time visibility across Daily Sales, Field Routes, Sales Targets, Inventory, and Product Movement.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onNavigate('handovers')}
            style={{ fontWeight: 700 }}
          >
            <Receipt size={16} />
            <span>Open Daily Handover Hub</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: SALES */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Receipt size={16} color="#2563eb" />
          <span>Daily Route & Dealer Sales</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Today's Sales</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#059669', marginTop: '4px' }}>₹{todayNetSales.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>Gross: ₹{todayGrossSales.toLocaleString('en-IN')}</div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Expected Handover</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>₹{todayExpected.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>After packet & coupon rebates</div>
          </div>

          <div style={{ background: '#ffffff', border: `1px solid ${todayOutstanding > 0 ? '#fca5a5' : '#e2e8f0'}`, borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: todayOutstanding > 0 ? '#dc2626' : '#64748b', textTransform: 'uppercase' }}>Today's Outstanding</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: todayOutstanding > 0 ? '#dc2626' : '#059669', marginTop: '4px' }}>₹{todayOutstanding.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>Route cash shortfalls</div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Dealer Wholesale Sales</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0284c7', marginTop: '4px' }}>₹{todayDealerSales.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>Counter consignments</div>
          </div>
        </div>
      </div>

      {/* SECTION 2: SALESMAN & PERFORMANCE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <User size={16} color="#059669" />
          <span>Salesman Operations & Targets</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Active Salesmen</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>{salesmen.length}</div>
            <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: '2px' }}>In field distribution</div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Today's Revenue Target</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#2563eb', marginTop: '4px' }}>₹{todayTargetTotal.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>Target vs Actual sales</div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Target Achievement</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: targetAchieved >= 80 ? '#059669' : '#d97706', marginTop: '4px' }}>
              {targetAchieved}%
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>Derived from actual handovers</div>
          </div>

          <div style={{ background: '#faf5ff', border: '1.5px solid #d8b4fe', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6b21a8', textTransform: 'uppercase' }}>Current Recoverable Balance</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#6b21a8', marginTop: '4px' }}>₹{totalSalesmanRecoverableBalance.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: '0.72rem', color: '#7c3aed', marginTop: '2px' }}>Shortfalls + Advances - Repayments</div>
          </div>
        </div>
      </div>

      {/* SECTION 3: CUMULATIVE ITEMS SOLD (Replaces Financial Performance & Recent Purchases) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <ShoppingBag size={18} color="#2563eb" />
            <span>Cumulative Items Sold — Month to Date (September 2026)</span>
          </div>
          <span style={{ fontSize: '0.74rem', color: '#64748b', background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px' }}>
            Includes Salesman & Dealer Handovers
          </span>
        </div>

        {/* Primary KPI Card: Total Items Sold Value */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              color: '#ffffff',
              borderRadius: '12px',
              padding: '18px 22px',
              boxShadow: '0 4px 14px rgba(15, 23, 42, 0.12)'
            }}
          >
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Items Sold Value
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#38bdf8', marginTop: '4px' }}>
              ₹{cumulativeSales.totalNetItemsSoldValue.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '2px' }}>
              Net value of products actually sold across all handovers
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Gross Sales Value</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
              ₹{cumulativeSales.totalGrossValue.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>Chargeable Qty × Recorded Rate</div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9d174d', textTransform: 'uppercase' }}>Total Item Discounts</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#9d174d', marginTop: '4px' }}>
              ₹{cumulativeSales.totalItemDiscount.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#831843', marginTop: '2px' }}>Company-borne item deductions</div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>Total Chargeable Qty</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#059669', marginTop: '4px' }}>
              {cumulativeSales.totalChargeableQty.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
              Sold: {cumulativeSales.totalSalesQty} | Free: {cumulativeSales.totalFreeQty}
            </div>
          </div>
        </div>

        {/* Cumulative Items Sold Table Card */}
        <div className="table-container">
          <div className="table-toolbar">
            <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
              Product Breakdown ({itemsTable.totalItems} {itemsTable.totalItems === 1 ? 'item' : 'items'})
            </div>
            <div style={{ position: 'relative', width: '250px' }}>
              <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search product, brand, category..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
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
              {productSearch && (
                <button
                  type="button"
                  onClick={() => setProductSearch('')}
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
            <table className="data-table" style={{ width: '100%', minWidth: '780px' }}>
              <thead>
                <tr>
                  <SortableHeader
                    label="Product"
                    field="productName"
                    currentSortField={itemsTable.sortField}
                    currentSortDirection={itemsTable.sortDirection}
                    onSort={itemsTable.toggleSort}
                    style={{ padding: '12px 16px' }}
                  />
                  <SortableHeader
                    label="Sales Qty"
                    field="salesQuantity"
                    currentSortField={itemsTable.sortField}
                    currentSortDirection={itemsTable.sortDirection}
                    onSort={itemsTable.toggleSort}
                    align="center"
                    style={{ padding: '12px 10px' }}
                  />
                  <SortableHeader
                    label="Free Qty"
                    field="freeQuantity"
                    currentSortField={itemsTable.sortField}
                    currentSortDirection={itemsTable.sortDirection}
                    onSort={itemsTable.toggleSort}
                    align="center"
                    style={{ padding: '12px 10px' }}
                  />
                  <SortableHeader
                    label="Chargeable Qty"
                    field="chargeableQuantity"
                    currentSortField={itemsTable.sortField}
                    currentSortDirection={itemsTable.sortDirection}
                    onSort={itemsTable.toggleSort}
                    align="center"
                    style={{ padding: '12px 10px', background: '#f1f5f9' }}
                  />
                  <SortableHeader
                    label="Gross Sales Value"
                    field="grossSalesValue"
                    currentSortField={itemsTable.sortField}
                    currentSortDirection={itemsTable.sortDirection}
                    onSort={itemsTable.toggleSort}
                    align="right"
                    style={{ padding: '12px 12px' }}
                  />
                  <SortableHeader
                    label="Item Discount"
                    field="itemDiscount"
                    currentSortField={itemsTable.sortField}
                    currentSortDirection={itemsTable.sortDirection}
                    onSort={itemsTable.toggleSort}
                    align="right"
                    style={{ padding: '12px 12px' }}
                  />
                  <SortableHeader
                    label="Net Item Sales Value"
                    field="netItemSalesValue"
                    currentSortField={itemsTable.sortField}
                    currentSortDirection={itemsTable.sortDirection}
                    onSort={itemsTable.toggleSort}
                    align="right"
                    style={{ padding: '12px 16px' }}
                  />
                </tr>
              </thead>
              <tbody>
                {cumulativeSales.items.length === 0 ? (
                  <TableEmptyState
                    colSpan={7}
                    title="No actual sales recorded"
                    description="No actual handover sales recorded for this period yet."
                  />
                ) : itemsTable.pagedData.length === 0 ? (
                  <TableEmptyState
                    colSpan={7}
                    title="No matching products"
                    description="No products match your search query."
                    actionLabel="Clear Search"
                    onAction={() => setProductSearch('')}
                  />
                ) : (
                  itemsTable.pagedData.map((it) => (
                    <tr key={it.productId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0f172a' }}>
                        <div>{it.productName}</div>
                        {it.brand && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{it.brand}</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 600 }}>
                        {it.salesQuantity}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', color: it.freeQuantity > 0 ? '#b45309' : '#94a3b8', fontWeight: 600 }}>
                        {it.freeQuantity}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 800, color: '#2563eb', background: '#fafbfc' }}>
                        {it.chargeableQuantity}
                      </td>
                      <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 700 }}>
                        ₹{it.grossSalesValue.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 12px', textAlign: 'right', color: it.itemDiscount > 0 ? '#dc2626' : '#94a3b8', fontWeight: 700 }}>
                        {it.itemDiscount > 0 ? `-₹${it.itemDiscount.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, color: '#059669', fontSize: '0.92rem' }}>
                        ₹{it.netItemSalesValue.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {cumulativeTotals.totalSalesQty > 0 && (
                <tfoot>
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0', fontWeight: 900 }}>
                    <td style={{ padding: '12px 16px' }}>Total (All Filtered)</td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>{cumulativeTotals.totalSalesQty}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>{cumulativeTotals.totalFreeQty}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'center', color: '#2563eb' }}>{cumulativeTotals.totalChargeableQty}</td>
                    <td style={{ padding: '12px 12px', textAlign: 'right' }}>₹{cumulativeTotals.totalGrossValue.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px 12px', textAlign: 'right', color: '#dc2626' }}>-₹{cumulativeTotals.totalItemDiscount.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#059669', fontSize: '0.95rem' }}>
                      ₹{cumulativeTotals.totalNetItemsSoldValue.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <TablePagination
            currentPage={itemsTable.currentPage}
            totalPages={itemsTable.totalPages}
            pageSize={itemsTable.pageSize}
            totalItems={itemsTable.totalItems}
            onPageChange={itemsTable.setCurrentPage}
            onPageSizeChange={itemsTable.setPageSize}
            itemLabel="products"
          />
        </div>
      </div>

      {/* SECTION 4: INVENTORY & STAFF ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Inventory Summary Card */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
              <Package size={18} color="#2563eb" />
              <span>Inventory & Stock Distribution</span>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.74rem', padding: '4px 10px' }}
              onClick={() => onNavigate('inventory')}
            >
              View Inventory
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Today's Stock Issued</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>{todayIssueQty}</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Across {todayIssues.length} issue runs</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Active SKUs Sold</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
                {cumulativeSales.items.length}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Products in active rotation</div>
            </div>
          </div>
        </div>

        {/* Staff Attendance Summary Card */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
              <Users size={18} color="#059669" />
              <span>Today's Staff Attendance</span>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.74rem', padding: '4px 10px' }}
              onClick={() => onNavigate('attendance')}
            >
              Manage Attendance
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ background: '#ecfdf5', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 700 }}>Present</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#047857', marginTop: '2px' }}>{todayPresent}</div>
            </div>
            <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 700 }}>Absent</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#b91c1c', marginTop: '2px' }}>{todayAbsent}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
