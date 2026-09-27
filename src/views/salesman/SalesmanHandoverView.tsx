import React, { useState } from 'react';
import { useHub } from '../../context/HubContext';
import { HandoverEntryForm } from '../../components/handover/HandoverEntryForm';
import { SalesmanHistoryView } from './SalesmanHistoryView';
import { Receipt, CheckCircle2, Clock, PlusCircle, ArrowLeft } from 'lucide-react';

interface SalesmanHandoverViewProps {
  onSuccessNavigate?: () => void;
}

export const SalesmanHandoverView: React.FC<SalesmanHandoverViewProps> = ({ onSuccessNavigate }) => {
  const { activeSession, handovers } = useHub();
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const myTodayHandover = handovers.find(
    (h) =>
      (h.personId === activeSession.personId || h.personName === activeSession.name) &&
      h.date === todayStr
  );

  return (
    <div className="salesman-handover-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            Today's Handover
          </h1>
          <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
            {activeSession.name} • End-of-day sales closing sheet, empty packets, coupons, and expected handover.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '6px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <Clock size={16} color="#64748b" />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>

          {(myTodayHandover || justSubmitted) && (
            isCreatingNew ? (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setIsCreatingNew(false)}
              >
                <ArrowLeft size={14} />
                <span>Back to Today's Status</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontWeight: 800, fontSize: '0.82rem', background: '#059669', borderColor: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setIsCreatingNew(true)}
              >
                <PlusCircle size={15} />
                <span>+ Add New Handover</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* When user clicks "+ Add New Handover", render the form */}
      {isCreatingNew ? (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
              New Handover Entry (Additional Today's Route / Session)
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '5px 12px' }}
              onClick={() => setIsCreatingNew(false)}
            >
              Cancel
            </button>
          </div>
          <HandoverEntryForm
            initialType="SALESMAN"
            defaultPersonId={activeSession.personId || undefined}
            onSuccess={() => {
              setJustSubmitted(true);
              setIsCreatingNew(false);
              if (onSuccessNavigate) onSuccessNavigate();
            }}
            onCancel={() => setIsCreatingNew(false)}
          />
        </div>
      ) : (myTodayHandover || justSubmitted) ? (
        <div
          style={{
            background: '#ffffff',
            border: myTodayHandover?.status === 'SUBMITTED' ? '1.5px solid #fde047' : '1.5px solid #a7f3d0',
            borderRadius: '16px',
            padding: '40px 24px',
            textAlign: 'center',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)'
          }}
        >
          {myTodayHandover?.status === 'SUBMITTED' || (!myTodayHandover && justSubmitted) ? (
            <>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: '#fefce8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: '#ca8a04'
                }}
              >
                <Clock size={34} />
              </div>
              <div
                style={{
                  display: 'inline-block',
                  padding: '4px 14px',
                  background: '#fef3c7',
                  color: '#b45309',
                  borderRadius: '20px',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  marginBottom: '12px'
                }}
              >
                WAITING FOR COLLECTION
              </div>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
                HANDOVER SUBMITTED
              </h2>
              <p style={{ color: '#64748b', maxWidth: '440px', margin: '0 auto 20px', fontSize: '0.9rem' }}>
                Your end-of-day sales sheet for today has been submitted to Admin. Awaiting cash and GPay collection verification.
              </p>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  maxWidth: '360px',
                  margin: '0 auto 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{ fontSize: '0.86rem', color: '#64748b', fontWeight: 700 }}>Expected Handover:</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1d4ed8' }}>
                  ₹{((myTodayHandover?.expectedHandover ?? myTodayHandover?.totalExpected) || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 24px 0' }}>
                Submitted handovers cannot be edited freely. If changes are needed, please contact Central Admin.
              </p>

              {/* Option to create another handover */}
              <div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{
                    padding: '10px 22px',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    background: '#059669',
                    borderColor: '#059669',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 3px 10px rgba(5, 150, 105, 0.25)'
                  }}
                  onClick={() => setIsCreatingNew(true)}
                >
                  <PlusCircle size={16} />
                  <span>+ Create Another Handover For Today</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: '#ecfdf5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: '#059669'
                }}
              >
                <CheckCircle2 size={34} />
              </div>
              <div
                style={{
                  display: 'inline-block',
                  padding: '4px 14px',
                  background: myTodayHandover?.status === 'SHORT' ? '#fef2f2' : '#ecfdf5',
                  color: myTodayHandover?.status === 'SHORT' ? '#dc2626' : '#047857',
                  borderRadius: '20px',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  marginBottom: '12px'
                }}
              >
                {myTodayHandover?.status === 'SHORT'
                  ? `COLLECTED (SHORT ₹${myTodayHandover?.outstanding.toLocaleString('en-IN')})`
                  : 'COLLECTED & SETTLED'}
              </div>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
                HANDOVER COLLECTED
              </h2>
              <p style={{ color: '#64748b', maxWidth: '440px', margin: '0 auto 20px', fontSize: '0.9rem' }}>
                Admin has reviewed your sheet and confirmed the cash/GPay collection for today.
              </p>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  maxWidth: '380px',
                  margin: '0 auto 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Expected Amount:</span>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>
                    ₹{((myTodayHandover?.expectedHandover ?? myTodayHandover?.totalExpected) || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Total Collected:</span>
                  <span style={{ fontWeight: 800, color: '#059669' }}>
                    ₹{(myTodayHandover?.amountReceived || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                {myTodayHandover?.cashReceived !== undefined && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}>
                    <span>Cash: ₹{(myTodayHandover.cashReceived || 0).toLocaleString('en-IN')}</span>
                    <span>GPay: ₹{(myTodayHandover.gpayReceived || 0).toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>

              {/* Option to create another handover */}
              <div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{
                    padding: '10px 22px',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    background: '#059669',
                    borderColor: '#059669',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 3px 10px rgba(5, 150, 105, 0.25)'
                  }}
                  onClick={() => setIsCreatingNew(true)}
                >
                  <PlusCircle size={16} />
                  <span>+ Create Another Handover For Today</span>
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
          <HandoverEntryForm
            initialType="SALESMAN"
            defaultPersonId={activeSession.personId || undefined}
            onSuccess={() => {
              setJustSubmitted(true);
              if (onSuccessNavigate) onSuccessNavigate();
            }}
          />
        </div>
      )}

      {/* Handover History Table Section */}
      <div style={{ marginTop: '12px' }}>
        <SalesmanHistoryView title="Handover History" subtitle="Your past daily handovers and collection records." />
      </div>
    </div>
  );
};
