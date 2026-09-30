import React, { useState, useEffect, useMemo } from 'react';
import { Coins, Plus, Trash2, X, AlertCircle } from 'lucide-react';

export interface CouponRow {
  id: string;
  denomination: number | string;
  quantity: number | string;
}

interface CouponEditorModalProps {
  isOpen: boolean;
  initialCoupons: CouponRow[];
  onSave: (coupons: CouponRow[]) => void;
  onClose: () => void;
}

export const CouponEditorModal: React.FC<CouponEditorModalProps> = ({
  isOpen,
  initialCoupons,
  onSave,
  onClose
}) => {
  const [draftRows, setDraftRows] = useState<CouponRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      if (initialCoupons && initialCoupons.length > 0) {
        setDraftRows(initialCoupons.map((r) => ({ ...r })));
      } else {
        // Start with one empty row so user can enter right away
        setDraftRows([
          {
            id: `cpn-${Date.now()}-1`,
            denomination: '',
            quantity: ''
          }
        ]);
      }
    }
  }, [isOpen, initialCoupons]);

  const liveTotal = useMemo(() => {
    return draftRows.reduce((sum, r) => {
      const denom = Math.max(0, Number(r.denomination) || 0);
      const qty = Math.max(0, Number(r.quantity) || 0);
      return sum + denom * qty;
    }, 0);
  }, [draftRows]);

  if (!isOpen) return null;

  const handleAddRow = () => {
    setErrorMsg(null);
    setDraftRows((prev) => [
      ...prev,
      {
        id: `cpn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        denomination: '',
        quantity: ''
      }
    ]);
  };

  const handleUpdateRow = (id: string, field: 'denomination' | 'quantity', val: string) => {
    setErrorMsg(null);
    setDraftRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: val } : r))
    );
  };

  const handleRemoveRow = (id: string) => {
    setErrorMsg(null);
    setDraftRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSave = () => {
    setErrorMsg(null);

    // Validate rows
    for (let i = 0; i < draftRows.length; i++) {
      const row = draftRows[i];
      const hasDenom = row.denomination !== '' && Number(row.denomination) > 0;
      const hasQty = row.quantity !== '' && Number(row.quantity) > 0;

      if (hasDenom && !hasQty) {
        setErrorMsg(`Coupon #${i + 1}: Please enter a valid quantity.`);
        return;
      }
      if (!hasDenom && hasQty) {
        setErrorMsg(`Coupon #${i + 1}: Please enter a valid denomination.`);
        return;
      }
    }

    // Keep only rows with both valid denomination and quantity
    const validRows = draftRows
      .filter((r) => Number(r.denomination) > 0 && Number(r.quantity) > 0)
      .map((r) => ({
        id: r.id,
        denomination: Number(r.denomination),
        quantity: Number(r.quantity)
      }));

    onSave(validRows);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{
          maxWidth: '520px',
          width: '95vw',
          maxHeight: '90vh',
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
            background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Coins size={20} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                Coupons
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#fef3c7' }}>
                Enter coupon denomination and quantity.
              </p>
            </div>
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
              minWidth: '32px',
              minHeight: '32px'
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div
          style={{
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            overflowY: 'auto',
            flex: 1
          }}
        >
          {errorMsg && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#dc2626',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 800,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              COUPON ENTRIES
            </span>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
              {draftRows.length} {draftRows.length === 1 ? 'row' : 'rows'}
            </span>
          </div>

          {draftRows.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '28px 16px',
                background: '#f8fafc',
                borderRadius: '10px',
                border: '1px dashed #cbd5e1'
              }}
            >
              <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#64748b' }}>
                No coupon denomination rows entered.
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', fontWeight: 700, padding: '7px 16px' }}
                onClick={handleAddRow}
              >
                <Plus size={15} />
                <span>+ Add Coupon</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {draftRows.map((row, index) => {
                const denom = Number(row.denomination) || 0;
                const qty = Number(row.quantity) || 0;
                const rowTotal = denom * qty;

                return (
                  <div
                    key={row.id}
                    style={{
                      background: '#fffbeb',
                      border: '1.5px solid #fde68a',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          color: '#b45309',
                          textTransform: 'uppercase'
                        }}
                      >
                        Coupon #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: '#ef4444',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '2px 4px'
                        }}
                        title="Remove coupon entry"
                      >
                        <Trash2 size={13} />
                        <span>Remove</span>
                      </button>
                    </div>

                    {/* Inputs Row */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(110px, 1fr) auto minmax(90px, 1fr) auto',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      {/* Denomination */}
                      <div>
                        <label
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: '#78350f',
                            display: 'block',
                            marginBottom: '2px'
                          }}
                        >
                          Denomination
                        </label>
                        <div style={{ position: 'relative' }}>
                          <span
                            style={{
                              position: 'absolute',
                              left: '8px',
                              top: '8px',
                              fontSize: '0.84rem',
                              fontWeight: 800,
                              color: '#92400e'
                            }}
                          >
                            ₹
                          </span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0.01"
                            step="0.01"
                            placeholder="e.g. 5.00"
                            className="input-field"
                            style={{
                              width: '100%',
                              padding: '6px 8px 6px 20px',
                              fontSize: '0.9rem',
                              fontWeight: 800,
                              textAlign: 'center',
                              background: '#ffffff',
                              border: '1px solid #fcd34d',
                              borderRadius: '6px'
                            }}
                            value={row.denomination}
                            onChange={(e) => handleUpdateRow(row.id, 'denomination', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Multiplier Icon */}
                      <div
                        style={{
                          paddingTop: '16px',
                          fontWeight: 900,
                          color: '#b45309',
                          fontSize: '1rem'
                        }}
                      >
                        ×
                      </div>

                      {/* Quantity */}
                      <div>
                        <label
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: '#78350f',
                            display: 'block',
                            marginBottom: '2px'
                          }}
                        >
                          Quantity
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          placeholder="Qty"
                          className="input-field"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            fontSize: '0.9rem',
                            fontWeight: 800,
                            textAlign: 'center',
                            background: '#ffffff',
                            border: '1px solid #fcd34d',
                            borderRadius: '6px'
                          }}
                          value={row.quantity}
                          onChange={(e) => handleUpdateRow(row.id, 'quantity', e.target.value)}
                        />
                      </div>

                      {/* Row Total */}
                      <div style={{ textAlign: 'right', minWidth: '70px', paddingTop: '14px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#92400e', display: 'block', fontWeight: 600 }}>Total</span>
                        <span style={{ fontSize: '1rem', fontWeight: 900, color: '#92400e' }}>
                          ₹{rowTotal.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Another Coupon button */}
          <button
            type="button"
            onClick={handleAddRow}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 16px',
              fontSize: '0.84rem',
              fontWeight: 800,
              color: '#b45309',
              background: '#fefce8',
              border: '1.5px dashed #fcd34d',
              borderRadius: '8px',
              cursor: 'pointer',
              minHeight: '42px',
              transition: 'all 0.15s ease'
            }}
          >
            <Plus size={16} />
            <span>+ Add Another Coupon</span>
          </button>

          {/* Live Total Box */}
          <div
            style={{
              background: '#fff7ed',
              border: '1.5px solid #fed7aa',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '4px'
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: '#9a3412',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                TOTAL COUPON BENEFIT
              </div>
              <div style={{ fontSize: '0.72rem', color: '#c2410c', marginTop: '2px' }}>
                Cumulative deduction applied to expected handover
              </div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#c2410c' }}>
              ₹{liveTotal.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 20px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            flexShrink: 0
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ minWidth: '90px', minHeight: '40px', fontWeight: 700 }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            style={{
              minWidth: '130px',
              minHeight: '40px',
              fontWeight: 800,
              background: '#b45309',
              borderColor: '#b45309',
              boxShadow: '0 2px 8px rgba(180, 83, 9, 0.3)'
            }}
          >
            Save Coupons
          </button>
        </div>
      </div>
    </div>
  );
};
