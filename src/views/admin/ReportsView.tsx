import React, { useState, useMemo, useEffect } from 'react';
import { useHub } from '../../context/HubContext';
import { TableExportButtons } from '../../components/ui/TableExportButtons';
import {
  isEligibleHandover,
  getHandoverGrossSales,
  getHandoverTotalDiscount,
  getHandoverEmptyPacketBenefit,
  getHandoverCouponBenefit,
  getSalesLedgerNetSales,
  calculateManagementProfitAndLoss
} from '../../utils/financialCalculations';
import {
  BarChart3,
  Calendar,
  Filter,
  User,
  Store,
  Package,
  Layers,
  AlertTriangle,
  Tag,
  Coins,
  Wallet,
  Clock,
  Target,
  TrendingUp,
  FileText,
  ChevronDown,
  ChevronRight,
  BookOpen,
  DollarSign,
  Search,
  X
} from 'lucide-react';
import { TablePagination } from '../../components/ui/TablePagination';
import { SortableHeader } from '../../components/ui/SortableHeader';
import { TableEmptyState } from '../../components/ui/TableEmptyState';
import { useTableState } from '../../utils/useTableState';

export type ReportTab =
  | 'SALES_LEDGER'
  | 'SALESMAN'
  | 'DEALER'
  | 'ITEM'
  | 'ITEM_COMPARISON'
  | 'OUTSTANDING'
  | 'EMPTY_POCKET'
  | 'COUPON'
  | 'FREE_PRODUCT'
  | 'DISCOUNT'
  | 'EXPENSES'
  | 'TARGET_PERFORMANCE'
  | 'PROFIT_LOSS'
  | 'INVENTORY_MOVEMENT';

export interface ReportsViewProps {
  initialTab?: ReportTab;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ initialTab = 'SALES_LEDGER' }) => {
  const {
    handovers,
    outstandings,
    expenses,
    products,
    persons,
    salesTargets,
    inventoryMovements,
    salesmanLedger
  } = useHub();

  const [activeTab, setActiveTab] = useState<ReportTab>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Common Date Filter
  const [startDate, setStartDate] = useState('2026-09-01');
  const [endDate, setEndDate] = useState('2026-09-30');

  // Sales Ledger specific filters
  const [ledgerRecipientType, setLedgerRecipientType] = useState<'ALL' | 'SALESMAN' | 'DEALER'>('ALL');
  const [ledgerRecipientId, setLedgerRecipientId] = useState<string>('ALL');

  // Other filters
  const [selectedPersonId, setSelectedPersonId] = useState('ALL');
  const [selectedProductId, setSelectedProductId] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [selectedExpenseCat, setSelectedExpenseCat] = useState('ALL');

  // State to track expanded rows in Sales Ledger
  const [expandedHandoverIds, setExpandedHandoverIds] = useState<Record<string, boolean>>({});

  const toggleHandoverExpand = (id: string) => {
    setExpandedHandoverIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Base date-filtered handovers
  const dateFilteredHandovers = useMemo(() => {
    return handovers.filter((h) => h.date >= startDate && h.date <= endDate);
  }, [handovers, startDate, endDate]);

  // ==========================================
  // TAB 1: SALES LEDGER REPORT (Change Set 2)
  // Combines Salesman & Dealer Daily Handovers
  // ==========================================
  const salesLedgerData = useMemo(() => {
    // 1. Eligible handovers (exclude DRAFT and CANCELLED)
    const eligible = dateFilteredHandovers.filter((h) => isEligibleHandover(h));

    // 2. Filter by recipient type
    const byType = eligible.filter((h) => {
      if (ledgerRecipientType === 'ALL') return true;
      return h.type === ledgerRecipientType;
    });

    // 3. Filter by individual recipient
    const byRecipient = byType.filter((h) => {
      if (ledgerRecipientId === 'ALL') return true;
      return h.personId === ledgerRecipientId;
    });

    // 4. Process each handover
    const rows = byRecipient.map((h) => {
      const allItems = h.items || [];
      const matchingItems = allItems.filter((it) => {
        if (selectedProductId === 'ALL') return true;
        return it.productId === selectedProductId;
      });

      // Product sales for matching items
      const grossSales = matchingItems.reduce((sum, it) => {
        const ch = it.chargeable ?? Math.max(0, (it.sales || 0) - (it.free || 0));
        return sum + ch * (it.rate || 0);
      }, 0);

      const itemDiscount = matchingItems.reduce((sum, it) => sum + (it.discount || 0), 0);

      // Handover-level benefits counted once per handover
      const emptyPacket = getHandoverEmptyPacketBenefit(h);
      const coupon = getHandoverCouponBenefit(h);

      // If product filter is active, expected net sales reflects filtered items & benefits
      const netSales = grossSales - itemDiscount - (selectedProductId === 'ALL' ? emptyPacket + coupon : 0);

      const isProvisional = h.status === 'SUBMITTED';

      return {
        id: h.id,
        date: h.date,
        handoverNumber: h.handoverNumber,
        recipientName: h.personName,
        recipientType: h.type,
        grossSales,
        itemDiscount,
        emptyPacket,
        coupon,
        netSales: selectedProductId === 'ALL' ? getSalesLedgerNetSales(h) : netSales,
        status: h.status,
        isProvisional,
        items: matchingItems
      };
    });

    // Exclude handovers with 0 matching items if product filter is applied
    const filteredRows = selectedProductId === 'ALL' ? rows : rows.filter((r) => r.items.length > 0);

    // 5 Primary KPI Cards
    const totalGrossSales = filteredRows.reduce((sum, r) => sum + r.grossSales, 0);
    const totalDiscount = filteredRows.reduce((sum, r) => sum + r.itemDiscount, 0);
    const totalEmptyPacket = filteredRows.reduce((sum, r) => sum + r.emptyPacket, 0);
    const totalCoupon = filteredRows.reduce((sum, r) => sum + r.coupon, 0);
    const totalNetSales = totalGrossSales - totalDiscount - totalEmptyPacket - totalCoupon;

    // Cumulative breakdown by Recipient
    const recipientMap = new Map<
      string,
      {
        personId: string;
        name: string;
        type: 'SALESMAN' | 'DEALER';
        gross: number;
        discount: number;
        emptyPacket: number;
        coupon: number;
        netSales: number;
      }
    >();

    filteredRows.forEach((r) => {
      const existing = recipientMap.get(r.recipientName) || {
        personId: r.id,
        name: r.recipientName,
        type: r.recipientType,
        gross: 0,
        discount: 0,
        emptyPacket: 0,
        coupon: 0,
        netSales: 0
      };

      existing.gross += r.grossSales;
      existing.discount += r.itemDiscount;
      existing.emptyPacket += r.emptyPacket;
      existing.coupon += r.coupon;
      existing.netSales += r.netSales;

      recipientMap.set(r.recipientName, existing);
    });

    const recipientBreakdown = Array.from(recipientMap.values()).sort((a, b) => b.netSales - a.netSales);

    return {
      rows: filteredRows,
      kpis: {
        totalGrossSales,
        totalDiscount,
        totalEmptyPacket,
        totalCoupon,
        totalNetSales
      },
      recipientBreakdown
    };
  }, [dateFilteredHandovers, ledgerRecipientType, ledgerRecipientId, selectedProductId]);

  const [salesLedgerSearch, setSalesLedgerSearch] = useState('');

  const filteredSalesLedgerRows = useMemo(() => {
    if (!salesLedgerSearch.trim()) return salesLedgerData.rows;
    const q = salesLedgerSearch.toLowerCase().trim();
    return salesLedgerData.rows.filter(
      (r) =>
        r.handoverNumber.toLowerCase().includes(q) ||
        r.recipientName.toLowerCase().includes(q) ||
        r.recipientType.toLowerCase().includes(q)
    );
  }, [salesLedgerData.rows, salesLedgerSearch]);

  const salesLedgerSortExtractors = useMemo(() => ({
    date: (r: (typeof salesLedgerData.rows)[0]) => new Date(r.date).getTime(),
    handoverNumber: (r: (typeof salesLedgerData.rows)[0]) => r.handoverNumber || '',
    recipientName: (r: (typeof salesLedgerData.rows)[0]) => r.recipientName || '',
    recipientType: (r: (typeof salesLedgerData.rows)[0]) => r.recipientType || '',
    grossSales: (r: (typeof salesLedgerData.rows)[0]) => r.grossSales || 0,
    itemDiscount: (r: (typeof salesLedgerData.rows)[0]) => r.itemDiscount || 0,
    emptyPacket: (r: (typeof salesLedgerData.rows)[0]) => r.emptyPacket || 0,
    coupon: (r: (typeof salesLedgerData.rows)[0]) => r.coupon || 0,
    netSales: (r: (typeof salesLedgerData.rows)[0]) => r.netSales || 0,
    status: (r: (typeof salesLedgerData.rows)[0]) => r.status || ''
  }), []);

  const salesLedgerTable = useTableState({
    data: filteredSalesLedgerRows,
    initialSortField: 'date',
    initialSortDirection: 'desc',
    initialPageSize: 10,
    pageSizeOptions: [10, 25, 50, 100],
    sortExtractors: salesLedgerSortExtractors
  });

  const recipientBreakdownSortExtractors = useMemo(() => ({
    name: (r: (typeof salesLedgerData.recipientBreakdown)[0]) => r.name || '',
    type: (r: (typeof salesLedgerData.recipientBreakdown)[0]) => r.type || '',
    gross: (r: (typeof salesLedgerData.recipientBreakdown)[0]) => r.gross || 0,
    discount: (r: (typeof salesLedgerData.recipientBreakdown)[0]) => r.discount || 0,
    emptyPacket: (r: (typeof salesLedgerData.recipientBreakdown)[0]) => r.emptyPacket || 0,
    coupon: (r: (typeof salesLedgerData.recipientBreakdown)[0]) => r.coupon || 0,
    netSales: (r: (typeof salesLedgerData.recipientBreakdown)[0]) => r.netSales || 0
  }), []);

  const recipientBreakdownTable = useTableState({
    data: salesLedgerData.recipientBreakdown,
    initialSortField: 'netSales',
    initialSortDirection: 'desc',
    initialPageSize: 10,
    pageSizeOptions: [10, 25, 50, 100],
    sortExtractors: recipientBreakdownSortExtractors
  });

  // Tab 2: Salesman Report
  const salesmanData = useMemo(() => {
    const rows: any[] = [];
    dateFilteredHandovers
      .filter((h) => h.type === 'SALESMAN' && h.status !== 'CANCELLED')
      .filter((h) => selectedPersonId === 'ALL' || h.personId === selectedPersonId)
      .forEach((h) => {
        (h.items || [])
          .filter((it) => selectedProductId === 'ALL' || it.productId === selectedProductId)
          .forEach((it) => {
            rows.push({
              salesman: h.personName,
              date: h.date,
              product: it.productName,
              opening: it.opening,
              closing: it.closing,
              sales: it.sales,
              free: it.free,
              chargeable: it.chargeable ?? Math.max(0, it.sales - it.free),
              gross: it.grossAmount,
              discount: it.discount,
              net: it.netAmount
            });
          });
      });
    return rows;
  }, [dateFilteredHandovers, selectedPersonId, selectedProductId]);

  // Tab 3: Dealer Report
  const dealerData = useMemo(() => {
    const rows: any[] = [];
    dateFilteredHandovers
      .filter((h) => h.type === 'DEALER' && h.status !== 'CANCELLED')
      .filter((h) => selectedPersonId === 'ALL' || h.personId === selectedPersonId)
      .forEach((h) => {
        (h.items || [])
          .filter((it) => selectedProductId === 'ALL' || it.productId === selectedProductId)
          .forEach((it) => {
            rows.push({
              dealer: h.personName,
              customer: h.customerName || '—',
              date: h.date,
              product: it.productName,
              opening: it.opening,
              closing: it.closing,
              sales: it.sales,
              free: it.free,
              chargeable: it.chargeable ?? Math.max(0, it.sales - it.free),
              gross: it.grossAmount,
              discount: it.discount,
              net: it.netAmount
            });
          });
      });
    return rows;
  }, [dateFilteredHandovers, selectedPersonId, selectedProductId]);

  // Tab 4: Item-wise Report
  const itemData = useMemo(() => {
    const map = new Map<string, { product: string; brand: string; category: string; rate: number; sales: number; free: number; chargeable: number; gross: number; net: number }>();

    dateFilteredHandovers
      .filter((h) => h.status !== 'CANCELLED')
      .forEach((h) => {
        (h.items || [])
          .filter((it) => selectedProductId === 'ALL' || it.productId === selectedProductId)
          .forEach((it) => {
            const existing = map.get(it.productId) || {
              product: it.productName,
              brand: it.brand,
              category: it.category,
              rate: it.rate,
              sales: 0,
              free: 0,
              chargeable: 0,
              gross: 0,
              net: 0
            };
            existing.sales += it.sales;
            existing.free += it.free;
            existing.chargeable += it.chargeable ?? Math.max(0, it.sales - it.free);
            existing.gross += it.grossAmount;
            existing.net += it.netAmount;
            map.set(it.productId, existing);
          });
      });

    return Array.from(map.values());
  }, [dateFilteredHandovers, selectedProductId]);

  // Tab 5: Item Comparison Report
  const comparisonData = useMemo(() => {
    const map = new Map<string, { product: string; opening: number; stockIn: number; stockIssued: number; totalSold: number; freeIssued: number; currentStock: number }>();

    products.forEach((p) => {
      map.set(p.id, {
        product: p.name,
        opening: 0,
        stockIn: 0,
        stockIssued: 0,
        totalSold: 0,
        freeIssued: 0,
        currentStock: 0
      });
    });

    dateFilteredHandovers
      .filter((h) => h.status !== 'CANCELLED')
      .forEach((h) => {
        (h.items || []).forEach((it) => {
          const entry = map.get(it.productId);
          if (entry) {
            entry.totalSold += it.sales;
            entry.freeIssued += it.free;
          }
        });
      });

    return Array.from(map.values());
  }, [products, dateFilteredHandovers]);

  // Tab 6: Outstanding Report
  const outstandingData = useMemo(() => {
    return outstandings.filter((o) => {
      return o.date >= startDate && o.date <= endDate;
    });
  }, [outstandings, startDate, endDate]);

  const totalOutstandingRemaining = outstandingData.reduce((sum, o) => sum + o.remainingAmount, 0);

  const [outstandingSearch, setOutstandingSearch] = useState('');

  const filteredOutstandingData = useMemo(() => {
    if (!outstandingSearch.trim()) return outstandingData;
    const q = outstandingSearch.toLowerCase().trim();
    return outstandingData.filter(
      (o) =>
        o.personName.toLowerCase().includes(q) ||
        o.handoverNumber.toLowerCase().includes(q) ||
        o.personRole.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q)
    );
  }, [outstandingData, outstandingSearch]);

  const outstandingSortExtractors = useMemo(() => ({
    date: (o: (typeof outstandingData)[0]) => new Date(o.date).getTime(),
    handoverNumber: (o: (typeof outstandingData)[0]) => o.handoverNumber || '',
    personName: (o: (typeof outstandingData)[0]) => o.personName || '',
    personRole: (o: (typeof outstandingData)[0]) => o.personRole || '',
    expectedAmount: (o: (typeof outstandingData)[0]) => o.expectedAmount || 0,
    initialReceived: (o: (typeof outstandingData)[0]) => o.initialReceived || 0,
    originalOutstanding: (o: (typeof outstandingData)[0]) => o.originalOutstanding || 0,
    recoveredAmount: (o: (typeof outstandingData)[0]) => Math.max(0, (o.originalOutstanding || 0) - o.remainingAmount),
    remainingAmount: (o: (typeof outstandingData)[0]) => o.remainingAmount || 0,
    status: (o: (typeof outstandingData)[0]) => o.status || ''
  }), []);

  const outstandingTable = useTableState({
    data: filteredOutstandingData,
    initialSortField: 'date',
    initialSortDirection: 'desc',
    initialPageSize: 10,
    pageSizeOptions: [10, 25, 50, 100],
    sortExtractors: outstandingSortExtractors
  });

  // Tab 7: Empty Packet Report
  const emptyPocketData = useMemo(() => {
    return dateFilteredHandovers
      .filter((h) => h.status !== 'CANCELLED' && getHandoverEmptyPacketBenefit(h) > 0)
      .map((h) => ({
        date: h.date,
        handoverNumber: h.handoverNumber,
        personName: h.personName,
        type: h.type,
        collected: h.emptyPacketsCollected ?? h.emptyPocketsCollected ?? 0,
        benefit: getHandoverEmptyPacketBenefit(h)
      }));
  }, [dateFilteredHandovers]);

  const totalEmptyPocketBenefit = emptyPocketData.reduce((sum, r) => sum + r.benefit, 0);

  // Tab 8: Coupon Report
  const couponData = useMemo(() => {
    return dateFilteredHandovers
      .filter((h) => h.status !== 'CANCELLED' && getHandoverCouponBenefit(h) > 0)
      .map((h) => ({
        date: h.date,
        handoverNumber: h.handoverNumber,
        personName: h.personName,
        type: h.type,
        collected: h.couponsCollected || 0,
        benefit: getHandoverCouponBenefit(h)
      }));
  }, [dateFilteredHandovers]);

  const totalCouponBenefit = couponData.reduce((sum, r) => sum + r.benefit, 0);

  // Tab 9: Free Product Report
  const freeProductData = useMemo(() => {
    const rows: any[] = [];
    dateFilteredHandovers
      .filter((h) => h.status !== 'CANCELLED')
      .filter((h) => selectedPersonId === 'ALL' || h.personId === selectedPersonId)
      .forEach((h) => {
        (h.items || [])
          .filter((it) => it.free > 0)
          .filter((it) => selectedProductId === 'ALL' || it.productId === selectedProductId)
          .forEach((it) => {
            rows.push({
              date: h.date,
              recipient: h.personName,
              product: it.productName,
              freeQuantity: it.free,
              rate: it.rate,
              freeValue: it.freeItemValue || it.free * it.rate
            });
          });
      });
    return rows;
  }, [dateFilteredHandovers, selectedPersonId, selectedProductId]);

  const totalFreeQty = freeProductData.reduce((sum, r) => sum + r.freeQuantity, 0);
  const totalFreeVal = freeProductData.reduce((sum, r) => sum + r.freeValue, 0);

  // Tab 10: Discount Tracking
  const discountData = useMemo(() => {
    const rows: any[] = [];
    dateFilteredHandovers
      .filter((h) => h.status !== 'CANCELLED')
      .filter((h) => selectedPersonId === 'ALL' || h.personId === selectedPersonId)
      .forEach((h) => {
        (h.items || [])
          .filter((it) => selectedProductId === 'ALL' || it.productId === selectedProductId)
          .forEach((it) => {
            if (it.discount > 0 || it.grossAmount > 0) {
              rows.push({
                date: h.date,
                salesman: h.personName,
                product: it.productName,
                grossSales: it.grossAmount,
                discount: it.discount,
                netSales: it.netAmount
              });
            }
          });
      });
    return rows;
  }, [dateFilteredHandovers, selectedPersonId, selectedProductId]);

  const totalDiscountGross = discountData.reduce((sum, r) => sum + r.grossSales, 0);
  const totalDiscountAmount = discountData.reduce((sum, r) => sum + r.discount, 0);
  const totalDiscountNet = discountData.reduce((sum, r) => sum + r.netSales, 0);

  // Tab 11: Expenses Report
  const expenseData = useMemo(() => {
    return expenses
      .filter((e) => e.date >= startDate && e.date <= endDate)
      .filter((e) => selectedExpenseCat === 'ALL' || e.category === selectedExpenseCat);
  }, [expenses, startDate, endDate, selectedExpenseCat]);

  // Tab 12: Target Performance Report
  const targetReportData = useMemo(() => {
    return salesTargets.map((target) => {
      const matchingHandovers = handovers.filter((h) => {
        if (h.personId !== target.salesmanId || h.status === 'CANCELLED') return false;
        return target.period === 'DAILY' ? h.date === target.date : h.date.startsWith(target.date.slice(0, 7));
      });
      let actual = 0;
      let targetVal = 0;
      if (target.targetType === 'VALUE') {
        targetVal = target.targetValue || 0;
        actual = matchingHandovers.reduce((sum, h) => sum + h.netSales, 0);
      } else {
        targetVal = target.targetQuantity || 0;
        matchingHandovers.forEach((h) => {
          (h.items || []).forEach((it) => {
            if (it.productId === target.productId) {
              actual += it.sales;
            }
          });
        });
      }
      const remaining = Math.max(0, targetVal - actual);
      const achievementPercent = targetVal > 0 ? Math.round((actual / targetVal) * 100) : 0;
      return {
        ...target,
        targetVal,
        actual,
        remaining,
        achievementPercent
      };
    });
  }, [salesTargets, handovers]);

  // ==========================================
  // TAB 13: PROFIT & LOSS STATEMENT (Change Set 2)
  // Simplified Management Profit Model
  // NET REVENUE = Gross Sales - Item Discounts
  // OPEX = Office + House + GPI + Empty Packet + Coupon (NO Discount)
  // GROSS PROFIT = Net Revenue - OpEx
  // ==========================================
  const profitLossData = useMemo(() => {
    return calculateManagementProfitAndLoss(handovers, expenses, startDate, endDate);
  }, [handovers, expenses, startDate, endDate]);

  // Tab 14: Inventory Movement
  const inventoryMovementData = useMemo(() => {
    return inventoryMovements
      .filter((m) => m.date >= startDate && m.date <= endDate)
      .filter((m) => selectedProductId === 'ALL' || m.productId === selectedProductId);
  }, [inventoryMovements, startDate, endDate, selectedProductId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            Consolidated Reports & Audit Center
          </h1>
          <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
            Unified Sales Ledger, product movement, scrap packet/coupon benefits, and Management Profit & Loss.
          </p>
        </div>
      </div>

      {/* Global Filter Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          background: '#ffffff',
          padding: '12px 18px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={16} color="#64748b" />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Date Range:</span>
          </div>
          <input
            type="date"
            className="input-field"
            style={{ width: '135px', padding: '5px 8px', fontSize: '0.8rem', fontWeight: 600 }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span style={{ color: '#94a3b8' }}>→</span>
          <input
            type="date"
            className="input-field"
            style={{ width: '135px', padding: '5px 8px', fontSize: '0.8rem', fontWeight: 600 }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {/* Sales Ledger Recipient Type & Recipient Filters */}
        {activeTab === 'SALES_LEDGER' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Recipient:</span>
              <select
                className="input-field"
                style={{ width: '110px', padding: '5px 8px', fontSize: '0.8rem', fontWeight: 700 }}
                value={ledgerRecipientType}
                onChange={(e) => {
                  setLedgerRecipientType(e.target.value as any);
                  setLedgerRecipientId('ALL');
                }}
              >
                <option value="ALL">All</option>
                <option value="SALESMAN">Salesman</option>
                <option value="DEALER">Dealer</option>
              </select>
            </div>

            <select
              className="input-field"
              style={{ width: '180px', padding: '5px 8px', fontSize: '0.8rem', fontWeight: 600 }}
              value={ledgerRecipientId}
              onChange={(e) => setLedgerRecipientId(e.target.value)}
            >
              <option value="ALL">All Representatives</option>
              {persons
                .filter((p) => {
                  if (ledgerRecipientType === 'ALL') return true;
                  return p.role === ledgerRecipientType;
                })
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role === 'SALESMAN' ? 'Salesman' : 'Dealer'})
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Item Filter */}
        {(activeTab === 'SALES_LEDGER' || activeTab === 'SALESMAN' || activeTab === 'DEALER' || activeTab === 'ITEM' || activeTab === 'EMPTY_POCKET' || activeTab === 'COUPON' || activeTab === 'FREE_PRODUCT') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
              Product Filter:
            </label>
            <select
              className="input-field"
              style={{ width: '200px', padding: '5px 8px', fontSize: '0.8rem', fontWeight: 700 }}
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
            >
              <option value="ALL">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.brand})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tabs Navigation (Change Set 2: Attendance, Salesman Ledger, Salary removed; Sales Ledger added) */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', borderBottom: '2px solid #e2e8f0', paddingBottom: '6px' }}>
        {[
          { id: 'SALES_LEDGER', label: '1. Sales Ledger' },
          { id: 'SALESMAN', label: '2. Salesman' },
          { id: 'DEALER', label: '3. Dealer' },
          { id: 'ITEM', label: '4. Item-wise' },
          { id: 'OUTSTANDING', label: '5. Outstanding' },
          { id: 'EMPTY_POCKET', label: '6. Empty Packet' },
          { id: 'COUPON', label: '7. Coupon' },
          { id: 'FREE_PRODUCT', label: '8. Free Product' },
          { id: 'DISCOUNT', label: '9. Discounts' },
          { id: 'EXPENSES', label: '10. Expenses' },
          { id: 'TARGET_PERFORMANCE', label: '11. Sales Targets' },
          { id: 'PROFIT_LOSS', label: '12. Profit & Loss' },
          { id: 'INVENTORY_MOVEMENT', label: '13. Inventory Movement' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.78rem', padding: '6px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab(tab.id as ReportTab)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============================================================== */}
      {/* TAB 1: SALES LEDGER REPORT (Change Set 2 Section 5, 6, 7, 8) */}
      {/* ============================================================== */}
      {activeTab === 'SALES_LEDGER' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Section 6: Five Primary KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                1. Total Gross Sales
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
                ₹{salesLedgerData.kpis.totalGrossSales.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                SUM(chargeable × sales rate)
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
                2. Total Discount
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#dc2626', marginTop: '4px' }}>
                ₹{salesLedgerData.kpis.totalDiscount.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                Company-borne item discounts
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#c2410c', textTransform: 'uppercase' }}>
                3. Total Empty Packet
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#c2410c', marginTop: '4px' }}>
                ₹{salesLedgerData.kpis.totalEmptyPacket.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#9a3412', marginTop: '2px' }}>
                Scrap handover benefits
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>
                4. Total Coupon
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#b45309', marginTop: '4px' }}>
                ₹{salesLedgerData.kpis.totalCoupon.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#92400e', marginTop: '2px' }}>
                Denomination × Qty rebates
              </div>
            </div>

            <div
              style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                color: '#ffffff',
                borderRadius: '12px',
                padding: '16px 20px',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)'
              }}
            >
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                5. Net Sales / Expected Handover
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#38bdf8', marginTop: '4px' }}>
                ₹{salesLedgerData.kpis.totalNetSales.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#cbd5e1', marginTop: '2px' }}>
                Gross - Discount - Packet - Coupon (Distinct from P&L Net Revenue)
              </div>
            </div>
          </div>

          {/* Section 7: Detailed Sales Ledger Report Table Card */}
          <div className="table-container">
            <div className="table-toolbar">
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                  Handover Transactions Statement ({startDate} to {endDate})
                </h3>
                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                  Click row or expand icon to drill down into product-level lines • Showing {salesLedgerTable.totalItems} handovers
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ position: 'relative', width: '220px' }}>
                  <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Search ref or recipient..."
                    value={salesLedgerSearch}
                    onChange={(e) => setSalesLedgerSearch(e.target.value)}
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
                  {salesLedgerSearch && (
                    <button
                      type="button"
                      onClick={() => setSalesLedgerSearch('')}
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
                <span style={{ fontSize: '0.74rem', color: '#475569', background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>
                  {salesLedgerTable.totalItems} records
                </span>
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table" style={{ width: '100%', minWidth: '950px' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '10px 12px', width: '36px' }}></th>
                    <SortableHeader label="Date" field="date" currentSortField={salesLedgerTable.sortField} currentSortDirection={salesLedgerTable.sortDirection} onSort={salesLedgerTable.toggleSort} />
                    <SortableHeader label="Handover Ref" field="handoverNumber" currentSortField={salesLedgerTable.sortField} currentSortDirection={salesLedgerTable.sortDirection} onSort={salesLedgerTable.toggleSort} />
                    <SortableHeader label="Recipient Name" field="recipientName" currentSortField={salesLedgerTable.sortField} currentSortDirection={salesLedgerTable.sortDirection} onSort={salesLedgerTable.toggleSort} />
                    <SortableHeader label="Recipient Type" field="recipientType" currentSortField={salesLedgerTable.sortField} currentSortDirection={salesLedgerTable.sortDirection} onSort={salesLedgerTable.toggleSort} />
                    <SortableHeader label="Gross Sales" field="grossSales" currentSortField={salesLedgerTable.sortField} currentSortDirection={salesLedgerTable.sortDirection} onSort={salesLedgerTable.toggleSort} align="right" />
                    <SortableHeader label="Item Discount" field="itemDiscount" currentSortField={salesLedgerTable.sortField} currentSortDirection={salesLedgerTable.sortDirection} onSort={salesLedgerTable.toggleSort} align="right" />
                    <SortableHeader label="Empty Packet" field="emptyPacket" currentSortField={salesLedgerTable.sortField} currentSortDirection={salesLedgerTable.sortDirection} onSort={salesLedgerTable.toggleSort} align="right" />
                    <SortableHeader label="Coupon" field="coupon" currentSortField={salesLedgerTable.sortField} currentSortDirection={salesLedgerTable.sortDirection} onSort={salesLedgerTable.toggleSort} align="right" />
                    <SortableHeader label="Net Sales / Expected" field="netSales" currentSortField={salesLedgerTable.sortField} currentSortDirection={salesLedgerTable.sortDirection} onSort={salesLedgerTable.toggleSort} align="right" />
                    <SortableHeader label="Status" field="status" currentSortField={salesLedgerTable.sortField} currentSortDirection={salesLedgerTable.sortDirection} onSort={salesLedgerTable.toggleSort} align="center" />
                  </tr>
                </thead>
                <tbody>
                  {salesLedgerTable.pagedData.length === 0 ? (
                    <TableEmptyState
                      colSpan={11}
                      title={salesLedgerSearch ? 'No matching handovers' : 'No eligible handovers found'}
                      description={
                        salesLedgerSearch
                          ? `No handovers matched "${salesLedgerSearch}".`
                          : 'No eligible handovers found in this date range.'
                      }
                      icon={<FileText size={28} />}
                    />
                  ) : (
                    salesLedgerTable.pagedData.map((row) => {
                      const isExpanded = !!expandedHandoverIds[row.id];
                      return (
                        <React.Fragment key={row.id}>
                          <tr
                            style={{
                              borderBottom: isExpanded ? 'none' : '1px solid #f1f5f9',
                              cursor: 'pointer',
                              background: isExpanded ? '#f8fafc' : '#ffffff'
                            }}
                            onClick={() => toggleHandoverExpand(row.id)}
                          >
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </td>
                            <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{row.date}</td>
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                              {row.handoverNumber}
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>
                              {row.recipientName}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  background: row.recipientType === 'SALESMAN' ? '#eff6ff' : '#f0fdf4',
                                  color: row.recipientType === 'SALESMAN' ? '#1d4ed8' : '#15803d'
                                }}
                              >
                                {row.recipientType}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                              ₹{row.grossSales.toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: row.itemDiscount > 0 ? '#dc2626' : '#94a3b8', fontWeight: 700 }}>
                              {row.itemDiscount > 0 ? `-₹${row.itemDiscount.toLocaleString('en-IN')}` : '₹0'}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: row.emptyPacket > 0 ? '#c2410c' : '#94a3b8', fontWeight: 700 }}>
                              {row.emptyPacket > 0 ? `-₹${row.emptyPacket.toLocaleString('en-IN')}` : '₹0'}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: row.coupon > 0 ? '#b45309' : '#94a3b8', fontWeight: 700 }}>
                              {row.coupon > 0 ? `-₹${row.coupon.toLocaleString('en-IN')}` : '₹0'}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>
                              ₹{row.netSales.toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              {row.isProvisional ? (
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: '#fffbeb', color: '#b45309' }}>
                                  PROVISIONAL
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#047857' }}>
                                  {row.status}
                                </span>
                              )}
                            </td>
                          </tr>

                          {/* Product-level detail drill-down */}
                          {isExpanded && (
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                              <td colSpan={11} style={{ padding: '12px 20px' }}>
                                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                                  <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#334155', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Product Line Items in Handover {row.handoverNumber}:</span>
                                    {selectedProductId !== 'ALL' && (
                                      <span style={{ color: '#2563eb' }}>Filtered to selected product</span>
                                    )}
                                  </div>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                    <thead>
                                      <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                                        <th style={{ padding: '6px 10px', fontWeight: 700 }}>Product</th>
                                        <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'center' }}>Opening</th>
                                        <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'center' }}>Closing</th>
                                        <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'center' }}>Sales Qty</th>
                                        <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'center' }}>Free Qty</th>
                                        <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'center', background: '#e2e8f0' }}>Chargeable Qty</th>
                                        <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>Recorded Rate</th>
                                        <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>Gross</th>
                                        <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>Item Discount</th>
                                        <th style={{ padding: '6px 10px', fontWeight: 700, textAlign: 'right' }}>Net Item Sales</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {row.items.map((it, idx) => {
                                        const ch = it.chargeable ?? Math.max(0, it.sales - it.free);
                                        const gr = it.grossAmount ?? (ch * it.rate);
                                        const net = it.netAmount ?? (gr - it.discount);
                                        return (
                                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '6px 10px', fontWeight: 700, color: '#0f172a' }}>{it.productName}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>{it.opening}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>{it.closing}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>{it.sales}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'center', color: it.free > 0 ? '#b45309' : '#94a3b8' }}>{it.free}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800, color: '#2563eb', background: '#f8fafc' }}>{ch}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'right' }}>₹{it.rate}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>₹{gr.toLocaleString('en-IN')}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'right', color: it.discount > 0 ? '#dc2626' : '#94a3b8' }}>
                                              {it.discount > 0 ? `-₹${it.discount.toLocaleString('en-IN')}` : '₹0'}
                                            </td>
                                            <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>₹{net.toLocaleString('en-IN')}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>

                                  {/* Handover level benefits callout */}
                                  <div style={{ marginTop: '8px', padding: '6px 10px', background: '#f8fafc', borderRadius: '6px', fontSize: '0.72rem', color: '#64748b', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                    <span><strong>Handover Benefits (Counted once per handover):</strong></span>
                                    <span>Empty Packet: <strong>₹{row.emptyPacket.toLocaleString('en-IN')}</strong></span>
                                    <span>Coupon: <strong>₹{row.coupon.toLocaleString('en-IN')}</strong></span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination
              currentPage={salesLedgerTable.currentPage}
              pageSize={salesLedgerTable.pageSize}
              totalItems={salesLedgerTable.totalItems}
              onPageChange={salesLedgerTable.setPage}
              onPageSizeChange={salesLedgerTable.setPageSize}
              itemLabel="handovers"
            />
          </div>

          {/* Section 8: Cumulative Totals by Recipient (Salesman & Dealer) */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                Cumulative Totals by Recipient (Salesman & Dealer Breakdown)
              </h3>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                Combined summary across field representatives and wholesale dealers
              </div>
            </div>

            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <SortableHeader label="Recipient Name" field="name" currentSortField={recipientBreakdownTable.sortField} currentSortDirection={recipientBreakdownTable.sortDirection} onSort={recipientBreakdownTable.toggleSort} />
                    <SortableHeader label="Type" field="type" currentSortField={recipientBreakdownTable.sortField} currentSortDirection={recipientBreakdownTable.sortDirection} onSort={recipientBreakdownTable.toggleSort} />
                    <SortableHeader label="Gross Sales" field="gross" currentSortField={recipientBreakdownTable.sortField} currentSortDirection={recipientBreakdownTable.sortDirection} onSort={recipientBreakdownTable.toggleSort} align="right" />
                    <SortableHeader label="Item Discount" field="discount" currentSortField={recipientBreakdownTable.sortField} currentSortDirection={recipientBreakdownTable.sortDirection} onSort={recipientBreakdownTable.toggleSort} align="right" />
                    <SortableHeader label="Empty Packet" field="emptyPacket" currentSortField={recipientBreakdownTable.sortField} currentSortDirection={recipientBreakdownTable.sortDirection} onSort={recipientBreakdownTable.toggleSort} align="right" />
                    <SortableHeader label="Coupon" field="coupon" currentSortField={recipientBreakdownTable.sortField} currentSortDirection={recipientBreakdownTable.sortDirection} onSort={recipientBreakdownTable.toggleSort} align="right" />
                    <SortableHeader label="Net Sales" field="netSales" currentSortField={recipientBreakdownTable.sortField} currentSortDirection={recipientBreakdownTable.sortDirection} onSort={recipientBreakdownTable.toggleSort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {recipientBreakdownTable.pagedData.length === 0 ? (
                    <TableEmptyState
                      colSpan={7}
                      title="No recipients found"
                      description="No representatives or dealers found for the current filter criteria."
                      icon={<User size={28} />}
                    />
                  ) : (
                    recipientBreakdownTable.pagedData.map((r, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 800, color: '#0f172a' }}>{r.name}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: r.type === 'SALESMAN' ? '#eff6ff' : '#f0fdf4',
                              color: r.type === 'SALESMAN' ? '#1d4ed8' : '#15803d'
                            }}
                          >
                            {r.type}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                          ₹{r.gross.toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: r.discount > 0 ? '#dc2626' : '#94a3b8', fontWeight: 700 }}>
                          {r.discount > 0 ? `-₹${r.discount.toLocaleString('en-IN')}` : '₹0'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: r.emptyPacket > 0 ? '#c2410c' : '#94a3b8', fontWeight: 700 }}>
                          {r.emptyPacket > 0 ? `-₹${r.emptyPacket.toLocaleString('en-IN')}` : '₹0'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: r.coupon > 0 ? '#b45309' : '#94a3b8', fontWeight: 700 }}>
                          {r.coupon > 0 ? `-₹${r.coupon.toLocaleString('en-IN')}` : '₹0'}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 900, color: '#059669', fontSize: '0.92rem' }}>
                          ₹{r.netSales.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0', fontWeight: 900 }}>
                    <td style={{ padding: '12px 16px' }} colSpan={2}>Grand Total</td>
                    <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                      ₹{salesLedgerData.kpis.totalGrossSales.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 12px', textAlign: 'right', color: '#dc2626' }}>
                      -₹{salesLedgerData.kpis.totalDiscount.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 12px', textAlign: 'right', color: '#c2410c' }}>
                      -₹{salesLedgerData.kpis.totalEmptyPacket.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 12px', textAlign: 'right', color: '#b45309' }}>
                      -₹{salesLedgerData.kpis.totalCoupon.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#059669', fontSize: '1rem' }}>
                      ₹{salesLedgerData.kpis.totalNetSales.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <TablePagination
              currentPage={recipientBreakdownTable.currentPage}
              pageSize={recipientBreakdownTable.pageSize}
              totalItems={recipientBreakdownTable.totalItems}
              onPageChange={recipientBreakdownTable.setPage}
              onPageSizeChange={recipientBreakdownTable.setPageSize}
              itemLabel="recipients"
            />
          </div>
        </div>
      )}

      {/* Tab 2: Salesman Report */}
      {activeTab === 'SALESMAN' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Salesman</th>
                <th style={{ padding: '10px 10px', fontWeight: 800 }}>Date</th>
                <th style={{ padding: '10px 10px', fontWeight: 800 }}>Product</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>Opening</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>Closing</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>Sales</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>Free</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center', background: '#f1f5f9' }}>Chargeable</th>
                <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Gross (₹)</th>
                <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Discount (₹)</th>
                <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Net (₹)</th>
              </tr>
            </thead>
            <tbody>
              {salesmanData.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    No salesman sales recorded in this date range.
                  </td>
                </tr>
              ) : (
                salesmanData.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{r.salesman}</td>
                    <td style={{ padding: '10px 10px', color: '#64748b' }}>{r.date}</td>
                    <td style={{ padding: '10px 10px', fontWeight: 600 }}>{r.product}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>{r.opening}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>{r.closing}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600 }}>{r.sales}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', color: r.free > 0 ? '#b45309' : '#94a3b8' }}>{r.free}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, color: '#2563eb', background: '#f8fafc' }}>{r.chargeable}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600 }}>₹{r.gross.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', color: r.discount > 0 ? '#dc2626' : '#94a3b8' }}>
                      {r.discount > 0 ? `-₹${r.discount.toLocaleString('en-IN')}` : '₹0'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>₹{r.net.toLocaleString('en-IN')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Dealer Report */}
      {activeTab === 'DEALER' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Dealer Name</th>
                <th style={{ padding: '10px 10px', fontWeight: 800 }}>Customer / Store</th>
                <th style={{ padding: '10px 10px', fontWeight: 800 }}>Date</th>
                <th style={{ padding: '10px 10px', fontWeight: 800 }}>Product</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>Opening</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>Closing</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>Sales</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center', background: '#f1f5f9' }}>Chargeable</th>
                <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Gross (₹)</th>
                <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Discount (₹)</th>
                <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Net (₹)</th>
              </tr>
            </thead>
            <tbody>
              {dealerData.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    No dealer wholesale sales recorded in this date range.
                  </td>
                </tr>
              ) : (
                dealerData.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{r.dealer}</td>
                    <td style={{ padding: '10px 10px', color: '#64748b' }}>{r.customer}</td>
                    <td style={{ padding: '10px 10px', color: '#64748b' }}>{r.date}</td>
                    <td style={{ padding: '10px 10px', fontWeight: 600 }}>{r.product}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>{r.opening}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>{r.closing}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600 }}>{r.sales}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, color: '#2563eb', background: '#f8fafc' }}>{r.chargeable}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600 }}>₹{r.gross.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', color: r.discount > 0 ? '#dc2626' : '#94a3b8' }}>
                      {r.discount > 0 ? `-₹${r.discount.toLocaleString('en-IN')}` : '₹0'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>₹{r.net.toLocaleString('en-IN')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Item-wise Report */}
      {activeTab === 'ITEM' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Product</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Brand</th>
                <th style={{ padding: '10px 10px', fontWeight: 800 }}>Category</th>
                <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Rate (₹)</th>
                <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'center' }}>Total Sales</th>
                <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'center' }}>Total Free</th>
                <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'center', background: '#f1f5f9' }}>Total Chargeable</th>
                <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>Gross Sales (₹)</th>
                <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Net Sales (₹)</th>
              </tr>
            </thead>
            <tbody>
              {itemData.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700 }}>{r.product}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{r.brand}</td>
                  <td style={{ padding: '10px 10px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#eff6ff', color: '#1d4ed8' }}>
                      {r.category}
                    </span>
                  </td>
                  <td style={{ padding: '10px 10px', textAlign: 'right' }}>₹{r.rate}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 600 }}>{r.sales}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'center', color: r.free > 0 ? '#b45309' : '#94a3b8' }}>{r.free}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 800, color: '#2563eb', background: '#f8fafc' }}>{r.chargeable}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>₹{r.gross.toLocaleString('en-IN')}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>₹{r.net.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 5: Item Comparison */}
      {activeTab === 'ITEM_COMPARISON' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                <th style={{ padding: '10px 16px', fontWeight: 800 }}>Product</th>
                <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>Total Sold (Units)</th>
                <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>Free Issued (Units)</th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 700 }}>{r.product}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: '#059669' }}>{r.totalSold}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: r.freeIssued > 0 ? '#b45309' : '#94a3b8' }}>{r.freeIssued}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 5: Outstanding Report Card */}
      {activeTab === 'OUTSTANDING' && (
        <div className="table-container">
          <div className="table-toolbar">
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>Total Unsettled Outstanding</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#dc2626', marginTop: '2px' }}>₹{totalOutstandingRemaining.toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>Tracking {outstandingTable.totalItems} records in period</div>
            </div>
            <div style={{ position: 'relative', width: '240px' }}>
              <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search person or handover..."
                value={outstandingSearch}
                onChange={(e) => setOutstandingSearch(e.target.value)}
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
              {outstandingSearch && (
                <button
                  type="button"
                  onClick={() => setOutstandingSearch('')}
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
                  <SortableHeader label="Date" field="date" currentSortField={outstandingTable.sortField} currentSortDirection={outstandingTable.sortDirection} onSort={outstandingTable.toggleSort} />
                  <SortableHeader label="Handover #" field="handoverNumber" currentSortField={outstandingTable.sortField} currentSortDirection={outstandingTable.sortDirection} onSort={outstandingTable.toggleSort} />
                  <SortableHeader label="Person" field="personName" currentSortField={outstandingTable.sortField} currentSortDirection={outstandingTable.sortDirection} onSort={outstandingTable.toggleSort} />
                  <SortableHeader label="Role" field="personRole" currentSortField={outstandingTable.sortField} currentSortDirection={outstandingTable.sortDirection} onSort={outstandingTable.toggleSort} />
                  <SortableHeader label="Expected (₹)" field="expectedAmount" currentSortField={outstandingTable.sortField} currentSortDirection={outstandingTable.sortDirection} onSort={outstandingTable.toggleSort} align="right" />
                  <SortableHeader label="Initial Paid (₹)" field="initialReceived" currentSortField={outstandingTable.sortField} currentSortDirection={outstandingTable.sortDirection} onSort={outstandingTable.toggleSort} align="right" />
                  <SortableHeader label="Original Due (₹)" field="originalOutstanding" currentSortField={outstandingTable.sortField} currentSortDirection={outstandingTable.sortDirection} onSort={outstandingTable.toggleSort} align="right" />
                  <SortableHeader label="Recovered (₹)" field="recoveredAmount" currentSortField={outstandingTable.sortField} currentSortDirection={outstandingTable.sortDirection} onSort={outstandingTable.toggleSort} align="right" />
                  <SortableHeader label="Remaining (₹)" field="remainingAmount" currentSortField={outstandingTable.sortField} currentSortDirection={outstandingTable.sortDirection} onSort={outstandingTable.toggleSort} align="right" />
                  <SortableHeader label="Status" field="status" currentSortField={outstandingTable.sortField} currentSortDirection={outstandingTable.sortDirection} onSort={outstandingTable.toggleSort} align="center" />
                </tr>
              </thead>
              <tbody>
                {outstandingTable.pagedData.length === 0 ? (
                  <TableEmptyState
                    colSpan={10}
                    title={outstandingSearch ? 'No matching outstanding records' : 'No outstanding records found'}
                    description={
                      outstandingSearch
                        ? `No outstanding records matched "${outstandingSearch}".`
                        : 'No outstanding records recorded in this date range.'
                    }
                    icon={<AlertTriangle size={28} />}
                  />
                ) : (
                  outstandingTable.pagedData.map((o) => {
                    const recovered = Math.max(0, (o.originalOutstanding || 0) - o.remainingAmount);

                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px' }}>{o.date}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{o.handoverNumber}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>{o.personName}</td>
                        <td style={{ padding: '10px 10px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#f1f5f9' }}>
                            {o.personRole}
                          </span>
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right' }}>₹{o.expectedAmount.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right' }}>₹{o.initialReceived.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right' }}>₹{o.originalOutstanding.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: recovered > 0 ? '#059669' : '#94a3b8' }}>
                          {recovered > 0 ? `₹${recovered.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: o.remainingAmount > 0 ? '#dc2626' : '#059669' }}>
                          ₹{o.remainingAmount.toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background:
                                o.status === 'SETTLED'
                                  ? '#ecfdf5'
                                  : o.status === 'PARTIALLY PAID'
                                  ? '#fffbeb'
                                  : '#fef2f2',
                              color:
                                o.status === 'SETTLED'
                                  ? '#047857'
                                  : o.status === 'PARTIALLY PAID'
                                  ? '#b45309'
                                  : '#b91c1c'
                            }}
                          >
                            {o.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={outstandingTable.currentPage}
            pageSize={outstandingTable.pageSize}
            totalItems={outstandingTable.totalItems}
            onPageChange={outstandingTable.setPage}
            onPageSizeChange={outstandingTable.setPageSize}
            itemLabel="outstandings"
          />
        </div>
      )}

      {/* Tab 7: Empty Packet Report */}
      {activeTab === 'EMPTY_POCKET' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: '#ffffff', border: '1px solid #fed7aa', borderRadius: '10px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#c2410c', textTransform: 'uppercase' }}>Total Empty Packet Benefit in Period</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#c2410c', marginTop: '2px' }}>₹{totalEmptyPocketBenefit.toLocaleString('en-IN')}</div>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Counted once per eligible handover</span>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '10px 16px', fontWeight: 800 }}>Date</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Handover #</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Salesman / Dealer</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Type</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>Packets Handed In</th>
                  <th style={{ padding: '10px 16px', fontWeight: 800, textAlign: 'right' }}>Benefit Deducted (₹)</th>
                </tr>
              </thead>
              <tbody>
                {emptyPocketData.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 16px' }}>{r.date}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{r.handoverNumber}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{r.personName}</td>
                    <td style={{ padding: '10px 12px' }}>{r.type}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>{r.collected}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 900, color: '#c2410c' }}>₹{r.benefit.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 8: Coupon Report */}
      {activeTab === 'COUPON' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: '#ffffff', border: '1px solid #fde68a', borderRadius: '10px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>Total Coupon Benefit in Period</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#b45309', marginTop: '2px' }}>₹{totalCouponBenefit.toLocaleString('en-IN')}</div>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Counted once per eligible handover</span>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '10px 16px', fontWeight: 800 }}>Date</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Handover #</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Salesman / Dealer</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Type</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>Coupons Count</th>
                  <th style={{ padding: '10px 16px', fontWeight: 800, textAlign: 'right' }}>Coupon Benefit (₹)</th>
                </tr>
              </thead>
              <tbody>
                {couponData.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 16px' }}>{r.date}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{r.handoverNumber}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{r.personName}</td>
                    <td style={{ padding: '10px 12px' }}>{r.type}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>{r.collected}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 900, color: '#b45309' }}>₹{r.benefit.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 9: Free Product Report */}
      {activeTab === 'FREE_PRODUCT' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Free Quantity Issued</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>{totalFreeQty}</div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>Free Product Informational Value</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#b45309', marginTop: '2px' }}>₹{totalFreeVal.toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Excluded from revenue deductions</div>
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 800 }}>Date</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Recipient</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Product Name</th>
                  <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'center' }}>Free Qty</th>
                  <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Standard Rate (₹)</th>
                  <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Free Value (₹)</th>
                </tr>
              </thead>
              <tbody>
                {freeProductData.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px' }}>{r.date}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{r.recipient}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.product}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 700, color: '#b45309' }}>{r.freeQuantity}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right' }}>₹{r.rate}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#475569' }}>₹{r.freeValue.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 10: Discount Tracking */}
      {activeTab === 'DISCOUNT' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Gross Sales</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>₹{totalDiscountGross.toLocaleString('en-IN')}</div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>Total Company-Borne Discount</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#dc2626', marginTop: '2px' }}>-₹{totalDiscountAmount.toLocaleString('en-IN')}</div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>Net Revenue</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#059669', marginTop: '2px' }}>₹{totalDiscountNet.toLocaleString('en-IN')}</div>
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 800 }}>Date</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Salesman / Dealer</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Product Name</th>
                  <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Gross Sales (₹)</th>
                  <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Discount (₹)</th>
                  <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Net Sales (₹)</th>
                </tr>
              </thead>
              <tbody>
                {discountData.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px' }}>{r.date}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{r.salesman}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.product}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right' }}>₹{r.grossSales.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>
                      {r.discount > 0 ? `-₹${r.discount.toLocaleString('en-IN')}` : '₹0'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>₹{r.netSales.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 11: Expenses Report */}
      {activeTab === 'EXPENSES' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Date</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Category</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Description</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Paid By</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Reference</th>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Notes</th>
                <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {expenseData.map((e) => (
                <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px' }}>{e.date}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: '#eff6ff', color: '#1d4ed8' }}>
                      {e.category}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{e.description}</td>
                  <td style={{ padding: '10px 12px' }}>{e.paidBy || 'Admin'}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{e.reference || '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#64748b' }}>{e.notes || '—'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800 }}>₹{e.amount.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 12: Target Performance */}
      {activeTab === 'TARGET_PERFORMANCE' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Salesman</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Target Type</th>
                <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>Target</th>
                <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>Actual Sold</th>
                <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>Remaining</th>
                <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'center' }}>Achievement</th>
              </tr>
            </thead>
            <tbody>
              {targetReportData.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700 }}>{t.salesmanName}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 7px', borderRadius: '4px', background: '#f1f5f9' }}>
                      {t.targetType}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                    {t.targetType === 'VALUE' ? `₹${t.targetVal.toLocaleString('en-IN')}` : `${t.targetVal}`}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                    {t.targetType === 'VALUE' ? `₹${t.actual.toLocaleString('en-IN')}` : `${t.actual}`}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: t.remaining > 0 ? '#b45309' : '#059669' }}>
                    {t.targetType === 'VALUE' ? `₹${t.remaining.toLocaleString('en-IN')}` : `${t.remaining}`}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: t.achievementPercent >= 80 ? '#059669' : '#b45309' }}>
                    {t.achievementPercent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 13: PROFIT & LOSS STATEMENT (Change Set 2 Section 13-18) */}
      {/* Three Primary Cards & Management Financial Statement */}
      {/* ============================================================== */}
      {activeTab === 'PROFIT_LOSS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Section 14: Three Primary Cards ONLY */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            {/* Card 1: NET REVENUE */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px 22px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Net Revenue
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', marginTop: '6px' }}>
                ₹{profitLossData.netRevenue.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px' }}>
                Gross Sales (₹{profitLossData.grossSales.toLocaleString('en-IN')}) less Company-Borne Discounts (₹{profitLossData.totalDiscounts.toLocaleString('en-IN')})
              </div>
            </div>

            {/* Card 2: TOTAL EXPENSES */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px 22px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Expenses
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#dc2626', marginTop: '6px' }}>
                ₹{profitLossData.expenses.total.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px' }}>
                Office, House, GPI + Handover Scrap Empty Packet & Coupons (Discounts excluded)
              </div>
            </div>

            {/* Card 3: GROSS PROFIT (Management Profit) */}
            <div
              style={{
                background: profitLossData.grossProfit >= 0 ? '#ecfdf5' : '#fef2f2',
                border: `1.5px solid ${profitLossData.grossProfit >= 0 ? '#a7f3d0' : '#fecaca'}`,
                borderRadius: '12px',
                padding: '20px 22px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
              }}
            >
              <div style={{ fontSize: '0.74rem', fontWeight: 900, color: profitLossData.grossProfit >= 0 ? '#047857' : '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Gross Profit
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 900, color: profitLossData.grossProfit >= 0 ? '#047857' : '#b91c1c', marginTop: '6px' }}>
                ₹{profitLossData.grossProfit.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: profitLossData.grossProfit >= 0 ? '#065f46' : '#991b1b', marginTop: '4px' }}>
                Net revenue less selected operating expenses; excludes inventory purchase costs.
              </div>
            </div>
          </div>

          {/* Section 18: Management Financial Statement Table */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                  Operational Management Profit & Loss Statement
                </h3>
                <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                  Period: {startDate} to {endDate} • Operational management view (excludes inventory purchase costs)
                </div>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, background: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: '6px' }}>
                Company-Borne Discount Deducted Once
              </span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 20px', fontWeight: 700, color: '#0f172a' }}>Gross Sales</td>
                  <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                    ₹{profitLossData.grossSales.toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#dc2626' }}>
                  <td style={{ padding: '12px 20px', paddingLeft: '36px' }}>Less: Company-Borne Item Discounts</td>
                  <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700 }}>
                    -₹{profitLossData.totalDiscounts.toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr style={{ borderBottom: '2px solid #cbd5e1', background: '#f8fafc' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 900, color: '#0f172a', fontSize: '0.96rem' }}>NET REVENUE</td>
                  <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 900, color: '#0f172a', fontSize: '1.02rem' }}>
                    ₹{profitLossData.netRevenue.toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                  <td style={{ padding: '10px 20px', fontWeight: 800, color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase' }} colSpan={2}>
                    Less: Operating Expenses
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#475569' }}>
                  <td style={{ padding: '10px 20px', paddingLeft: '36px' }}>Office & Administrative Expense</td>
                  <td style={{ padding: '10px 20px', textAlign: 'right' }}>
                    ₹{profitLossData.expenses.office.toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#475569' }}>
                  <td style={{ padding: '10px 20px', paddingLeft: '36px' }}>House Expense</td>
                  <td style={{ padding: '10px 20px', textAlign: 'right' }}>
                    ₹{profitLossData.expenses.house.toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#475569' }}>
                  <td style={{ padding: '10px 20px', paddingLeft: '36px' }}>GPI Brand Promotional Expense</td>
                  <td style={{ padding: '10px 20px', textAlign: 'right' }}>
                    ₹{profitLossData.expenses.gpi.toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#c2410c' }}>
                  <td style={{ padding: '10px 20px', paddingLeft: '36px' }}>Empty Packet Benefit (from Daily Handover)</td>
                  <td style={{ padding: '10px 20px', textAlign: 'right', fontWeight: 600 }}>
                    ₹{profitLossData.expenses.emptyPacket.toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#b45309' }}>
                  <td style={{ padding: '10px 20px', paddingLeft: '36px' }}>Coupon Benefit (from Daily Handover)</td>
                  <td style={{ padding: '10px 20px', textAlign: 'right', fontWeight: 600 }}>
                    ₹{profitLossData.expenses.coupon.toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr style={{ borderBottom: '2px solid #cbd5e1', background: '#f8fafc' }}>
                  <td style={{ padding: '12px 20px', fontWeight: 800, color: '#dc2626' }}>TOTAL OPERATING EXPENSES</td>
                  <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 800, color: '#dc2626', fontSize: '0.95rem' }}>
                    -₹{profitLossData.expenses.total.toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr style={{ background: profitLossData.grossProfit >= 0 ? '#ecfdf5' : '#fef2f2' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 900, fontSize: '1.05rem', color: profitLossData.grossProfit >= 0 ? '#047857' : '#b91c1c' }}>
                    GROSS PROFIT (Management Profit)
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 900, fontSize: '1.25rem', color: profitLossData.grossProfit >= 0 ? '#047857' : '#b91c1c' }}>
                    ₹{profitLossData.grossProfit.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 14: Inventory Movement */}
      {activeTab === 'INVENTORY_MOVEMENT' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Date</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Product</th>
                <th style={{ padding: '10px 10px', fontWeight: 800 }}>Type</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Reference</th>
                <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Display Qty</th>
                <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Base Inflow/Outflow</th>
                <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>Running Stock (Base)</th>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {inventoryMovementData.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px' }}>{m.date}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700 }}>{m.productName}</td>
                  <td style={{ padding: '10px 10px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 7px', borderRadius: '4px', background: '#f1f5f9' }}>
                      {m.transactionType}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{m.reference}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right' }}>{m.displayQuantity}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, color: m.baseQuantity > 0 ? '#059669' : '#dc2626' }}>
                    {m.baseQuantity > 0 ? `+${m.baseQuantity}` : `${m.baseQuantity}`}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800 }}>{m.runningStockBase}</td>
                  <td style={{ padding: '10px 14px', color: '#64748b' }}>{m.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}


    </div>
  );
};
