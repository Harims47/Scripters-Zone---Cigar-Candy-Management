import { ApiClient } from './apiClient';

export interface BackendAttendance {
  id: string;
  salesmanId: string;
  salesmanName?: string;
  attendanceDate: string;
  status: 'PRESENT' | 'ABSENT';
  notes?: string | null;
  createdBy: string;
  createdAt: string;
  salesman?: {
    id: string;
    name: string;
  };
}

export interface BackendAttendanceSummary {
  presentDays: number;
  absentDays: number;
  totalRecordedDays: number;
}

export class AttendanceService {
  static async getAttendance(params?: { salesmanId?: string; status?: string; fromDate?: string; toDate?: string }) {
    const res = await ApiClient.get<any>('/attendance', {
      limit: 100,
      ...params,
    });
    return Array.isArray(res) ? res : (res?.attendances || []);
  }

  static async getAttendanceSummary(params?: { salesmanId?: string; fromDate?: string; toDate?: string }) {
    return ApiClient.get<BackendAttendanceSummary>('/attendance/summary', params);
  }

  static async markAttendance(data: {
    salesmanId: string;
    attendanceDate: string;
    status: 'PRESENT' | 'ABSENT';
    notes?: string;
  }) {
    return ApiClient.post<BackendAttendance>('/attendance', data);
  }

  static async deleteAttendance(id: string) {
    return ApiClient.delete(`/attendance/${id}`);
  }
}

