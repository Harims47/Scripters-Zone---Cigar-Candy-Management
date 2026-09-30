import React, { useState, useMemo, useEffect } from 'react';
import { useHub } from '../../context/HubContext';
import { useToast } from '../../context/ToastContext';
import {
  HandoverItem,
  DailyHandover,
  HandoverStatus
} from '../../types';
import { calculateRow, calculateHandover } from '../../utils/handoverCalculation';
import { CouponEditorModal, CouponRow } from '../modals/CouponEditorModal';
import {
  Receipt,
  CheckCircle2,
  AlertTriangle,
  User,
  Store,
  Calendar,
  Phone,
  Tag,
  Coins,
  Plus,
  Trash2,
  Edit2,
  Search,
  X,
  Package
} from 'lucide-react';

interface HandoverEntryFormProps {
  initialType?: 'SALESMAN' | 'DEALER';
  defaultPersonId?: string;
  onSuccess?: (handover: DailyHandover) => void;
  onCancel?: () => void;
}

export const HandoverEntryForm: React.FC<HandoverEntryFormProps> = ({
  initialType = 'SALESMAN',
  defaultPersonId,
  onSuccess,
  onCancel
}) => {
  const { products, persons, quantityIssues, addHandover, activeSession } = useHub();
  const toast = useToast();

  const [handoverType, setHandoverType] = useState<'SALESMAN' | 'DEALER'>(initialType);
  const [selectedPersonId, setSelectedPersonId] = useState<string>(
    defaultPersonId || (initialType === 'SALESMAN' ? persons.find(p => p.role === 'SALESMAN')?.id || '' : persons.find(p => p.role === 'DEALER')?.id || '')
  );
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Find stock issues for this person (prioritize matching date, fallback to all issues for this person)
  const relevantIssues = useMemo(() => {
    const relevantPersonId = selectedPersonId || defaultPersonId;
    if (!relevantPersonId) return [];
    const dateIssues = quantityIssues.filter(
      (qi) => qi.personId === relevantPersonId && qi.date === date && qi.quantityIssued > 0
    );
    if (dateIssues.length > 0) return dateIssues;
    return quantityIssues.filter(
      (qi) => qi.personId === relevantPersonId && qi.quantityIssued > 0
    );
  }, [quantityIssues, selectedPersonId, defaultPersonId, date]);

  // Map of issued quantities keyed by productId
  const issuedProductMap = useMemo(() => {
    const map: Record<string, number> = {};
    relevantIssues.forEach((qi) => {
      map[qi.productId] = (map[qi.productId] || 0) + (qi.quantityIssued || 0);
    });
    return map;
  }, [relevantIssues]);

  // Explicitly added extra product IDs (if admin or salesman needs to add another product to the sheet)
  const [additionalProductIds, setAdditionalProductIds] = useState<string[]>([]);

  // Products assigned/issued for this dealer or salesman (plus any explicitly added)
  const sheetProducts = useMemo(() => {
    const assigned = products.filter((p) => p.active && (issuedProductMap[p.id] || 0) > 0);
    const assignedIds = new Set(assigned.map((p) => p.id));
    const extra = products.filter(
      (p) => p.active && additionalProductIds.includes(p.id) && !assignedIds.has(p.id)
    );
    return [...assigned, ...extra];
  }, [products, issuedProductMap, additionalProductIds]);

  // Remaining active products not currently on the sheet
  const availableToAdd = useMemo(() => {
    const currentIds = new Set(sheetProducts.map((p) => p.id));
    return products.filter((p) => p.active && !currentIds.has(p.id));
  }, [products, sheetProducts]);

  // Row items state keyed by productId
  interface RowState {
    opening: number;
    closing: number;
    free: number;
    discount: number;
  }

  // Pre-fill opening quantities from quantity issues for the selected person if available
  const [rowsState, setRowsState] = useState<Record<string, RowState>>(() => {
    const initial: Record<string, RowState> = {};
    const relevantPersonId = defaultPersonId || selectedPersonId;

    const dateIssues = quantityIssues.filter(
      (qi) => qi.personId === relevantPersonId && qi.date === date && qi.quantityIssued > 0
    );
    const personIssues = dateIssues.length > 0
      ? dateIssues
      : quantityIssues.filter((qi) => qi.personId === relevantPersonId && qi.quantityIssued > 0);

    const map: Record<string, number> = {};
    personIssues.forEach((qi) => {
      map[qi.productId] = (map[qi.productId] || 0) + (qi.quantityIssued || 0);
    });

    products.forEach((p) => {
      initial[p.id] = {
        opening: map[p.id] || 0,
        closing: 0,
        free: 0,
        discount: 0
      };
    });
    return initial;
  });

  // Whenever selected person, date, or quantityIssues change, re-initialize or update rowsState
  useEffect(() => {
    setRowsState((prev) => {
      const next: Record<string, RowState> = { ...prev };
      products.forEach((p) => {
        const openingQty = issuedProductMap[p.id] || 0;
        const existing = prev[p.id];
        if (!existing || existing.opening !== openingQty) {
          next[p.id] = {
            opening: openingQty,
            closing: 0,
            free: 0,
            discount: 0
          };
        }
      });
      return next;
    });
    setAdditionalProductIds([]);
  }, [selectedPersonId, date, issuedProductMap, products]);

  // User-entered Empty Packet state (separate physical count Qty and financial Amount)
  const [productPocketQtys, setProductPocketQtys] = useState<Record<string, number | string>>({});
  const [productPocketAmounts, setProductPocketAmounts] = useState<Record<string, number | string>>({});

  // Product IDs explicitly added to Empty Packet (Optional per product)
  const [addedPocketProductIds, setAddedPocketProductIds] = useState<string[]>([]);

  // Modal / Bottom-sheet state for Add/Edit Empty Packet
  const [isPocketModalOpen, setIsPocketModalOpen] = useState(false);
  const [pocketModalProductId, setPocketModalProductId] = useState('');
  const [pocketModalQty, setPocketModalQty] = useState<string>('');
  const [pocketModalAmount, setPocketModalAmount] = useState<string>('');
  const [pocketModalEditingId, setPocketModalEditingId] = useState<string | null>(null);

  // Change Set 2A: Coupon Denomination rows & Modal State
  const [couponRows, setCouponRows] = useState<CouponRow[]>([]);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);

  const cumulativeCouponBenefit = useMemo(() => {
    return couponRows.reduce((sum, row) => {
      const denom = Math.max(0, Number(row.denomination) || 0);
      const qty = Math.max(0, Number(row.quantity) || 0);
      return sum + denom * qty;
    }, 0);
  }, [couponRows]);

  const handleSaveCoupons = (savedCoupons: CouponRow[]) => {
    setCouponRows(savedCoupons);
  };

  // Mobile product quick search
  const [searchQuery, setSearchQuery] = useState('');

  // Phase 1E: Operational Ownership & Split Collection
  // Salesman submits sheet only; Admin collects Cash & GPay
  const isSalesman = activeSession.role === 'SALESMAN';
  const [cashReceived, setCashReceived] = useState<number | string>('');
  const [gpayReceived, setGpayReceived] = useState<number | string>('');

  const totalAdminReceived = (Number(cashReceived) || 0) + (Number(gpayReceived) || 0);

  const activePersons = persons.filter((p) => p.role === handoverType);
  const currentPerson = persons.find((p) => p.id === selectedPersonId);

  // Compute items with row-level calculation & user-entered product-level benefits
  const computedItems: HandoverItem[] = useMemo(() => {
    return sheetProducts
      .map((p) => {
        const row = rowsState[p.id] || { opening: 0, closing: 0, free: 0, discount: 0 };
        const calc = calculateRow(row.opening, row.closing, row.free, p.rate, row.discount);

        // Qty = physical count collected (>= 0)
        const packetsCollected = Math.max(0, parseInt(String(productPocketQtys[p.id] ?? 0)) || 0);
        // Amount = actual financial benefit manually entered by user (>= 0)
        const packetBenefit = Math.max(0, parseFloat(String(productPocketAmounts[p.id] ?? 0)) || 0);

        return {
          productId: p.id,
          productName: p.name,
          category: p.category,
          subCategory: p.subCategory,
          brand: p.brand,
          uom: p.uom,
          opening: row.opening,
          closing: row.closing,
          sales: calc.sales,
          free: row.free,
          chargeable: calc.chargeable,
          rate: p.rate,
          grossAmount: calc.grossAmount,
          freeItemValue: calc.freeItemValue,
          discount: row.discount,
          netAmount: calc.netAmount,

          emptyPocketsCollected: packetsCollected,
          emptyPocketValue: p.emptyPocketValue || 0,
          emptyPocketBenefit: packetBenefit,
          couponsCollected: 0,
          couponValue: 0,
          couponBenefit: 0
        };
      });
  }, [sheetProducts, rowsState, productPocketQtys, productPocketAmounts]);

  // Overall authoritative totals from centralized calculation engine
  const totals = useMemo(() => {
    return calculateHandover({
      items: computedItems,
      amountReceived: isSalesman ? 0 : totalAdminReceived,
      couponDenominations: couponRows.map((r) => ({
        denomination: Number(r.denomination) || 0,
        quantity: Number(r.quantity) || 0,
        total: (Number(r.denomination) || 0) * (Number(r.quantity) || 0)
      })),
      couponBenefit: cumulativeCouponBenefit
    });
  }, [computedItems, isSalesman, totalAdminReceived, couponRows, cumulativeCouponBenefit]);

  const handleRowChange = (productId: string, field: keyof RowState, val: number) => {
    setRowsState((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || { opening: 0, closing: 0, free: 0, discount: 0 }),
        [field]: Math.max(0, val)
      }
    }));
  };

  const handlePocketQtyChange = (productId: string, val: string) => {
    const safeVal = val === '' ? '' : Math.max(0, parseInt(val) || 0);
    setProductPocketQtys((prev) => ({
      ...prev,
      [productId]: safeVal
    }));
  };

  const handlePocketAmountChange = (productId: string, val: string) => {
    const safeVal = val === '' ? '' : Math.max(0, parseFloat(val) || 0);
    setProductPocketAmounts((prev) => ({
      ...prev,
      [productId]: safeVal
    }));
  };

  const handleTypeChange = (type: 'SALESMAN' | 'DEALER') => {
    setHandoverType(type);
    const firstMatching = persons.find((p) => p.role === type);
    if (firstMatching) {
      setSelectedPersonId(firstMatching.id);
    }
  };

  const handleFillExpected = () => {
    setCashReceived(String(totals.expectedHandover));
    setGpayReceived('0');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPersonId) {
      toast.error('Please select a salesman or dealer.');
      return;
    }

    if (computedItems.length === 0) {
      toast.error('No products in sheet. Issue stock to this person first or add products to sheet.');
      return;
    }

    const person = persons.find((p) => p.id === selectedPersonId);
    if (!person) {
      toast.error('Selected person not found.');
      return;
    }

    if (cashReceived !== '' && Number(cashReceived) < 0) {
      toast.error('Cash received cannot be negative.');
      return;
    }
    if (gpayReceived !== '' && Number(gpayReceived) < 0) {
      toast.error('GPay received cannot be negative.');
      return;
    }

    // Strict Logical Validation
    for (const item of computedItems) {
      if (item.opening < 0 || item.closing < 0 || item.free < 0 || item.discount < 0) {
        toast.error(`Negative values not permitted for "${item.productName}".`);
        return;
      }
      if ((item.emptyPocketsCollected || 0) < 0 || (item.emptyPocketBenefit || 0) < 0) {
        toast.error(`Negative empty packet values not permitted for "${item.productName}".`);
        return;
      }
      if ((item.couponsCollected || 0) < 0 || (item.couponBenefit || 0) < 0) {
        toast.error(`Negative coupon values not permitted for "${item.productName}".`);
        return;
      }
      if (item.closing > item.opening) {
        toast.error(`Invalid quantities for "${item.productName}": Closing quantity (${item.closing}) cannot exceed Opening stock (${item.opening}).`);
        return;
      }
      if (item.free > item.sales) {
        toast.error(`Invalid quantities for "${item.productName}": Free quantity (${item.free}) cannot exceed Sales quantity (${item.sales}).`);
        return;
      }
      if (item.discount > item.grossAmount && item.grossAmount > 0) {
        toast.error(`Invalid discount for "${item.productName}": Manual discount (₹${item.discount}) cannot exceed Gross Sales (₹${item.grossAmount}).`);
        return;
      }
    }

    // Filter to rows with activity (opening > 0 or sales > 0 or pocket/coupon collection/benefit)
    const activeItems = computedItems.filter(
      (i) =>
        i.opening > 0 ||
        i.sales > 0 ||
        i.free > 0 ||
        (i.emptyPocketsCollected || 0) > 0 ||
        (i.emptyPocketBenefit || 0) > 0 ||
        (i.couponsCollected || 0) > 0 ||
        (i.couponBenefit || 0) > 0
    );

    const totalPocketsCount = computedItems.reduce((sum, it) => sum + (it.emptyPocketsCollected || 0), 0);
    const totalCouponsCount = computedItems.reduce((sum, it) => sum + (it.couponsCollected || 0), 0);

    const isSalesmanSubmission = activeSession.role === 'SALESMAN';
    const totalCollected = isSalesmanSubmission ? 0 : totalAdminReceived;
    const diff = totals.expectedHandover - totalCollected;
    const outAmt = isSalesmanSubmission ? 0 : Math.max(0, diff);
    const excessAmt = isSalesmanSubmission ? 0 : Math.max(0, totalCollected - totals.expectedHandover);
    
    let computedStatus: HandoverStatus;
    if (isSalesmanSubmission) {
      computedStatus = 'SUBMITTED';
    } else if (handoverType === 'DEALER') {
      computedStatus = 'COMPLETED';
    } else {
      computedStatus = outAmt > 0 ? 'SHORT' : (excessAmt > 0 ? 'EXCESS' : 'COLLECTED');
    }

    const handoverRecord = addHandover({
      type: handoverType,
      personId: person.id,
      personName: person.name,
      date,
      customerName: handoverType === 'DEALER' ? customerName.trim() : undefined,
      customerPhone: handoverType === 'DEALER' ? customerPhone.trim() : undefined,
      items: activeItems.length > 0 ? activeItems : computedItems,

      salesQuantity: totals.salesQuantity,
      freeQuantity: totals.freeQuantity,
      chargeableQuantity: totals.chargeableQuantity,

      grossSales: totals.grossAmount,
      totalDiscount: totals.manualDiscount,
      freeItemValue: totals.freeItemValue,
      netSales: totals.netSales,

      emptyPocketsCollected: totalPocketsCount,
      emptyPocketBenefit: totals.emptyPocketBenefit,
      emptyPocketAmount: totals.emptyPocketBenefit,

      couponsCollected: totalCouponsCount,
      couponBenefit: totals.couponBenefit,
      couponAmount: totals.couponBenefit,

      expectedHandover: totals.expectedHandover,
      totalExpected: totals.expectedHandover,
      amountReceived: totalCollected,
      cashReceived: isSalesmanSubmission ? undefined : (Number(cashReceived) || 0),
      gpayReceived: isSalesmanSubmission ? undefined : (Number(gpayReceived) || 0),
      difference: isSalesmanSubmission ? totals.expectedHandover : diff,
      outstanding: outAmt,
      excess: excessAmt,
      status: computedStatus,

      submittedAt: isSalesmanSubmission ? new Date().toISOString() : undefined,
      collectedBy: isSalesmanSubmission ? undefined : (activeSession.name || 'Admin'),
      collectedAt: isSalesmanSubmission ? undefined : new Date().toISOString(),

      notes: notes.trim() || undefined
    });

    if (isSalesmanSubmission) {
      toast.success('Handover submitted to Admin! Waiting for collection verification.');
    } else if (handoverType === 'DEALER') {
      toast.success(`Dealer Handover completed! ₹${totalCollected.toLocaleString('en-IN')} collected.`);
    } else if (outAmt > 0) {
      toast.error(`Handover recorded! Shortage of ₹${outAmt.toLocaleString('en-IN')} added to outstanding.`);
    } else {
      toast.success('Handover recorded and collection confirmed in full.');
    }

    if (onSuccess) {
      onSuccess(handoverRecord);
    }
  };

  // Section 1: Empty Pocket & Coupon are OPTIONAL per product.
  // Only products added by user appear in the UI list.
  const activePocketProductIds = useMemo(() => {
    const set = new Set(addedPocketProductIds);
    Object.keys(productPocketAmounts).forEach((id) => {
      if (Number(productPocketAmounts[id]) > 0 || Number(productPocketQtys[id]) > 0) {
        set.add(id);
      }
    });
    return Array.from(set);
  }, [addedPocketProductIds, productPocketAmounts, productPocketQtys]);

  const pocketProductsList = useMemo(() => {
    return products.filter((p) => activePocketProductIds.includes(p.id));
  }, [products, activePocketProductIds]);

  // Section 14: Mobile search filter for products
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return computedItems;
    const q = searchQuery.toLowerCase().trim();
    return computedItems.filter(
      (it) =>
        it.productName.toLowerCase().includes(q) ||
        it.brand.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q) ||
        it.uom.toLowerCase().includes(q)
    );
  }, [computedItems, searchQuery]);

  // Empty Pocket Modal & Action Handlers
  const openAddPocketModal = () => {
    const available = products.filter((p) => p.active && !activePocketProductIds.includes(p.id));
    const defaultId = available.length > 0 ? available[0].id : (products.find((p) => p.active)?.id || '');
    setPocketModalProductId(defaultId);
    setPocketModalQty('');
    setPocketModalAmount('');
    setPocketModalEditingId(null);
    setIsPocketModalOpen(true);
  };

  const openEditPocketModal = (productId: string) => {
    setPocketModalProductId(productId);
    setPocketModalQty(String(productPocketQtys[productId] ?? ''));
    setPocketModalAmount(String(productPocketAmounts[productId] ?? ''));
    setPocketModalEditingId(productId);
    setIsPocketModalOpen(true);
  };

  const handleSavePocket = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!pocketModalProductId) {
      toast.error('Please select a product.');
      return;
    }
    const prod = products.find((p) => p.id === pocketModalProductId);
    // Duplicate Protection (Section 6)
    if (!pocketModalEditingId && activePocketProductIds.includes(pocketModalProductId)) {
      toast.error(`"${prod?.name || 'Product'}" is already added in Empty Packet.`);
      return;
    }
    const qty = Math.max(0, parseInt(pocketModalQty) || 0);
    const amount = Math.max(0, parseFloat(pocketModalAmount) || 0);

    setProductPocketQtys((prev) => ({
      ...prev,
      [pocketModalProductId]: qty
    }));
    setProductPocketAmounts((prev) => ({
      ...prev,
      [pocketModalProductId]: amount
    }));
    setAddedPocketProductIds((prev) => (prev.includes(pocketModalProductId) ? prev : [...prev, pocketModalProductId]));
    setIsPocketModalOpen(false);
    toast.success(`Empty Packet for "${prod?.name || 'Product'}" saved.`);
  };

  const removePocketProduct = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    setAddedPocketProductIds((prev) => prev.filter((id) => id !== productId));
    setProductPocketQtys((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
    setProductPocketAmounts((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
    toast.info(`Removed "${prod?.name || 'Product'}" from Empty Packet.`);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="handover-entry-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* 1. Header: Salesman & Date (Clean & Direct) */}
        <div
          style={{
            background: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            {/* Salesman / Person Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                {handoverType === 'SALESMAN' ? 'Salesman:' : 'Dealer:'}
              </label>
              <select
                className="input-field"
                style={{ fontWeight: 700, fontSize: '0.86rem', padding: '6px 12px', minWidth: '180px' }}
                value={selectedPersonId}
                onChange={(e) => setSelectedPersonId(e.target.value)}
                disabled={activeSession.role === 'SALESMAN'}
              >
                {activePersons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.phone ? `(${p.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Date:</label>
              <div style={{ position: 'relative' }}>
                <Calendar size={14} color="#64748b" style={{ position: 'absolute', left: '8px', top: '9px' }} />
                <input
                  type="date"
                  className="input-field"
                  style={{ padding: '6px 10px 6px 28px', fontWeight: 600, fontSize: '0.84rem' }}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
            {sheetProducts.length} Product{sheetProducts.length === 1 ? '' : 's'} in Daily Sheet
          </div>
        </div>

      {/* 2. Main Product Worksheet (Mobile Card-First + Responsive Desktop Table) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Search bar, counter & Add Product dropdown */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '220px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '380px' }}>
              <Search size={15} color="#64748b" style={{ position: 'absolute', left: '12px', top: '13px' }} />
              <input
                type="text"
                className="input-field"
                placeholder="Search product by name or brand..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '10px 32px 10px 36px', fontSize: '0.86rem', minHeight: '42px', borderRadius: '8px' }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '10px', top: '12px', color: '#94a3b8' }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {availableToAdd.length > 0 && (
              <select
                className="input-field"
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  padding: '9px 12px',
                  borderRadius: '8px',
                  minHeight: '42px',
                  minWidth: '180px',
                  borderColor: '#cbd5e1',
                  background: '#f8fafc',
                  color: '#334155'
                }}
                value=""
                onChange={(e) => {
                  const prodId = e.target.value;
                  if (prodId) {
                    setAdditionalProductIds((prev) => [...prev, prodId]);
                    const p = products.find((prod) => prod.id === prodId);
                    toast.success(`"${p?.name || 'Product'}" added to sheet.`);
                  }
                }}
              >
                <option value="">+ Add Product to Sheet...</option>
                {availableToAdd.map((p) => (
                  <option key={p.id} value={p.id}>
                    + {p.name} ({p.brand}) - ₹{p.rate}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
            Showing {filteredItems.length} of {sheetProducts.length} product{sheetProducts.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Desktop View Table */}
        <div
          className="handover-desktop-only"
          style={{
            border: '1.5px solid #e2e8f0',
            borderRadius: '12px',
            overflow: 'hidden',
            background: '#ffffff'
          }}
        >
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', minWidth: '920px', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 800, minWidth: '170px' }}>Product</th>
                  <th style={{ padding: '10px 6px', fontWeight: 800, textAlign: 'center', width: '80px' }}>Opening</th>
                  <th style={{ padding: '10px 6px', fontWeight: 800, textAlign: 'center', width: '80px', background: '#eff6ff' }}>Closing</th>
                  <th style={{ padding: '10px 6px', fontWeight: 800, textAlign: 'center', width: '70px' }}>Sales</th>
                  <th style={{ padding: '10px 6px', fontWeight: 800, textAlign: 'center', width: '70px' }}>Free</th>
                  <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right', width: '80px' }}>Rate</th>
                  <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right', width: '95px' }}>Total</th>
                  <th style={{ padding: '10px 6px', fontWeight: 800, textAlign: 'center', width: '85px' }}>Discount</th>
                  <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right', width: '100px', background: '#f8fafc' }}>Net</th>
                </tr>
              </thead>
              <tbody>
                {sheetProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '40px 20px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                        <Package size={36} color="#94a3b8" />
                        <div style={{ fontSize: '0.96rem', fontWeight: 700, color: '#334155' }}>
                          No stock items issued to this {handoverType === 'SALESMAN' ? 'salesman' : 'dealer'}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#94a3b8', maxWidth: '440px' }}>
                          Only products issued via <strong>Issue Stock</strong> appear in the daily handover sheet. You can also add products manually using the dropdown above.
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                      No products match "{searchQuery}".
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.productId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {/* Product */}
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>{item.productName}</span>
                          {additionalProductIds.includes(item.productId) && (
                            <button
                              type="button"
                              onClick={() => {
                                setAdditionalProductIds((prev) => prev.filter((id) => id !== item.productId));
                                toast.info(`Removed "${item.productName}" from sheet.`);
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '2px',
                                color: '#ef4444',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                              title="Remove manually added product"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {item.brand} {additionalProductIds.includes(item.productId) ? '• Added manually' : ''}
                        </div>
                      </td>

                      {/* Opening */}
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          className="input-field"
                          style={{ width: '68px', padding: '4px', textAlign: 'center', fontWeight: 700, fontSize: '0.84rem' }}
                          value={item.opening}
                          onChange={(e) => handleRowChange(item.productId, 'opening', parseInt(e.target.value) || 0)}
                        />
                      </td>

                      {/* Closing (User Entry) */}
                      <td style={{ padding: '8px 6px', textAlign: 'center', background: '#f8fafc' }}>
                        <input
                          type="number"
                          min="0"
                          className="input-field"
                          style={{
                            width: '68px',
                            padding: '4px',
                            textAlign: 'center',
                            fontWeight: 800,
                            fontSize: '0.86rem',
                            borderColor: item.closing > item.opening ? '#ef4444' : '#2563eb',
                            background: '#ffffff'
                          }}
                          value={item.closing || ''}
                          onChange={(e) => handleRowChange(item.productId, 'closing', parseInt(e.target.value) || 0)}
                          placeholder="0"
                          title={item.closing > item.opening ? 'Closing cannot exceed Opening' : undefined}
                        />
                      </td>

                      {/* Sales = Opening - Closing */}
                      <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 800, color: item.sales > 0 ? '#0f172a' : '#94a3b8' }}>
                        {item.sales}
                      </td>

                      {/* Free (User Entry) */}
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          className="input-field"
                          style={{
                            width: '60px',
                            padding: '4px',
                            textAlign: 'center',
                            fontWeight: 700,
                            fontSize: '0.84rem',
                            borderColor: item.free > item.sales && item.sales > 0 ? '#ef4444' : undefined,
                            color: item.free > 0 ? '#d97706' : undefined
                          }}
                          value={item.free || ''}
                          onChange={(e) => handleRowChange(item.productId, 'free', parseInt(e.target.value) || 0)}
                          placeholder="0"
                          title={item.free > item.sales && item.sales > 0 ? 'Free cannot exceed Sales' : undefined}
                        />
                      </td>

                      {/* Rate */}
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                        ₹{item.rate}
                      </td>

                      {/* Total = Chargeable × Rate */}
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        ₹{item.grossAmount.toLocaleString('en-IN')}
                      </td>

                      {/* Discount (User Entry) */}
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          className="input-field"
                          style={{
                            width: '74px',
                            padding: '4px',
                            textAlign: 'center',
                            fontWeight: 700,
                            fontSize: '0.84rem',
                            color: item.discount > 0 ? '#ea580c' : undefined
                          }}
                          value={item.discount || ''}
                          onChange={(e) => handleRowChange(item.productId, 'discount', parseFloat(e.target.value) || 0)}
                          placeholder="₹0.00"
                        />
                      </td>

                      {/* Net = Total - Discount */}
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a', background: '#f8fafc' }}>
                        ₹{item.netAmount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile View: Compact Product Cards (No horizontal table scrolling needed) */}
        <div className="handover-mobile-only" style={{ gap: '12px' }}>
          {sheetProducts.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', background: '#ffffff', borderRadius: '12px', border: '1.5px dashed #cbd5e1', color: '#64748b' }}>
              <Package size={36} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#334155' }}>
                No stock items issued to this {handoverType === 'SALESMAN' ? 'salesman' : 'dealer'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
                Only products issued via Issue Stock appear in the daily sheet.
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
              No products match "{searchQuery}".
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.productId}
                style={{
                  background: '#ffffff',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}
              >
                {/* Header: Product Name + Brand & Rate */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a' }}>{item.productName}</span>
                      {additionalProductIds.includes(item.productId) && (
                        <button
                          type="button"
                          onClick={() => {
                            setAdditionalProductIds((prev) => prev.filter((id) => id !== item.productId));
                            toast.info(`Removed "${item.productName}" from sheet.`);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px',
                            color: '#ef4444',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                          title="Remove manually added product"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                      {item.brand} {additionalProductIds.includes(item.productId) ? '• Added manually' : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', color: '#334155' }}>
                    ₹{item.rate}
                  </span>
                </div>

                {/* Primary Row 1: Opening & Closing */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Opening</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{item.opening}</div>
                  </div>

                  <div style={{ background: '#eff6ff', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #3b82f6' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', display: 'block' }}>Closing *</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: '1.05rem',
                        fontWeight: 900,
                        color: '#1d4ed8',
                        background: '#ffffff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '6px',
                        marginTop: '2px',
                        minHeight: '44px',
                        textAlign: 'center'
                      }}
                      value={item.closing || ''}
                      placeholder="0"
                      onChange={(e) => handleRowChange(item.productId, 'closing', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                {/* Primary Row 2: Sales & Free */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ background: item.sales > 0 ? '#f0fdf4' : '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: item.sales > 0 ? '1px solid #bbf7d0' : '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: item.sales > 0 ? '#15803d' : '#64748b', textTransform: 'uppercase' }}>Sales</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 900, color: item.sales > 0 ? '#15803d' : '#94a3b8', marginTop: '2px' }}>{item.sales}</div>
                  </div>

                  <div style={{ background: '#fffbeb', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', display: 'block' }}>Free</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: '1rem',
                        fontWeight: 800,
                        color: '#b45309',
                        background: '#ffffff',
                        border: '1px solid #fde68a',
                        borderRadius: '6px',
                        marginTop: '2px',
                        minHeight: '44px',
                        textAlign: 'center'
                      }}
                      value={item.free || ''}
                      placeholder="0"
                      onChange={(e) => handleRowChange(item.productId, 'free', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                {/* Primary Row 3: Discount Input (Mobile Item-level Discount per Item 4) */}
                <div style={{ background: '#fff7ed', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fed7aa' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#c2410c', textTransform: 'uppercase', display: 'block' }}>Discount (₹)</label>
                  <div style={{ position: 'relative', marginTop: '2px' }}>
                    <span style={{ position: 'absolute', left: '8px', top: '10px', fontSize: '0.85rem', color: '#9a3412', fontWeight: 800 }}>₹</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      style={{
                        width: '100%',
                        padding: '6px 8px 6px 22px',
                        fontSize: '1rem',
                        fontWeight: 800,
                        color: item.discount > 0 ? '#ea580c' : '#0f172a',
                        background: '#ffffff',
                        border: '1px solid #fed7aa',
                        borderRadius: '6px',
                        minHeight: '40px'
                      }}
                      value={item.discount || ''}
                      placeholder="0.00"
                      onChange={(e) => handleRowChange(item.productId, 'discount', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                {/* Row 4: Rate & Total */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px dashed #e2e8f0' }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Rate: <strong style={{ color: '#0f172a' }}>₹{item.rate}</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.76rem', color: '#64748b', marginRight: '6px' }}>Total:</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                      ₹{item.netAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. Empty Pocket & Coupon Sections (Section 1: OPTIONAL PER PRODUCT, ADD ONLY WHEN REQUIRED) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
        {/* EMPTY PKT. Section */}
        <div
          style={{
            background: '#ffffff',
            border: '1.5px solid #fed7aa',
            borderRadius: '12px',
            overflow: 'hidden'
          }}
        >
          <div style={{ padding: '12px 16px', background: '#fff7ed', borderBottom: '1px solid #fed7aa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Tag size={15} color="#c2410c" />
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                EMPTY PACKET
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#ea580c' }}>
                TOTAL: -₹{totals.emptyPacketBenefit.toLocaleString('en-IN')}
              </span>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '5px 12px', fontSize: '0.76rem', fontWeight: 700, minHeight: '34px', background: '#c2410c', borderColor: '#c2410c' }}
                onClick={openAddPocketModal}
              >
                <Plus size={14} />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Desktop Table View of Added Packets */}
          <div className="handover-desktop-only">
            {pocketProductsList.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b' }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '0.84rem' }}>No empty packet recorded for this handover.</p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: 700 }}
                  onClick={openAddPocketModal}
                >
                  <Plus size={14} />
                  <span>+ Add Empty Packet</span>
                </button>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#fafaf9', borderBottom: '1px solid #f2f2f2', textAlign: 'left', color: '#64748b' }}>
                    <th style={{ padding: '8px 14px', fontWeight: 700 }}>Product</th>
                    <th style={{ padding: '8px 8px', fontWeight: 700, textAlign: 'center', width: '80px' }}>Qty</th>
                    <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'right', width: '110px' }}>Amount</th>
                    <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'center', width: '90px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pocketProductsList.map((p) => {
                    const qty = productPocketQtys[p.id] ?? '';
                    const amount = productPocketAmounts[p.id] ?? '';
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: '8px 14px', fontWeight: 600, color: '#0f172a' }}>{p.name}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            className="input-field"
                            style={{ width: '60px', padding: '3px 4px', textAlign: 'center', fontSize: '0.82rem', fontWeight: 700 }}
                            placeholder="0"
                            value={qty}
                            onChange={(e) => handlePocketQtyChange(p.id, e.target.value)}
                          />
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <span style={{ position: 'absolute', left: '6px', top: '5px', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>₹</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="any"
                              className="input-field"
                              style={{
                                width: '85px',
                                padding: '3px 6px 3px 18px',
                                textAlign: 'right',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                color: Number(amount) > 0 ? '#ea580c' : undefined
                              }}
                              placeholder="0"
                              value={amount}
                              onChange={(e) => handlePocketAmountChange(p.id, e.target.value)}
                            />
                          </div>
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => openEditPocketModal(p.id)}
                              style={{ padding: '4px 6px', color: '#475569', borderRadius: '4px' }}
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removePocketProduct(p.id)}
                              style={{ padding: '4px 6px', color: '#ef4444', borderRadius: '4px' }}
                              title="Remove"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Mobile Card View of Added Packets */}
          <div className="handover-mobile-only" style={{ padding: '12px', gap: '8px' }}>
            {pocketProductsList.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '0.82rem' }}>No empty packet recorded.</p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.8rem', fontWeight: 700, minHeight: '42px', width: '100%' }}
                  onClick={openAddPocketModal}
                >
                  <Plus size={15} />
                  <span>+ Add Empty Packet</span>
                </button>
              </div>
            ) : (
              pocketProductsList.map((p) => (
                <div
                  key={p.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #fed7aa',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>{p.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#c2410c', fontWeight: 800, marginTop: '2px' }}>
                      {productPocketQtys[p.id] || 0} qty · ₹{Number(productPocketAmounts[p.id] || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '6px 10px', minHeight: '38px', fontSize: '0.76rem' }}
                      onClick={() => openEditPocketModal(p.id)}
                    >
                      <Edit2 size={13} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '6px 10px', minHeight: '38px', fontSize: '0.76rem', color: '#ef4444' }}
                      onClick={() => removePocketProduct(p.id)}
                    >
                      <Trash2 size={13} />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COUPON Section — Compact Summary Block (Change Set 2A) */}
        <div
          style={{
            background: '#ffffff',
            border: '1.5px solid #fde68a',
            borderRadius: '12px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              background: '#fefce8',
              borderBottom: '1px solid #fde68a',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Coins size={16} color="#b45309" />
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                COUPONS
              </span>
            </div>
            <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#d97706' }}>
              TOTAL: -₹{cumulativeCouponBenefit.toLocaleString('en-IN')}
            </span>
          </div>

          <div
            style={{
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px'
            }}
          >
            <div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Coupon Benefit
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#d97706', marginTop: '2px' }}>
                ₹{cumulativeCouponBenefit.toLocaleString('en-IN')}
              </div>
              {couponRows.length > 0 && cumulativeCouponBenefit > 0 ? (
                <div style={{ fontSize: '0.76rem', color: '#b45309', fontWeight: 700, marginTop: '2px' }}>
                  {couponRows.length} coupon {couponRows.length === 1 ? 'entry' : 'entries'}
                </div>
              ) : (
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
                  No coupons recorded
                </div>
              )}
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{
                padding: '10px 18px',
                fontSize: '0.86rem',
                fontWeight: 800,
                background: '#b45309',
                borderColor: '#b45309',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                minHeight: '42px',
                boxShadow: '0 2px 6px rgba(180, 83, 9, 0.25)'
              }}
              onClick={() => setIsCouponModalOpen(true)}
            >
              {couponRows.length > 0 && cumulativeCouponBenefit > 0 ? (
                <>
                  <Edit2 size={15} />
                  <span>Edit Coupons</span>
                </>
              ) : (
                <>
                  <Plus size={15} />
                  <span>+ Add Coupon</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Reconciliation & Settlement (Section 20: Mobile-First Direct Layout) */}
      <div
        style={{
          background: '#ffffff',
          border: '1.5px solid #cbd5e1',
          borderRadius: '14px',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
        }}
      >
        <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          HANDOVER SUMMARY
        </div>

        {/* Compact Calculation Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '10px',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '14px'
          }}
        >
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>GROSS SALES</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
              ₹{totals.grossAmount.toLocaleString('en-IN')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#ea580c', fontWeight: 700 }}>TOTAL ITEM DISCOUNT</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#ea580c', marginTop: '2px' }}>
              {totals.totalItemDiscounts > 0 ? `-₹${totals.totalItemDiscounts.toLocaleString('en-IN')}` : '₹0'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>NET SALES</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
              ₹{totals.netSales.toLocaleString('en-IN')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#c2410c', fontWeight: 700 }}>EMPTY PACKET</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#ea580c', marginTop: '2px' }}>
              {totals.emptyPacketBenefit > 0 ? `-₹${totals.emptyPacketBenefit.toLocaleString('en-IN')}` : '₹0'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700 }}>COUPONS</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#d97706', marginTop: '2px' }}>
              {totals.couponBenefit > 0 ? `-₹${totals.couponBenefit.toLocaleString('en-IN')}` : '₹0'}
            </div>
          </div>
          <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 800 }}>EXPECTED HANDOVER</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1d4ed8', marginTop: '2px' }}>
              ₹{totals.expectedHandover.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Phase 1E: Split Collection (Admin only - Section 11, 12, 17, 19). Salesman does NOT enter Cash/GPay */}
        {!isSalesman && (
          <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              COLLECTION ({handoverType === 'DEALER' ? 'DEALER PAYMENT' : 'ADMIN COLLECTION'})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', alignItems: 'center' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Cash Received
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '9px', fontSize: '0.9rem', color: '#64748b', fontWeight: 700 }}>₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    className="input-field"
                    style={{ width: '100%', paddingLeft: '24px', fontWeight: 800, fontSize: '1rem' }}
                    placeholder="0.00"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  GPay Received
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '9px', fontSize: '0.9rem', color: '#64748b', fontWeight: 700 }}>₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    className="input-field"
                    style={{ width: '100%', paddingLeft: '24px', fontWeight: 800, fontSize: '1rem' }}
                    placeholder="0.00"
                    value={gpayReceived}
                    onChange={(e) => setGpayReceived(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>TOTAL COLLECTED</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
                  ₹{totalAdminReceived.toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
                  {totals.expectedHandover - totalAdminReceived > 0
                    ? 'DIFFERENCE (SHORT)'
                    : totals.expectedHandover - totalAdminReceived < 0
                    ? 'DIFFERENCE (EXCESS)'
                    : 'DIFFERENCE'}
                </div>
                <div
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 900,
                    color: totals.expectedHandover - totalAdminReceived > 0 ? '#dc2626' : '#059669',
                    marginTop: '2px'
                  }}
                >
                  ₹{Math.abs(totals.expectedHandover - totalAdminReceived).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Remarks / Notes and Submit Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
            <label style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>REMARKS:</label>
            <input
              type="text"
              className="input-field"
              style={{ flex: 1, padding: '9px 12px', fontSize: '0.86rem', minHeight: '42px' }}
              placeholder="Operational notes / remarks (optional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '340px', justifyContent: 'flex-end' }}>
            {onCancel && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onCancel}
                style={{ fontWeight: 700, minHeight: '46px', padding: '10px 16px' }}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                flex: 1,
                minHeight: '48px',
                padding: '11px 20px',
                fontSize: '0.94rem',
                fontWeight: 900,
                background: '#059669',
                borderColor: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 3px 10px rgba(5, 150, 105, 0.3)'
              }}
            >
              <Receipt size={18} />
              <span>
                {isSalesman
                  ? 'SUBMIT HANDOVER'
                  : handoverType === 'DEALER'
                  ? 'SAVE & COMPLETE DEALER HANDOVER'
                  : 'CONFIRM & RECORD HANDOVER'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </form>

      {/* 5. Compact Modal for Add / Edit Empty Pocket (Section 17: Bottom Sheet / Compact Dialog) */}
      {isPocketModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsPocketModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '420px', width: '92%', borderRadius: '16px', padding: 0, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '14px 18px', background: '#c2410c', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '0.96rem' }}>
                {pocketModalEditingId ? 'Edit Empty Packet' : 'Add Empty Packet'}
              </div>
              <button
                type="button"
                onClick={() => setIsPocketModalOpen(false)}
                style={{ color: '#ffffff', padding: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '6px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px', background: '#ffffff' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Product *
                </label>
                <select
                  className="select-field"
                  style={{ width: '100%', minHeight: '44px', fontWeight: 700, fontSize: '0.88rem' }}
                  value={pocketModalProductId}
                  onChange={(e) => setPocketModalProductId(e.target.value)}
                  disabled={Boolean(pocketModalEditingId)}
                  required
                >
                  <option value="" disabled>Select Product</option>
                  {products.filter((p) => p.active).map((p) => {
                    const alreadyAdded = !pocketModalEditingId && activePocketProductIds.includes(p.id);
                    return (
                      <option key={p.id} value={p.id} disabled={alreadyAdded}>
                        {p.name} {alreadyAdded ? '(Already added)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Qty (Count) *
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    className="input-field"
                    style={{ width: '100%', minHeight: '44px', textAlign: 'center', fontWeight: 800, fontSize: '1rem' }}
                    placeholder="0"
                    value={pocketModalQty}
                    onChange={(e) => setPocketModalQty(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSavePocket();
                      }
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    className="input-field"
                    style={{ width: '100%', minHeight: '44px', textAlign: 'right', fontWeight: 800, fontSize: '1rem', color: '#c2410c' }}
                    placeholder="₹0"
                    value={pocketModalAmount}
                    onChange={(e) => setPocketModalAmount(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSavePocket();
                      }
                    }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ minHeight: '42px', padding: '8px 16px', fontWeight: 700 }}
                  onClick={() => setIsPocketModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePocket}
                  className="btn btn-primary"
                  style={{ minHeight: '42px', padding: '8px 20px', fontWeight: 800, background: '#c2410c', borderColor: '#c2410c' }}
                >
                  {pocketModalEditingId ? 'Save Changes' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Set 2A: Coupon Editor Modal */}
      <CouponEditorModal
        isOpen={isCouponModalOpen}
        initialCoupons={couponRows}
        onSave={handleSaveCoupons}
        onClose={() => setIsCouponModalOpen(false)}
      />
    </>
  );
};
