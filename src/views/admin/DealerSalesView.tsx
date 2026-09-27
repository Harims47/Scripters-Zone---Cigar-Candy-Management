import React, { useState, useMemo } from 'react';
import { useHub } from '../../context/HubContext';
import { useToast } from '../../context/ToastContext';
import { HandoverItem } from '../../types';
import { calculateRow, calculateHandover } from '../../utils/handoverCalculation';
import { fromBaseQuantity } from '../../utils/inventoryConversion';
import {
  Store,
  Calendar,
  Phone,
  Search,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Save,
  Banknote,
  Eye,
  Trash2,
  X
} from 'lucide-react';
import { TablePagination } from '../../components/ui/TablePagination';
import { SortableHeader } from '../../components/ui/SortableHeader';
import { TableEmptyState } from '../../components/ui/TableEmptyState';
import { useTableState } from '../../utils/useTableState';

interface DealerRowInput {
  qty: string;
  rate: string;
  discount: string;
}

export const DealerSalesView: React.FC = () => {
  const { products, persons, handovers, addHandover, deleteHandover, getProductStockBase } = useHub();
  const toast = useToast();

  const dealers = useMemo(() => persons.filter((p) => p.role === 'DEALER'), [persons]);

  const [activeTab, setActiveTab] = useState<'RECORD_SALE' | 'SALE_HISTORY'>('RECORD_SALE');

  // Transaction form state
  const [selectedDealerId, setSelectedDealerId] = useState<string>(dealers[0]?.id || '');
  const [buyerName, setBuyerName] = useState<string>('');
  const [buyerPhone, setBuyerPhone] = useState<string>('');
  const [saleDate, setSaleDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');

  // Row inputs mapped by productId: { qty, rate, discount }
  const [rowInputs, setRowInputs] = useState<Record<string, DealerRowInput>>({});

  // History state
  const [historySearch, setHistorySearch] = useState<string>('');
  const [viewDetailHandover, setViewDetailHandover] = useState<(typeof handovers)[0] | null>(null);

  // Active products
  const activeProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.active) return false;
      if (productSearch.trim()) {
        const q = productSearch.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, productSearch]);

  const handleRowChange = (productId: string, field: keyof DealerRowInput, value: string) => {
    setRowInputs((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {
          qty: '',
          rate: String(products.find((p) => p.id === productId)?.rate || 0),
          discount: ''
        }),
        [field]: value
      }
    }));
  };

  // Compute items with row calculation
  const computedItems: HandoverItem[] = useMemo(() => {
    return activeProducts.map((p) => {
      const row = rowInputs[p.id] || {
        qty: '',
        rate: String(p.rate || 0),
        discount: ''
      };
      const qty = parseFloat(row.qty) || 0;
      const rate = parseFloat(row.rate) || p.rate || 0;
      const discount = parseFloat(row.discount) || 0;

      // In a dealer direct sale: Opening = Qty, Closing = 0 -> Sales = Qty
      const calc = calculateRow(qty, 0, 0, rate, discount);

      return {
        productId: p.id,
        productName: p.name,
        category: p.category,
        subCategory: p.subCategory,
        brand: p.brand,
        uom: p.uom,
        opening: qty,
        closing: 0,
        sales: calc.sales,
        free: 0,
        chargeable: calc.chargeable,
        rate,
        grossAmount: calc.grossAmount,
        freeItemValue: 0,
        discount: calc.discount,
        netAmount: calc.netAmount,
        emptyPocketsCollected: 0,
        emptyPocketValue: 0,
        emptyPocketBenefit: 0,
        couponsCollected: 0,
        couponValue: 0,
        couponBenefit: 0
      };
    });
  }, [activeProducts, rowInputs]);

  // Overall totals
  const totals = useMemo(() => {
    const receivedNum = amountReceived === '' ? 0 : parseFloat(amountReceived) || 0;
    return calculateHandover({
      items: computedItems,
      amountReceived: receivedNum
    });
  }, [computedItems, amountReceived]);

  const soldItemsCount = useMemo(() => {
    return computedItems.filter((it) => it.sales > 0).length;
  }, [computedItems]);

  const handleFillFullPayment = () => {
    setAmountReceived(String(totals.expectedHandover));
  };

  const handleSaveDealerSale = (e: React.FormEvent) => {
    e.preventDefault();

    const dealer = persons.find((p) => p.id === selectedDealerId);
    if (!dealer) {
      toast.error('Please select a dealer counter.');
      return;
    }

    if (!buyerName.trim()) {
      toast.error('Please enter buyer / store name.');
      return;
    }

    const itemsToSave = computedItems.filter((it) => it.sales > 0);
    if (itemsToSave.length === 0) {
      toast.error('Please enter quantity for at least one product.');
      return;
    }

    const receivedNum = amountReceived === '' ? totals.expectedHandover : parseFloat(amountReceived) || 0;

    addHandover({
      type: 'DEALER',
      personId: dealer.id,
      personName: dealer.name,
      date: saleDate,
      customerName: buyerName.trim(),
      customerPhone: buyerPhone.trim() || undefined,
      items: itemsToSave,
      salesQuantity: totals.salesQuantity,
      freeQuantity: totals.freeQuantity,
      chargeableQuantity: totals.chargeableQuantity,
      grossSales: totals.grossAmount,
      totalDiscount: totals.manualDiscount,
      freeItemValue: totals.freeItemValue,
      netSales: totals.netSales,
      emptyPocketsCollected: 0,
      emptyPocketBenefit: 0,
      emptyPocketAmount: 0,
      couponsCollected: 0,
      couponBenefit: 0,
      couponAmount: 0,
      expectedHandover: totals.expectedHandover,
      totalExpected: totals.expectedHandover,
      amountReceived: receivedNum,
      outstanding: Math.max(0, totals.expectedHandover - receivedNum),
      excess: Math.max(0, receivedNum - totals.expectedHandover),
      status: (totals.expectedHandover - receivedNum > 0) ? 'OUTSTANDING' : (receivedNum - totals.expectedHandover > 0) ? 'EXCESS' : 'SETTLED',
      notes: notes.trim() || undefined
    });

    toast.success(`Dealer sale recorded for ${buyerName.trim()} (₹${totals.expectedHandover.toLocaleString('en-IN')})!`);

    // Reset inputs
    setBuyerName('');
    setBuyerPhone('');
    setNotes('');
    setAmountReceived('');
    setRowInputs({});
  };

  // Dealer Sales History
  const dealerHistory = useMemo(() => {
    return handovers
      .filter((h) => h.type === 'DEALER')
      .filter((h) => {
        if (!historySearch.trim()) return true;
        const q = historySearch.toLowerCase();
        return (
          h.personName.toLowerCase().includes(q) ||
          h.handoverNumber.toLowerCase().includes(q) ||
          (h.customerName && h.customerName.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [handovers, historySearch]);

  const historySortExtractors = useMemo(() => ({
    handoverNumber: (h: (typeof handovers)[0]) => h.handoverNumber || '',
    date: (h: (typeof handovers)[0]) => new Date(h.date).getTime(),
    personName: (h: (typeof handovers)[0]) => h.personName || '',
    customerName: (h: (typeof handovers)[0]) => h.customerName || '',
    itemCount: (h: (typeof handovers)[0]) => h.items.length || 0,
    netSales: (h: (typeof handovers)[0]) => h.netSales || 0,
    amountReceived: (h: (typeof handovers)[0]) => h.amountReceived || 0,
    status: (h: (typeof handovers)[0]) => h.status || ''
  }), []);

  const historyTable = useTableState({
    data: dealerHistory,
    initialSortField: 'date',
    initialSortDirection: 'desc',
    initialPageSize: 10,
    pageSizeOptions: [10, 25, 50, 100],
    sortExtractors: historySortExtractors
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: '#ffffff',
          padding: '16px 20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Dealer Sales & Wholesale
          </h2>
          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '3px' }}>
            Record wholesale counter transactions, multi-product consignments, and buyer billing directly from one table.
          </div>
        </div>

        {/* Tab switch */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('RECORD_SALE')}
            style={{
              padding: '6px 16px',
              fontSize: '0.82rem',
              fontWeight: 700,
              border: 'none',
              borderRadius: '7px',
              cursor: 'pointer',
              background: activeTab === 'RECORD_SALE' ? '#ffffff' : 'transparent',
              color: activeTab === 'RECORD_SALE' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'RECORD_SALE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Record Dealer Sale
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SALE_HISTORY')}
            style={{
              padding: '6px 16px',
              fontSize: '0.82rem',
              fontWeight: 700,
              border: 'none',
              borderRadius: '7px',
              cursor: 'pointer',
              background: activeTab === 'SALE_HISTORY' ? '#ffffff' : 'transparent',
              color: activeTab === 'SALE_HISTORY' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'SALE_HISTORY' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Sales History ({dealerHistory.length})
          </button>
        </div>
      </div>

      {activeTab === 'RECORD_SALE' ? (
        /* ================= RECORD DEALER SALE WORKFLOW ================= */
        <form onSubmit={handleSaveDealerSale} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header Operational Details Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px',
              background: '#ffffff',
              padding: '16px 20px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            {/* Dealer Counter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                Dealer / Counter:
              </label>
              <select
                value={selectedDealerId}
                onChange={(e) => setSelectedDealerId(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  outline: 'none',
                  background: '#ffffff',
                  minWidth: '180px'
                }}
              >
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Buyer Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                Buyer / Store Name *:
              </label>
              <input
                type="text"
                placeholder="e.g. Sri Balaji Agency"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  outline: 'none',
                  minWidth: '200px'
                }}
              />
            </div>

            {/* Buyer Phone */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                Buyer Phone:
              </label>
              <input
                type="text"
                placeholder="e.g. 9876543210"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  outline: 'none',
                  width: '140px'
                }}
              />
            </div>

            {/* Date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                Sale Date:
              </label>
              <input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  outline: 'none'
                }}
              />
            </div>

            {/* Product Search */}
            <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                Filter Products:
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                <input
                  type="text"
                  placeholder="Search item..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  style={{
                    padding: '8px 12px 8px 30px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    width: '160px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Multi-Product Entry Table */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 800 }}>Product</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right' }}>Stock</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800, width: '140px', color: '#2563eb' }}>
                    Qty Sold
                  </th>
                  <th style={{ padding: '12px 14px', fontWeight: 800, width: '130px', textAlign: 'right' }}>
                    Rate (₹)
                  </th>
                  <th style={{ padding: '12px 14px', fontWeight: 800, width: '130px', textAlign: 'right', color: '#ea580c' }}>
                    Discount (₹)
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 800, width: '140px', textAlign: 'right', color: '#059669' }}>
                    Net (₹)
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                      No active products match search.
                    </td>
                  </tr>
                ) : (
                  activeProducts.map((p) => {
                    const row = rowInputs[p.id] || {
                      qty: '',
                      rate: String(p.rate || 0),
                      discount: ''
                    };
                    const qty = parseFloat(row.qty) || 0;
                    const rate = parseFloat(row.rate) || p.rate || 0;
                    const discount = parseFloat(row.discount) || 0;
                    const net = Math.max(0, qty * rate - discount);

                    const baseStock = getProductStockBase(p.id);
                    const stockInUOM = fromBaseQuantity(p, baseStock, p.uom);

                    const isEntered = qty > 0;

                    return (
                      <tr
                        key={p.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: isEntered ? '#f0fdf4' : 'transparent',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        {/* Product Info */}
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{p.name}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {p.sku} • {p.brand} ({p.category})
                          </div>
                        </td>

                        {/* Available Stock */}
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: stockInUOM <= 10 ? '#dc2626' : '#64748b' }}>
                          {stockInUOM.toLocaleString()}
                        </td>

                        {/* Qty Sold Input */}
                        <td style={{ padding: '8px 14px' }}>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={row.qty}
                            onChange={(e) => handleRowChange(p.id, 'qty', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: isEntered ? '2px solid #16a34a' : '1px solid #cbd5e1',
                              fontSize: '0.86rem',
                              fontWeight: 700,
                              outline: 'none'
                            }}
                          />
                        </td>

                        {/* Rate Input */}
                        <td style={{ padding: '8px 14px' }}>
                          <input
                            type="number"
                            min="0"
                            value={row.rate}
                            onChange={(e) => handleRowChange(p.id, 'rate', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '0.86rem',
                              textAlign: 'right',
                              fontWeight: 600,
                              outline: 'none'
                            }}
                          />
                        </td>

                        {/* Discount Input */}
                        <td style={{ padding: '8px 14px' }}>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={row.discount}
                            onChange={(e) => handleRowChange(p.id, 'discount', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: discount > 0 ? '1.5px solid #ea580c' : '1px solid #cbd5e1',
                              fontSize: '0.86rem',
                              textAlign: 'right',
                              outline: 'none'
                            }}
                          />
                        </td>

                        {/* Net Amount */}
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 800, color: '#059669', fontSize: '0.9rem' }}>
                          ₹{net.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Financial Reconciliation & Action Bar */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
            }}
          >
            {/* Summary figures */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Items Sold</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{soldItemsCount} items</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Gross Total</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                  ₹{totals.grossSales.toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#ea580c' }}>Total Discount</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ea580c' }}>
                  -₹{totals.manualDiscount.toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>Net Payable</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#059669' }}>
                  ₹{totals.expectedHandover.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Payment & Submit */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                  Amount Handed Over:
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '7px', fontWeight: 700, color: '#64748b', fontSize: '0.84rem' }}>
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    placeholder={String(totals.expectedHandover)}
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    style={{
                      padding: '7px 12px 7px 24px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      width: '130px',
                      outline: 'none'
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleFillFullPayment}
                  style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                >
                  Full Paid
                </button>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 24px',
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  background: soldItemsCount > 0 ? '#16a34a' : '#2563eb'
                }}
              >
                <Save size={18} />
                <span>Save Dealer Sale</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* ================= DEALER SALES HISTORY TAB ================= */
        <div className="table-container">
          <div className="table-toolbar">
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                Dealer Transactions Register
              </h3>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                Showing {historyTable.totalItems} invoices
              </div>
            </div>

            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search buyer or invoice..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 12px 7px 30px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  outline: 'none',
                  background: '#f8fafc'
                }}
              />
              {historySearch && (
                <button
                  type="button"
                  onClick={() => setHistorySearch('')}
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
            <table className="data-table" style={{ width: '100%', minWidth: '850px' }}>
              <thead>
                <tr>
                  <SortableHeader label="Invoice #" field="handoverNumber" currentSortField={historyTable.sortField} currentSortDirection={historyTable.sortDirection} onSort={historyTable.toggleSort} />
                  <SortableHeader label="Date" field="date" currentSortField={historyTable.sortField} currentSortDirection={historyTable.sortDirection} onSort={historyTable.toggleSort} />
                  <SortableHeader label="Dealer Counter" field="personName" currentSortField={historyTable.sortField} currentSortDirection={historyTable.sortDirection} onSort={historyTable.toggleSort} />
                  <SortableHeader label="Buyer / Store" field="customerName" currentSortField={historyTable.sortField} currentSortDirection={historyTable.sortDirection} onSort={historyTable.toggleSort} />
                  <SortableHeader label="Items" field="itemCount" currentSortField={historyTable.sortField} currentSortDirection={historyTable.sortDirection} onSort={historyTable.toggleSort} align="center" />
                  <SortableHeader label="Net Sales (₹)" field="netSales" currentSortField={historyTable.sortField} currentSortDirection={historyTable.sortDirection} onSort={historyTable.toggleSort} align="right" />
                  <SortableHeader label="Received (₹)" field="amountReceived" currentSortField={historyTable.sortField} currentSortDirection={historyTable.sortDirection} onSort={historyTable.toggleSort} align="right" />
                  <SortableHeader label="Status" field="status" currentSortField={historyTable.sortField} currentSortDirection={historyTable.sortDirection} onSort={historyTable.toggleSort} align="center" />
                  <th style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {historyTable.pagedData.length === 0 ? (
                  <TableEmptyState
                    colSpan={9}
                    title={historySearch ? 'No matching dealer sales' : 'No dealer sales recorded'}
                    description={
                      historySearch
                        ? `No dealer sales matched "${historySearch}".`
                        : 'No dealer sales recorded yet.'
                    }
                    icon={<Store size={28} />}
                  />
                ) : (
                  historyTable.pagedData.map((h) => (
                    <tr key={h.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#4f46e5' }}>
                        {h.handoverNumber}
                      </td>
                      <td style={{ padding: '12px 12px', color: '#64748b' }}>{h.date}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>{h.personName}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{h.customerName || '—'}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'center' }}>{h.items.length}</td>
                      <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                        ₹{h.netSales.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 700 }}>
                        ₹{h.amountReceived.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                        {h.status === 'SETTLED' ? (
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: '#ecfdf5', color: '#047857' }}>
                            SETTLED
                          </span>
                        ) : h.status === 'EXCESS' ? (
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: '#eff6ff', color: '#1d4ed8' }}>
                            EXCESS
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: '#fef2f2', color: '#dc2626' }}>
                            DUE ₹{h.outstanding.toLocaleString('en-IN')}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => setViewDetailHandover(h)}
                            title="View items"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon danger"
                            onClick={() => {
                              if (window.confirm(`Delete dealer transaction ${h.handoverNumber}?`)) {
                                deleteHandover(h.id);
                                toast.info('Transaction deleted.');
                              }
                            }}
                            title="Delete transaction"
                          >
                            <Trash2 size={15} />
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
            currentPage={historyTable.currentPage}
            pageSize={historyTable.pageSize}
            totalItems={historyTable.totalItems}
            onPageChange={historyTable.setPage}
            onPageSizeChange={historyTable.setPageSize}
            itemLabel="invoices"
          />
        </div>
      )}

      {/* Detail Modal */}
      {viewDetailHandover && (
        <div className="modal-backdrop" onClick={() => setViewDetailHandover(null)}>
          <div className="modal-content" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontWeight: 800 }}>
                Invoice {viewDetailHandover.handoverNumber} — {viewDetailHandover.customerName}
              </h3>
              <button type="button" onClick={() => setViewDetailHandover(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Product</th>
                  <th style={{ padding: '8px 8px', textAlign: 'right' }}>Qty</th>
                  <th style={{ padding: '8px 8px', textAlign: 'right' }}>Rate</th>
                  <th style={{ padding: '8px 8px', textAlign: 'right' }}>Discount</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Net Amount</th>
                </tr>
              </thead>
              <tbody>
                {viewDetailHandover.items.map((it) => (
                  <tr key={it.productId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700 }}>{it.productName}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{it.sales}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>₹{it.rate}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', color: '#ea580c' }}>
                      {it.discount > 0 ? `-₹${it.discount}` : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>
                      ₹{it.netAmount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
