import React, { useState, useEffect, useMemo } from 'react';
import { useHub } from '../../context/HubContext';
import { ArrowUpRight, X, AlertCircle, CheckCircle, Plus, Trash2, Target } from 'lucide-react';

interface IssueQuantityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialPersonId?: string;
}

interface IssueItem {
  id: string;
  productId: string;
  quantity: number;
  targetQuantity?: number | string;
}

export const IssueQuantityModal: React.FC<IssueQuantityModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialPersonId
}) => {
  const { products, persons, salesTargets, addQuantityIssue, addSalesTarget, updateSalesTarget } = useHub();

  const activeProducts = useMemo(() => products.filter((p) => p.active), [products]);

  const salesmen = useMemo(() => persons.filter((p) => p.role === 'SALESMAN'), [persons]);
  const dealers = useMemo(() => persons.filter((p) => p.role === 'DEALER'), [persons]);

  const [issueRole, setIssueRole] = useState<'SALESMAN' | 'DEALER'>('SALESMAN');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Multi-item stock issue list
  const [items, setItems] = useState<IssueItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      let initialRole: 'SALESMAN' | 'DEALER' = 'SALESMAN';
      let defaultPersonId = '';

      if (initialPersonId) {
        const found = persons.find((p) => p.id === initialPersonId);
        if (found) {
          initialRole = found.role as 'SALESMAN' | 'DEALER';
          defaultPersonId = found.id;
        }
      }

      if (!defaultPersonId) {
        defaultPersonId = initialRole === 'SALESMAN'
          ? (salesmen[0]?.id || '')
          : (dealers[0]?.id || '');
      }

      setIssueRole(initialRole);
      setSelectedPersonId(defaultPersonId);
      setIssueDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setErrorMsg(null);

      if (activeProducts.length > 0) {
        const firstProd = activeProducts[0];
        const existingPt = initialRole === 'SALESMAN' && defaultPersonId
          ? salesTargets.find((t) => t.salesmanId === defaultPersonId && t.targetType === 'VALUE')?.productTargets?.find((pt) => pt.productId === firstProd.id)?.targetQuantity
          : undefined;

        setItems([
          {
            id: 'item-1',
            productId: firstProd.id,
            quantity: 50,
            targetQuantity: existingPt ?? ''
          }
        ]);
      } else {
        setItems([]);
      }
    }
  }, [isOpen, initialPersonId, persons, activeProducts, salesmen, dealers]);

  const handleRoleChange = (newRole: 'SALESMAN' | 'DEALER') => {
    setIssueRole(newRole);
    const newPersonId = newRole === 'SALESMAN'
      ? (salesmen[0]?.id || '')
      : (dealers[0]?.id || '');
    setSelectedPersonId(newPersonId);

    if (newRole === 'SALESMAN') {
      const tgt = salesTargets.find((t) => t.salesmanId === newPersonId && t.targetType === 'VALUE');
      setItems((prev) =>
        prev.map((it) => {
          const pt = tgt?.productTargets?.find((p) => p.productId === it.productId);
          return { ...it, targetQuantity: pt ? pt.targetQuantity : '' };
        })
      );
    } else {
      setItems((prev) => prev.map((it) => ({ ...it, targetQuantity: undefined })));
    }
  };

  const handlePersonChange = (newPersonId: string) => {
    setSelectedPersonId(newPersonId);
    if (issueRole === 'SALESMAN') {
      const tgt = salesTargets.find((t) => t.salesmanId === newPersonId && t.targetType === 'VALUE');
      setItems((prev) =>
        prev.map((it) => {
          const pt = tgt?.productTargets?.find((p) => p.productId === it.productId);
          return { ...it, targetQuantity: pt ? pt.targetQuantity : '' };
        })
      );
    }
  };

  const currentPerson = persons.find((p) => p.id === selectedPersonId) || (issueRole === 'SALESMAN' ? salesmen[0] : dealers[0]);
  const isSalesman = issueRole === 'SALESMAN';

  // Target lookup for Salesman (READ-ONLY)
  // Check for target matching issueDate first, fallback to salesman's standing/active target
  const dailyTarget = useMemo(() => {
    if (!isSalesman || !currentPerson) return undefined;
    const forDate = salesTargets.find(
      (t) => t.salesmanId === currentPerson.id && t.targetType === 'VALUE' && t.date === issueDate
    );
    if (forDate) return forDate;
    return salesTargets.find((t) => t.salesmanId === currentPerson.id && t.targetType === 'VALUE');
  }, [isSalesman, currentPerson, issueDate, salesTargets]);

  // Product targets are fixed based on date
  const productTargets = useMemo(() => {
    if (!isSalesman || !currentPerson) return [];
    return salesTargets.filter(
      (t) => t.salesmanId === currentPerson.id && t.targetType === 'QUANTITY' && t.date === issueDate
    );
  }, [isSalesman, currentPerson, issueDate, salesTargets]);

  const hasTargets = !!dailyTarget || productTargets.length > 0;

  if (!isOpen) return null;

  const handleAddItem = () => {
    const existingProductIds = new Set(items.map((it) => it.productId));
    const nextProduct = activeProducts.find((p) => !existingProductIds.has(p.id)) || activeProducts[0];
    if (!nextProduct) return;

    const existingPt = isSalesman && currentPerson
      ? dailyTarget?.productTargets?.find((pt) => pt.productId === nextProduct.id)?.targetQuantity
      : undefined;

    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        productId: nextProduct.id,
        quantity: 50,
        targetQuantity: existingPt ?? ''
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemProductChange = (index: number, newProductId: string) => {
    const isDuplicate = items.some((it, i) => i !== index && it.productId === newProductId);
    if (isDuplicate) {
      setErrorMsg('This product is already added in the issue list.');
      return;
    }
    setErrorMsg(null);
    const existingPt = isSalesman && currentPerson
      ? dailyTarget?.productTargets?.find((pt) => pt.productId === newProductId)?.targetQuantity
      : undefined;

    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, productId: newProductId, targetQuantity: existingPt ?? '' } : it))
    );
  };

  const handleItemQtyChange = (index: number, qty: number) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, quantity: Math.max(0.01, Math.round(qty * 100) / 100) } : it))
    );
  };

  const handleItemTargetQtyChange = (index: number, val: string) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, targetQuantity: val === '' ? '' : Math.max(0, parseFloat(val) || 0) } : it))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!currentPerson) {
      setErrorMsg('Please select a recipient (Salesman or Dealer).');
      return;
    }

    if (items.length === 0) {
      setErrorMsg('Please add at least one product to issue.');
      return;
    }

    // Check duplicate products
    const seenIds = new Set<string>();
    for (const it of items) {
      if (seenIds.has(it.productId)) {
        setErrorMsg('Duplicate products found in issue list. Please remove duplicates.');
        return;
      }
      seenIds.add(it.productId);
      if (it.quantity <= 0) {
        setErrorMsg('All product quantities must be greater than 0.');
        return;
      }
    }

    // Issue each product quantity
    items.forEach((it) => {
      const prod = products.find((p) => p.id === it.productId);
      if (prod) {
        addQuantityIssue({
          personId: currentPerson.id,
          personName: currentPerson.name,
          personRole: currentPerson.role,
          productId: prod.id,
          sku: prod.sku,
          productName: prod.name,
          category: prod.category,
          subCategory: prod.subCategory,
          brand: prod.brand,
          uom: prod.uom,
          quantityIssued: it.quantity,
          date: issueDate,
          notes: notes.trim() || undefined
        });
      }
    });

    // When issuing to salesman, assign/update product target for the salesman if provided
    if (isSalesman && currentPerson) {
      const itemsWithTarget = items.filter(
        (it) => it.targetQuantity !== undefined && it.targetQuantity !== '' && Number(it.targetQuantity) > 0
      );

      if (itemsWithTarget.length > 0) {
        const existingTarget = salesTargets.find(
          (t) => t.salesmanId === currentPerson.id && t.targetType === 'VALUE'
        );

        const currentProductTargets = [...(existingTarget?.productTargets || [])];

        itemsWithTarget.forEach((it) => {
          const prod = products.find((p) => p.id === it.productId);
          if (!prod) return;
          const targetQty = Number(it.targetQuantity);
          const existingIdx = currentProductTargets.findIndex((pt) => pt.productId === it.productId);
          if (existingIdx >= 0) {
            currentProductTargets[existingIdx] = {
              ...currentProductTargets[existingIdx],
              productName: prod.name,
              targetQuantity: targetQty
            };
          } else {
            currentProductTargets.push({
              productId: prod.id,
              productName: prod.name,
              targetQuantity: targetQty
            });
          }
        });

        if (existingTarget) {
          updateSalesTarget({
            ...existingTarget,
            productTargets: currentProductTargets
          });
        } else {
          addSalesTarget({
            salesmanId: currentPerson.id,
            salesmanName: currentPerson.name,
            date: 'Daily (Fixed)',
            period: 'DAILY',
            targetType: 'VALUE',
            targetValue: 0,
            productTargets: currentProductTargets
          });
        }
      }
    }

    if (onSuccess) onSuccess();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{
          maxWidth: '560px',
          width: '95vw',
          maxHeight: '92vh',
          padding: '0',
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
            background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowUpRight size={20} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
              Issue Stock
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
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
              minWidth: '36px',
              minHeight: '36px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '16px 20px 24px',
            background: '#ffffff',
            overflowY: 'auto',
            flex: 1
          }}
        >
          {errorMsg && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                padding: '10px 14px',
                borderRadius: '8px',
                color: '#dc2626',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px'
              }}
            >
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Issue To Toggle */}
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '6px', display: 'block' }}>
              Issue To
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={`btn ${issueRole === 'SALESMAN' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '10px 16px', fontSize: '0.84rem', fontWeight: 800, minHeight: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={() => handleRoleChange('SALESMAN')}
              >
                <span>Salesman</span>
              </button>
              <button
                type="button"
                className={`btn ${issueRole === 'DEALER' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '10px 16px', fontSize: '0.84rem', fontWeight: 800, minHeight: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={() => handleRoleChange('DEALER')}
              >
                <span>Dealer</span>
              </button>
            </div>
          </div>

          {/* Salesman & Date Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                {issueRole === 'SALESMAN' ? 'Salesman' : 'Dealer / Buyer'}
              </label>
              <select
                className="select-field"
                value={selectedPersonId}
                onChange={(e) => handlePersonChange(e.target.value)}
                required
                style={{ height: '44px' }}
              >
                {(issueRole === 'SALESMAN' ? salesmen : dealers).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.phone ? `(${p.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>Date</label>
              <input
                type="date"
                className="input-field"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
                style={{ height: '44px' }}
              />
            </div>
          </div>

          {/* Target Lookup Banner (SALESMAN ONLY) */}
          {isSalesman && (
            hasTargets ? (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1.5px solid #c7d2fe',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                  fontSize: '0.8rem'
                }}
              >
                <Target size={15} color="#4f46e5" />
                <strong style={{ color: '#4338ca' }}>SALES TARGET:</strong>
                {dailyTarget && dailyTarget.targetValue != null && (
                  <span style={{ fontWeight: 800, color: '#1e1b4b' }}>
                    ₹{dailyTarget.targetValue.toLocaleString('en-IN')} / day <span style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 700 }}>(Fixed)</span>
                  </span>
                )}
                {dailyTarget?.productTargets && dailyTarget.productTargets.length > 0 && (
                  <span style={{ color: '#4f46e5', fontWeight: 600 }}>
                    · {dailyTarget.productTargets.length} product quota{dailyTarget.productTargets.length > 1 ? 's' : ''}
                  </span>
                )}
                {productTargets.length > 0 && (
                  <span style={{ color: '#4f46e5', fontWeight: 600 }}>
                    · {productTargets.length} target{productTargets.length > 1 ? 's' : ''} for {issueDate}
                  </span>
                )}
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: '#e0e7ff',
                    color: '#3730a3',
                    marginLeft: 'auto'
                  }}
                >
                  Assigned
                </span>
              </div>
            ) : (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  marginBottom: '16px',
                  fontSize: '0.78rem',
                  color: '#64748b'
                }}
              >
                No sales target set for this salesman.
              </div>
            )
          )}

          {/* Items Section */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 800, fontSize: '0.88rem', margin: 0, color: '#1e293b' }}>
                  Stock Items to Issue ({items.length})
                </label>
                {isSalesman && (
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                    Set product Target Qty alongside Issue Qty for this salesman.
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                style={{
                  background: '#e0e7ff',
                  color: '#4338ca',
                  border: '1px solid #c7d2fe',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  minHeight: '36px'
                }}
              >
                <Plus size={14} /> Add Product
              </button>
            </div>

            {/* Column Headers */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0 12px 6px 12px',
                fontSize: '0.72rem',
                fontWeight: 800,
                color: '#64748b',
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}
            >
              <div style={{ flex: isSalesman ? '2 1 170px' : '2 1 200px' }}>Product</div>
              <div style={{ flex: isSalesman ? '1 1 80px' : '1 1 90px', textAlign: 'center' }}>Issue Qty</div>
              {isSalesman && <div style={{ flex: '1 1 80px', textAlign: 'center', color: '#4338ca' }}>Target Qty</div>}
              {items.length > 1 && <div style={{ width: '36px' }}></div>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {items.map((item, idx) => {
                const prod = products.find((p) => p.id === item.productId);
                return (
                  <div
                    key={item.id}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ flex: isSalesman ? '2 1 170px' : '2 1 200px' }}>
                      <select
                        className="select-field"
                        value={item.productId}
                        onChange={(e) => handleItemProductChange(idx, e.target.value)}
                        style={{ height: '42px', fontSize: '0.84rem' }}
                      >
                        {activeProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ flex: isSalesman ? '1 1 80px' : '1 1 90px', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        className="input-field"
                        placeholder="Issue"
                        value={item.quantity}
                        onChange={(e) => handleItemQtyChange(idx, parseFloat(e.target.value) || 0)}
                        style={{ height: '42px', textAlign: 'center', fontWeight: 700 }}
                        title="Stock quantity to issue"
                      />
                    </div>

                    {isSalesman && (
                      <div style={{ flex: '1 1 80px', display: 'flex', alignItems: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          className="input-field"
                          placeholder="Target"
                          value={item.targetQuantity ?? ''}
                          onChange={(e) => handleItemTargetQtyChange(idx, e.target.value)}
                          style={{
                            height: '42px',
                            textAlign: 'center',
                            fontWeight: 700,
                            borderColor: '#c7d2fe',
                            background: '#faf5ff'
                          }}
                          title="Sales target quantity for this product"
                        />
                      </div>
                    )}

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        style={{
                          background: '#fee2e2',
                          color: '#dc2626',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '36px',
                          minHeight: '36px'
                        }}
                        title="Remove product"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes / Route (Optional) */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Notes / Route (Optional)</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Morning South market route batch"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ height: '40px' }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ minHeight: '44px', padding: '0 16px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 20px',
                fontWeight: 700,
                minHeight: '44px'
              }}
            >
              <CheckCircle size={16} />
              Record Issue ({items.length} {items.length === 1 ? 'item' : 'items'})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
