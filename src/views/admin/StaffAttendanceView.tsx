import React, { useState, useMemo, useEffect } from 'react';
import { useHub } from '../../context/HubContext';
import { useToast } from '../../context/ToastContext';
import { AttendanceStatus } from '../../types';
import { TableExportButtons } from '../../components/ui/TableExportButtons';
import { exportToCSV, exportToExcel, exportToPDF } from '../../utils/exportHelpers';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Save,
  Users,
  Search,
  X
} from 'lucide-react';
import { TablePagination } from '../../components/ui/TablePagination';
import { SortableHeader } from '../../components/ui/SortableHeader';
import { TableEmptyState } from '../../components/ui/TableEmptyState';
import { useTableState } from '../../utils/useTableState';

interface StaffAttendanceRowState {
  status: AttendanceStatus;
  notes: string;
}

export const StaffAttendanceView: React.FC = () => {
  const { persons, attendance, bulkMarkAttendance } = useHub();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'DAILY' | 'MONTHLY_REPORT'>('DAILY');

  // Daily Sheet State
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [rowStates, setRowStates] = useState<Record<string, StaffAttendanceRowState>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Monthly Report Filters
  const [reportMonth, setReportMonth] = useState<string>('2026-09');
  const [reportStaffId, setReportStaffId] = useState<string>('ALL');

  // IMPORTANT: Filter ONLY actual staff/salesmen (Dealers must NOT appear in Staff Attendance)
  const staffMembers = useMemo(() => {
    return persons.filter((p) => p.role === 'SALESMAN');
  }, [persons]);

  // Sync sheet state when selectedDate or attendance changes
  useEffect(() => {
    const existingDateRecords = attendance.filter((a) => a.date === selectedDate);
    const initialRows: Record<string, StaffAttendanceRowState> = {};

    staffMembers.forEach((staff) => {
      const rec = existingDateRecords.find((a) => a.personId === staff.id);
      if (rec) {
        initialRows[staff.id] = {
          status: rec.status,
          notes: rec.notes || ''
        };
      } else {
        // Default to PRESENT for fast daily operations
        initialRows[staff.id] = {
          status: 'PRESENT',
          notes: ''
        };
      }
    });

    setRowStates(initialRows);
    setHasUnsavedChanges(false);
  }, [selectedDate, attendance, staffMembers]);

  // Date navigation helpers
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const handleStatusChange = (staffId: string, status: AttendanceStatus) => {
    setRowStates((prev) => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        status
      }
    }));
    setHasUnsavedChanges(true);
  };

  const handleNotesChange = (staffId: string, notes: string) => {
    setRowStates((prev) => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        notes
      }
    }));
    setHasUnsavedChanges(true);
  };

  const handleSaveAll = () => {
    const recordsToSave = staffMembers.map((staff) => {
      const state = rowStates[staff.id] || { status: 'PRESENT', notes: '' };
      return {
        personId: staff.id,
        personName: staff.name,
        personRole: staff.role,
        date: selectedDate,
        status: state.status,
        notes: state.notes.trim() || undefined
      };
    });

    bulkMarkAttendance(selectedDate, recordsToSave);
    setHasUnsavedChanges(false);
    toast.success(`Attendance saved for ${staffMembers.length} staff members on ${selectedDate}!`);
  };

  // Quick stats for current date (PRESENT / ABSENT ONLY per Item 20)
  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;

    Object.values(rowStates).forEach((r) => {
      if (r.status === 'PRESENT') present++;
      else if (r.status === 'ABSENT') absent++;
    });

    return { present, absent };
  }, [rowStates]);

  // Exports per Item 21
  const handleExportCSV = () => {
    const headers = ['Date', 'Staff Name', 'Role', 'Status', 'Notes'];
    const rows = staffMembers.map((staff) => {
      const rowState = rowStates[staff.id] || { status: 'PRESENT', notes: '' };
      return [
        selectedDate,
        staff.name,
        staff.role,
        rowState.status,
        rowState.notes || ''
      ];
    });
    exportToCSV(`staff_attendance_${selectedDate}`, headers, rows);
  };

  const handleExportExcel = () => {
    const headers = ['Date', 'Staff Name', 'Role', 'Status', 'Notes'];
    const rows = staffMembers.map((staff) => {
      const rowState = rowStates[staff.id] || { status: 'PRESENT', notes: '' };
      return [
        selectedDate,
        staff.name,
        staff.role,
        rowState.status,
        rowState.notes || ''
      ];
    });
    exportToExcel(`staff_attendance_${selectedDate}`, headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ['Date', 'Staff Name', 'Role', 'Status', 'Notes'];
    const rows = staffMembers.map((staff) => {
      const rowState = rowStates[staff.id] || { status: 'PRESENT', notes: '' };
      return [
        selectedDate,
        staff.name,
        staff.role,
        rowState.status,
        rowState.notes || ''
      ];
    });
    exportToPDF(`Staff Attendance — ${selectedDate}`, headers, rows);
  };

  const [reportSearchQuery, setReportSearchQuery] = useState('');

  // Monthly Report Calculations (Counts ONLY - Present and Absent)
  const monthlySummary = useMemo(() => {
    const monthPrefix = reportMonth; // e.g. "2026-09"
    const monthRecords = attendance.filter((a) => a.date.startsWith(monthPrefix));

    const targetStaff = staffMembers.filter(
      (p) => reportStaffId === 'ALL' || p.id === reportStaffId
    );

    let list = targetStaff.map((staff) => {
      const staffMonthRecords = monthRecords.filter((a) => a.personId === staff.id);

      let present = 0;
      let absent = 0;

      staffMonthRecords.forEach((r) => {
        if (r.status === 'PRESENT') present += 1;
        else if (r.status === 'ABSENT') absent += 1;
      });

      return {
        staffId: staff.id,
        staffName: staff.name,
        role: staff.role,
        present,
        absent
      };
    });

    if (reportSearchQuery.trim()) {
      const q = reportSearchQuery.toLowerCase().trim();
      list = list.filter((r) => r.staffName.toLowerCase().includes(q));
    }

    return list;
  }, [attendance, staffMembers, reportMonth, reportStaffId, reportSearchQuery]);

  const summarySortExtractors = useMemo(() => ({
    staffName: (r: { staffName: string }) => r.staffName,
    role: (r: { role: string }) => r.role,
    present: (r: { present: number }) => r.present,
    absent: (r: { absent: number }) => r.absent
  }), []);

  const summaryTable = useTableState({
    data: monthlySummary,
    initialSortField: 'staffName',
    initialSortDirection: 'asc',
    initialPageSize: 10,
    pageSizeOptions: [10, 25, 50, 100],
    sortExtractors: summarySortExtractors
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            Staff Attendance
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
            Daily attendance sheet for salesmen. Mark the team directly from the table and save in one click.
          </p>
        </div>

        {/* Tab switch */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('DAILY')}
            style={{
              padding: '6px 16px',
              fontSize: '0.82rem',
              fontWeight: 700,
              border: 'none',
              borderRadius: '7px',
              cursor: 'pointer',
              background: activeTab === 'DAILY' ? '#ffffff' : 'transparent',
              color: activeTab === 'DAILY' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'DAILY' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Daily Sheet
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('MONTHLY_REPORT')}
            style={{
              padding: '6px 16px',
              fontSize: '0.82rem',
              fontWeight: 700,
              border: 'none',
              borderRadius: '7px',
              cursor: 'pointer',
              background: activeTab === 'MONTHLY_REPORT' ? '#ffffff' : 'transparent',
              color: activeTab === 'MONTHLY_REPORT' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'MONTHLY_REPORT' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Monthly Summary
          </button>
        </div>
      </div>

      {activeTab === 'DAILY' ? (
        /* ================= DAILY ATTENDANCE SHEET ================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Operational Control Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              background: '#ffffff',
              padding: '14px 18px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            {/* Date Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                Attendance Date:
              </span>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handlePrevDay}
                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                title="Previous Day"
              >
                <ChevronLeft size={16} />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleNextDay}
                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                title="Next Day"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleToday}
                style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600 }}
              >
                Today
              </button>
            </div>

            {/* Quick Status Pill Counters (Item 20: Present: X, Absent: X ONLY) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  background: '#dcfce7',
                  color: '#15803d'
                }}
              >
                Present: {counts.present}
              </span>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  background: '#fee2e2',
                  color: '#b91c1c'
                }}
              >
                Absent: {counts.absent}
              </span>
            </div>

            {/* Export and Save Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <TableExportButtons
                onExportCSV={handleExportCSV}
                onExportExcel={handleExportExcel}
                onExportPDF={handleExportPDF}
                disabled={staffMembers.length === 0}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveAll}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 18px',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  background: hasUnsavedChanges ? '#16a34a' : '#2563eb'
                }}
              >
                <Save size={16} />
                <span>{hasUnsavedChanges ? 'Save Changes' : 'Save Attendance'}</span>
              </button>
            </div>
          </div>

          {/* Daily Roster Table */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 18px', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                    Staff Name
                  </th>
                  <th style={{ padding: '12px 18px', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                    Role
                  </th>
                  <th style={{ padding: '12px 18px', fontSize: '0.8rem', fontWeight: 700, color: '#475569', minWidth: '360px' }}>
                    Status
                  </th>
                  <th style={{ padding: '12px 18px', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                    Notes (Optional)
                  </th>
                </tr>
              </thead>
              <tbody>
                {staffMembers.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                      No active staff found. Add salesmen in Staff & Salesmen view.
                    </td>
                  </tr>
                ) : (
                  staffMembers.map((staff) => {
                    const rowState = rowStates[staff.id] || { status: 'PRESENT', notes: '' };
                    const status = rowState.status;

                    return (
                      <tr
                        key={staff.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        {/* Staff Name */}
                        <td style={{ padding: '12px 18px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
                            {staff.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {staff.phone}
                          </div>
                        </td>

                        {/* Role */}
                        <td style={{ padding: '12px 18px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: '#eff6ff',
                              color: '#1d4ed8'
                            }}
                          >
                            Salesman
                          </span>
                        </td>

                        {/* Inline Attendance Segmented Buttons: Present / Absent ONLY */}
                        <td style={{ padding: '10px 18px' }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              background: '#f1f5f9',
                              padding: '3px',
                              borderRadius: '8px',
                              gap: '2px'
                            }}
                          >
                            {/* PRESENT */}
                            <button
                              type="button"
                              onClick={() => handleStatusChange(staff.id, 'PRESENT')}
                              style={{
                                padding: '5px 16px',
                                fontSize: '0.8rem',
                                fontWeight: status === 'PRESENT' ? 700 : 500,
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                background: status === 'PRESENT' ? '#16a34a' : 'transparent',
                                color: status === 'PRESENT' ? '#ffffff' : '#475569',
                                boxShadow: status === 'PRESENT' ? '0 1px 2px rgba(0,0,0,0.15)' : 'none',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              Present
                            </button>

                            {/* ABSENT */}
                            <button
                              type="button"
                              onClick={() => handleStatusChange(staff.id, 'ABSENT')}
                              style={{
                                padding: '5px 16px',
                                fontSize: '0.8rem',
                                fontWeight: status === 'ABSENT' ? 700 : 500,
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                background: status === 'ABSENT' ? '#dc2626' : 'transparent',
                                color: status === 'ABSENT' ? '#ffffff' : '#475569',
                                boxShadow: status === 'ABSENT' ? '0 1px 2px rgba(0,0,0,0.15)' : 'none',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              Absent
                            </button>
                          </div>
                        </td>

                        {/* Inline Notes */}
                        <td style={{ padding: '10px 18px' }}>
                          <input
                            type="text"
                            placeholder="Reason or notes..."
                            value={rowState.notes}
                            onChange={(e) => handleNotesChange(staff.id, e.target.value)}
                            style={{
                              width: '100%',
                              maxWidth: '260px',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                              fontSize: '0.8rem',
                              color: '#334155',
                              outline: 'none'
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Save Action */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveAll}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 24px',
                fontWeight: 700,
                fontSize: '0.9rem',
                background: hasUnsavedChanges ? '#16a34a' : '#2563eb'
              }}
            >
              <Save size={18} />
              <span>{hasUnsavedChanges ? 'Save Changes' : 'Save Attendance'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* ================= MONTHLY ATTENDANCE SUMMARY ================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filters Bar */}
          {/* Simple Monthly Counts Table Card */}
          <div className="table-container">
            <div className="table-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, color: '#334155' }}>
                    Month:
                  </label>
                  <input
                    type="month"
                    value={reportMonth}
                    onChange={(e) => setReportMonth(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, color: '#334155' }}>
                    Staff:
                  </label>
                  <select
                    value={reportStaffId}
                    onChange={(e) => setReportStaffId(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      outline: 'none',
                      background: '#ffffff'
                    }}
                  >
                    <option value="ALL">All Staff ({staffMembers.length})</option>
                    {staffMembers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search staff..."
                  value={reportSearchQuery}
                  onChange={(e) => setReportSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 12px 7px 32px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    outline: 'none',
                    background: '#f8fafc'
                  }}
                />
                {reportSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setReportSearchQuery('')}
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
              <table className="data-table" style={{ width: '100%', textAlign: 'left' }}>
                <thead>
                  <tr>
                    <SortableHeader label="Staff Name" field="staffName" currentSortField={summaryTable.sortField} currentSortDirection={summaryTable.sortDirection} onSort={summaryTable.toggleSort} />
                    <SortableHeader label="Role" field="role" currentSortField={summaryTable.sortField} currentSortDirection={summaryTable.sortDirection} onSort={summaryTable.toggleSort} />
                    <SortableHeader label="Present Days" field="present" currentSortField={summaryTable.sortField} currentSortDirection={summaryTable.sortDirection} onSort={summaryTable.toggleSort} align="center" />
                    <SortableHeader label="Absent Days" field="absent" currentSortField={summaryTable.sortField} currentSortDirection={summaryTable.sortDirection} onSort={summaryTable.toggleSort} align="center" />
                  </tr>
                </thead>
                <tbody>
                  {summaryTable.pagedData.length === 0 ? (
                    <TableEmptyState
                      colSpan={4}
                      title={reportSearchQuery ? 'No matching staff members' : 'No staff records found'}
                      description={
                        reportSearchQuery
                          ? `No staff records matched "${reportSearchQuery}".`
                          : `No staff records found for ${reportMonth}.`
                      }
                      icon={<Users size={28} />}
                    />
                  ) : (
                    summaryTable.pagedData.map((row) => (
                      <tr key={row.staffId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 18px', fontWeight: 700, color: '#0f172a' }}>
                          {row.staffName}
                        </td>
                        <td style={{ padding: '12px 18px', color: '#64748b', fontSize: '0.84rem' }}>
                          Salesman
                        </td>
                        <td style={{ padding: '12px 18px', textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>
                          {row.present}
                        </td>
                        <td style={{ padding: '12px 18px', textAlign: 'center', fontWeight: 700, color: row.absent > 0 ? '#dc2626' : '#94a3b8' }}>
                          {row.absent}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination
              currentPage={summaryTable.currentPage}
              pageSize={summaryTable.pageSize}
              totalItems={summaryTable.totalItems}
              onPageChange={summaryTable.setPage}
              onPageSizeChange={summaryTable.setPageSize}
              itemLabel="staff records"
            />
          </div>
        </div>
      )}
    </div>
  );
};
