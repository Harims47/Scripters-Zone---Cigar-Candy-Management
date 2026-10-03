import React, { useState, useMemo, useEffect } from 'react';
import { useHub } from '../../context/HubContext';
import { Person } from '../../types';
import { TablePagination } from '../../components/ui/TablePagination';
import { SortableHeader } from '../../components/ui/SortableHeader';
import { TableEmptyState } from '../../components/ui/TableEmptyState';
import { useTableState } from '../../utils/useTableState';
import { PlusCircle, Users, Search, Phone, Store, Trash2, Edit2, CheckCircle, X, Key, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { DeleteConfirmModal } from '../../components/modals/DeleteConfirmModal';

export interface StaffDirectoryViewProps {
  initialRoleFilter?: 'ALL' | 'SALESMAN' | 'DEALER';
}

export const StaffDirectoryView: React.FC<StaffDirectoryViewProps> = ({ initialRoleFilter = 'ALL' }) => {
  const { persons, addPerson, deletePerson, isLoading, error, refreshAll } = useHub();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'SALESMAN' | 'DEALER'>(initialRoleFilter);

  useEffect(() => {
    if (initialRoleFilter) {
      setRoleFilter(initialRoleFilter);
    }
  }, [initialRoleFilter]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'SALESMAN' | 'DEALER'>('SALESMAN');
  const [notes, setNotes] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const salesmenCount = persons.filter((p) => p.role === 'SALESMAN' && p.active !== false).length;
  const dealersCount = persons.filter((p) => p.role === 'DEALER' && p.active !== false).length;

  const filtered = useMemo(() => {
    return persons.filter((p) => {
      if (p.active === false) return false;
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.phone.includes(searchTerm);
      const matchesRole = roleFilter === 'ALL' || p.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [persons, searchTerm, roleFilter]);

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    sortField,
    sortDirection,
    toggleSort,
    pagedData: pagedPersons,
    totalItems,
    resetPage
  } = useTableState(filtered, {
    initialPageSize: 10,
    initialSortField: null,
    initialSortDirection: null,
    sortExtractors: {
      name: (p) => p.name,
      role: (p) => p.role,
      phone: (p) => p.phone,
      notes: (p) => p.notes || ''
    }
  });

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    resetPage();
  };

  const handleRoleChange = (val: 'ALL' | 'SALESMAN' | 'DEALER') => {
    setRoleFilter(val);
    resetPage();
  };

  const handleOpenAdd = () => {
    setName('');
    setPhone('');
    setNotes('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setErrorMsg(null);
    setIsAddOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim() || !phone.trim()) {
      setErrorMsg('Full name and phone number are required.');
      return;
    }

    if (role === 'SALESMAN') {
      if (!username.trim()) {
        setErrorMsg('Username / Login ID is required for Salesman.');
        return;
      }
      if (!password) {
        setErrorMsg('Password is required.');
        return;
      }
      if (password.length < 8) {
        setErrorMsg('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Password and Confirm Password do not match.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await addPerson({
        name: name.trim(),
        phone: phone.trim(),
        role,
        notes: notes.trim() || undefined,
        avatarColor: role === 'SALESMAN' ? '#3b82f6' : '#ea580c',
        username: role === 'SALESMAN' ? username.trim() : undefined,
        password: role === 'SALESMAN' ? password : undefined,
      });

      if (res?.error) {
        setErrorMsg(res.error);
        setIsSubmitting(false);
        return;
      }

      setName('');
      setPhone('');
      setNotes('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setErrorMsg(null);
      setIsAddOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register person');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: '#ffffff',
          padding: '18px 24px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Salesmen & Dealers Roster
          </h2>
          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '3px' }}>
            Register new distribution team members and manage dealer accounts
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleOpenAdd}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', fontWeight: 700 }}
        >
          <PlusCircle size={16} />
          Register New Person
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Total Registered Team
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
            {persons.length}
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>
            Field Salesmen
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>
            {salesmenCount}
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#ea580c', textTransform: 'uppercase' }}>
            Wholesale Dealers
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ea580c', marginTop: '2px' }}>
            {dealersCount}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="table-container">
        <div className="table-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '500px' }}>
            <div className="table-search-box" style={{ width: '100%' }}>
              <Search size={16} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search staff by name or phone..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>

            <select
              className="select-field"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
              value={roleFilter}
              onChange={(e) => handleRoleChange(e.target.value as any)}
            >
              <option value="ALL">All Roles</option>
              <option value="SALESMAN">Salesmen</option>
              <option value="DEALER">Dealers</option>
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <SortableHeader label="Name" field="name" currentSortField={sortField} currentSortDirection={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Role" field="role" currentSortField={sortField} currentSortDirection={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Phone" field="phone" currentSortField={sortField} currentSortDirection={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Notes / Delivery Route" field="notes" currentSortField={sortField} currentSortDirection={sortDirection} onSort={toggleSort} />
                <th style={{ textAlign: 'center', padding: '12px 14px', fontWeight: 800 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {error && persons.length === 0 ? (
                <TableEmptyState
                  isError
                  title="Failed to load staff roster"
                  description={error}
                  onRetry={refreshAll}
                  colSpan={5}
                />
              ) : pagedPersons.length === 0 ? (
                <TableEmptyState
                  title="No staff members found"
                  description="No records match your current search and role filter criteria."
                  colSpan={5}
                />
              ) : (
                pagedPersons.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: p.avatarColor || '#4f46e5',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.85rem'
                          }}
                        >
                          {p.name.charAt(0)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>{p.name}</span>
                          {p.username && (
                            <span style={{ fontSize: '0.72rem', color: '#4f46e5', background: '#eef2ff', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              @{p.username}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: p.role === 'DEALER' ? '#f3e8ff' : '#ecfdf5',
                          color: p.role === 'DEALER' ? '#7e22ce' : '#047857'
                        }}
                      >
                        {p.role}
                      </span>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#475569' }}>
                        <Phone size={13} color="#94a3b8" /> {p.phone}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{p.notes || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTarget({ id: p.id, name: p.name });
                        }}
                        style={{
                          background: '#fff1f2',
                          border: '1px solid #fecaca',
                          color: '#e11d48',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                        title="Delete Staff"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          totalItems={filtered.length}
          pageSize={pageSize}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Add Modal */}
      {isAddOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddOpen(false)}>
          <div
            className="modal-content"
            style={{
              maxWidth: '540px',
              width: '100%',
              maxHeight: 'min(90vh, 720px)',
              display: 'flex',
              flexDirection: 'column',
              padding: '0',
              overflow: 'hidden',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(15, 23, 42, 0.08)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 22px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
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
                    background: 'rgba(255, 255, 255, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff'
                  }}
                >
                  <Users size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
                    Register Staff / Dealer
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.8)', marginTop: '1px' }}>
                    Add field salesman or wholesale counter dealer
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: '7px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s'
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', margin: 0 }}>
              {/* Scrollable Form Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {errorMsg && (
                  <div
                    style={{
                      padding: '10px 14px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      color: '#b91c1c',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <AlertTriangle size={16} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Primary details: 2-column responsive grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Full Name *</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Anand or City Supermarket"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setErrorMsg(null);
                      }}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Phone Number *</label>
                    <input
                      type="tel"
                      className="input-field"
                      placeholder="e.g. 9845123456"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setErrorMsg(null);
                      }}
                      required
                    />
                  </div>
                </div>

                {/* Role & Route: 2-column responsive grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Role</label>
                    <select
                      className="select-field"
                      value={role}
                      onChange={(e) => {
                        setRole(e.target.value as any);
                        setErrorMsg(null);
                      }}
                    >
                      <option value="SALESMAN">Salesman (Field Distribution)</option>
                      <option value="DEALER">Wholesale Dealer (Counter Sales)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Route / Territory Notes</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. South Zone Market"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>

                {role === 'SALESMAN' && (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Key size={16} color="#4f46e5" />
                        <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>
                          Login Credentials
                        </h4>
                      </div>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#4f46e5', background: '#e0e7ff', padding: '2px 8px', borderRadius: '4px' }}>
                        Salesman Portal Access
                      </span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '-4px' }}>
                      Create login access so this salesman can access the mobile handover and field dashboard.
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Username / Login ID *</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="e.g. ramesh.kumar"
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value);
                          setErrorMsg(null);
                        }}
                        required
                        autoComplete="off"
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <label className="form-label" style={{ margin: 0 }}>Password *</label>
                          <span style={{ fontSize: '0.68rem', color: '#64748b' }}>min 8 chars</span>
                        </div>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            className="input-field"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value);
                              setErrorMsg(null);
                            }}
                            required
                            minLength={8}
                            style={{ paddingRight: '36px' }}
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                              position: 'absolute',
                              right: '8px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#64748b',
                              padding: '4px'
                            }}
                            title={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Confirm Password *</label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="input-field"
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            setErrorMsg(null);
                          }}
                          required
                          minLength={8}
                          autoComplete="new-password"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pinned Action Footer */}
              <div
                style={{
                  flexShrink: 0,
                  padding: '14px 24px',
                  background: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '12px'
                }}
              >
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 700 }} disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Person'}
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
            deletePerson(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        itemName={deleteTarget ? deleteTarget.name : ''}
      />
    </div>
  );
};
