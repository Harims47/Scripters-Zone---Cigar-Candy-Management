import React, { useState } from 'react';
import { useHub } from '../../context/HubContext';
import { useToast } from '../../context/ToastContext';
import {
  Package,
  User,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  Sparkles
} from 'lucide-react';
import './login.css';

import { AuthService } from '../../services';

export const LoginPage: React.FC = () => {
  const { login } = useHub();
  const toast = useToast();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolveUsername = (input: string): string => {
    const trimmed = input.trim();
    if (trimmed.includes('@')) {
      const part = trimmed.split('@')[0];
      return part || trimmed;
    }
    return trimmed;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const username = resolveUsername(usernameOrEmail);
      const res = await AuthService.login(username, password);

      login({
        role: res.user.role,
        personId: res.user.person?.id || null,
        name: res.user.person?.name || res.user.username,
      });

      toast.success(`Welcome back, ${res.user.person?.name || res.user.username}!`);
    } catch (err: any) {
      toast.error(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <div className="login-page-container">
      {/* Left Feature Showcase Panel */}
      <div
        className="login-brand-panel"
        style={{
          background: 'linear-gradient(145deg, #070a19 0%, #0f172a 50%, #1e1b4b 100%)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div className="brand-content-wrapper" style={{ position: 'relative', zIndex: 10 }}>
          {/* Logo & Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 20px rgba(79, 70, 229, 0.4)'
              }}
            >
              <Package size={26} />
            </div>
            <div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                Candy & Cigarette
              </div>
              <div
                style={{
                  fontSize: '0.74rem',
                  color: '#a5b4fc',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 700
                }}
              >
                Operational Management System (GPI • Fereo • IPM)
              </div>
            </div>
          </div>

          <h2
            style={{
              fontSize: '1.85rem',
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.25,
              marginBottom: '16px',
              letterSpacing: '-0.02em'
            }}
          >
            Streamlined Operational Sales & Daily Handover Ledger
          </h2>
          <p
            style={{
              color: '#94a3b8',
              fontSize: '0.94rem',
              lineHeight: 1.6,
              marginBottom: '32px',
              maxWidth: '520px'
            }}
          >
            Central stock allocation, daily route physical handover, product-specific empty packet returns, promotional
            coupons, and automated outstanding debt tracking.
          </p>

          {/* Capabilities List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', color: '#e2e8f0', fontSize: '0.9rem' }}>
              <CheckCircle2 size={19} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#ffffff' }}>Daily Handover Core:</strong> Opening, Closing, Sales, Free items, and item-level discounts recorded in a compact single-table.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', color: '#e2e8f0', fontSize: '0.9rem' }}>
              <CheckCircle2 size={19} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#ffffff' }}>Empty Packet & Coupon Credits:</strong> Product/brand specific empty packet scrap recovery and coupon rebate allowances.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', color: '#e2e8f0', fontSize: '0.9rem' }}>
              <CheckCircle2 size={19} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#ffffff' }}>Outstanding Debt Tracking:</strong> Automatic shortage ledger stored per person and date, with partial recovery actions.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', color: '#e2e8f0', fontSize: '0.9rem' }}>
              <CheckCircle2 size={19} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#ffffff' }}>Wholesale Dealer Operations:</strong> Admin manages dealer handovers with customer buyer details directly.
              </div>
            </div>
          </div>
        </div>

        {/* Ambient bottom footer */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.78rem' }}>
          <Sparkles size={14} color="#f59e0b" />
          <span>Operational Concessionaire Management • Enterprise Edition</span>
        </div>
      </div>

      {/* Right Login Form Panel */}
      <div className="login-form-panel">
        <div className="login-form-card">
          {/* Mobile-Only Compact Brand Header */}
          <div className="login-mobile-brand">
            <div className="login-mobile-brand-icon">
              <Package size={20} />
            </div>
            <div>
              <div className="login-mobile-brand-title">Candy & Cigarette</div>
              <div className="login-mobile-brand-sub">Management System</div>
            </div>
          </div>

          {/* Welcome Header */}
          <div style={{ marginBottom: '22px' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
              Sign in to Portal
            </h1>
            <p style={{ fontSize: '0.84rem', color: '#64748b', margin: 0 }}>
              Enter your authorized credentials to continue
            </p>
          </div>

          {/* Proper Login Form */}
          <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Username / Email Address */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                Username / Email
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                <input
                  type="text"
                  className="input-field"
                  style={{ paddingLeft: '38px', fontSize: '0.88rem' }}
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="Username (e.g. admin, ramesh)"
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input-field"
                  style={{ paddingLeft: '38px', paddingRight: '40px', fontSize: '0.88rem' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={isSubmitting}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '10px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#475569' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>Remember this device</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{
                marginTop: '4px',
                padding: '12px',
                fontWeight: 700,
                fontSize: '0.94rem',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              <LogIn size={18} />
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In to System'}</span>
            </button>
          </form>


        </div>
      </div>
    </div>
  );
};
