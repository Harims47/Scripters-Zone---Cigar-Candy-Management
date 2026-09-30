import React, { useState } from 'react';
import { useHub } from '../../context/HubContext';
import { useToast } from '../../context/ToastContext';
import { OutstandingRecord } from '../../types';
import { Banknote, X, CheckCircle2 } from 'lucide-react';

interface OutstandingPaymentModalProps {
  isOpen: boolean;
  outstanding: OutstandingRecord | null;
  onClose: () => void;
}

export const OutstandingPaymentModal: React.FC<OutstandingPaymentModalProps> = ({
  isOpen,
  outstanding,
  onClose
}) => {
  const { recordOutstandingPayment } = useHub();
  const toast = useToast();

  const [paymentAmount, setPaymentAmount] = useState<number | string>('');
  const [paymentNotes, setPaymentNotes] = useState('');

  if (!isOpen || !outstanding) return null;

  const handleFullPay = () => {
    setPaymentAmount(outstanding.remainingAmount);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(paymentAmount) || 0;

    if (amount <= 0) {
      toast.error('Please enter a valid payment amount.');
      return;
    }

    if (amount > outstanding.remainingAmount) {
      toast.error(`Payment cannot exceed remaining outstanding amount of ₹${outstanding.remainingAmount.toLocaleString('en-IN')}`);
      return;
    }

    recordOutstandingPayment(outstanding.id, amount, paymentNotes.trim() || undefined, 'Admin');
    toast.success(`Payment of ₹${amount.toLocaleString('en-IN')} recorded successfully!`);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{
          maxWidth: '480px',
          width: '94vw',
          background: '#ffffff',
          borderRadius: '14px',
          overflow: 'hidden',
          padding: 0
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
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Banknote size={20} />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
              Record Outstanding Payment
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Outstanding Summary Card */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Debtor Name</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>{outstanding.personName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Handover Reference</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#4f46e5' }}>{outstanding.handoverNumber}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Original Outstanding</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>
                ₹{outstanding.originalOutstanding.toLocaleString('en-IN')}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '8px',
                borderTop: '1px dashed #cbd5e1'
              }}
            >
              <span style={{ fontSize: '0.84rem', color: '#ea580c', fontWeight: 800 }}>Remaining Due</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ea580c' }}>
                ₹{outstanding.remainingAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Payment Amount Input */}
          <div className="form-group" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                Payment Received Amount (₹) *
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                onClick={handleFullPay}
              >
                Pay Full Due
              </button>
            </div>
            <input
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              max={outstanding.remainingAmount}
              className="input-field"
              style={{ fontSize: '1.1rem', fontWeight: 800 }}
              placeholder="e.g. 500.00"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Remarks */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Payment Mode / Remarks</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Received via Cash / GPay at godown"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ padding: '10px 18px', fontWeight: 700 }}>
              <CheckCircle2 size={16} />
              <span>Record Payment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
