import { AttendanceStatus } from '@prisma/client';

export { AttendanceStatus };

export interface CreateAttendanceInput {
  salesmanId: string;
  attendanceDate: string; // YYYY-MM-DD
  status: AttendanceStatus;
  notes?: string;
}

export interface AttendanceFilters {
  salesmanId?: string;
  fromDate?: string; // YYYY-MM-DD
  toDate?: string; // YYYY-MM-DD
  status?: AttendanceStatus;
  page?: number;
  limit?: number;
}

export interface AttendanceSummaryFilters {
  salesmanId?: string;
  fromDate?: string; // YYYY-MM-DD
  toDate?: string; // YYYY-MM-DD
}

export interface FormattedAttendance {
  id: string;
  salesmanId: string;
  salesmanName?: string;
  attendanceDate: string; // YYYY-MM-DD
  status: AttendanceStatus;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttendanceListResponse {
  attendances: FormattedAttendance[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AttendanceSummaryResponse {
  presentDays: number;
  absentDays: number;
  totalRecordedDays: number;
}
