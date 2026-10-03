import { Prisma, UserRole, PersonType, AttendanceStatus } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  CreateAttendanceInput,
  AttendanceFilters,
  AttendanceSummaryFilters,
  FormattedAttendance,
  AttendanceListResponse,
  AttendanceSummaryResponse,
} from './attendance.types.js';

export class AttendanceService {
  /**
   * Helper: Parse YYYY-MM-DD string to UTC Date.
   */
  private static parseDate(dateStr: string): Date {
    return new Date(`${dateStr}T00:00:00.000Z`);
  }

  /**
   * Helper: Format Date to YYYY-MM-DD.
   */
  private static formatDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  /**
   * Format Prisma Attendance to FormattedAttendance DTO.
   */
  private static formatAttendance(attendance: any): FormattedAttendance {
    return {
      id: attendance.id,
      salesmanId: attendance.salesmanId,
      salesmanName: attendance.salesman?.name,
      attendanceDate: this.formatDate(attendance.attendanceDate),
      status: attendance.status,
      notes: attendance.notes || null,
      createdBy: attendance.createdBy,
      createdAt: attendance.createdAt,
      updatedAt: attendance.updatedAt,
    };
  }

  /**
   * Record daily attendance for a salesman (Admin only).
   */
  static async createAttendance(
    input: CreateAttendanceInput,
    currentUser: { userId: string; role: string }
  ): Promise<FormattedAttendance> {
    if (currentUser.role !== UserRole.ADMIN) {
      throw AppError.forbidden('Only Admin can record attendance');
    }

    if (!Object.values(AttendanceStatus).includes(input.status)) {
      throw AppError.badRequest('status must be PRESENT or ABSENT');
    }

    // 1. Salesman validation
    const person = await prisma.person.findUnique({
      where: { id: input.salesmanId },
    });

    if (!person) {
      throw AppError.notFound(`Salesman with ID "${input.salesmanId}" not found`);
    }

    if (person.type !== PersonType.SALESMAN) {
      throw AppError.badRequest(`Selected person "${person.name}" is not a SALESMAN. Recipient must be a Salesman.`);
    }

    if (!person.active) {
      throw AppError.badRequest(`Cannot record attendance for inactive salesman "${person.name}"`);
    }

    // 2. Duplicate check
    const attendanceDate = this.parseDate(input.attendanceDate);
    const existing = await prisma.salesmanAttendance.findUnique({
      where: {
        salesmanId_attendanceDate: {
          salesmanId: input.salesmanId,
          attendanceDate,
        },
      },
    });

    if (existing) {
      throw AppError.conflict(
        `Attendance already recorded for salesman "${person.name}" on ${input.attendanceDate}`
      );
    }

    // 3. Create attendance
    const attendance = await prisma.salesmanAttendance.create({
      data: {
        salesmanId: input.salesmanId,
        attendanceDate,
        status: input.status,
        notes: input.notes ? input.notes.trim() : null,
        createdBy: currentUser.userId,
      },
      include: {
        salesman: { select: { id: true, name: true } },
      },
    });

    return this.formatAttendance(attendance);
  }

  /**
   * List attendance records with filtering and pagination.
   */
  static async getAttendance(
    filters: AttendanceFilters,
    currentUser: { userId: string; role: string }
  ): Promise<AttendanceListResponse> {
    if (currentUser.role !== UserRole.ADMIN) {
      throw AppError.forbidden('Only Admin can view attendance records');
    }

    const where: Prisma.SalesmanAttendanceWhereInput = {};

    if (filters.salesmanId) {
      where.salesmanId = filters.salesmanId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.fromDate || filters.toDate) {
      where.attendanceDate = {};
      if (filters.fromDate) {
        where.attendanceDate.gte = this.parseDate(filters.fromDate);
      }
      if (filters.toDate) {
        where.attendanceDate.lte = this.parseDate(filters.toDate);
      }
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const [total, attendances] = await Promise.all([
      prisma.salesmanAttendance.count({ where }),
      prisma.salesmanAttendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ attendanceDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          salesman: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      attendances: attendances.map((a) => this.formatAttendance(a)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single attendance record by ID.
   */
  static async getAttendanceById(
    id: string,
    currentUser: { userId: string; role: string }
  ): Promise<FormattedAttendance> {
    if (currentUser.role !== UserRole.ADMIN) {
      throw AppError.forbidden('Only Admin can view attendance records');
    }

    const attendance = await prisma.salesmanAttendance.findUnique({
      where: { id },
      include: {
        salesman: { select: { id: true, name: true } },
      },
    });

    if (!attendance) {
      throw AppError.notFound(`Attendance record with ID "${id}" not found`);
    }

    return this.formatAttendance(attendance);
  }

  /**
   * Get aggregated attendance summary for a salesman and date range.
   */
  static async getAttendanceSummary(
    filters: AttendanceSummaryFilters,
    currentUser: { userId: string; role: string }
  ): Promise<AttendanceSummaryResponse> {
    if (currentUser.role !== UserRole.ADMIN) {
      throw AppError.forbidden('Only Admin can view attendance summary');
    }

    const where: Prisma.SalesmanAttendanceWhereInput = {};

    if (filters.salesmanId) {
      where.salesmanId = filters.salesmanId;
    }

    if (filters.fromDate || filters.toDate) {
      where.attendanceDate = {};
      if (filters.fromDate) {
        where.attendanceDate.gte = this.parseDate(filters.fromDate);
      }
      if (filters.toDate) {
        where.attendanceDate.lte = this.parseDate(filters.toDate);
      }
    }

    const [presentDays, absentDays] = await Promise.all([
      prisma.salesmanAttendance.count({
        where: { ...where, status: AttendanceStatus.PRESENT },
      }),
      prisma.salesmanAttendance.count({
        where: { ...where, status: AttendanceStatus.ABSENT },
      }),
    ]);

    return {
      presentDays,
      absentDays,
      totalRecordedDays: presentDays + absentDays,
    };
  }

  /**
   * Delete attendance record by ID.
   */
  static async deleteAttendance(id: string, currentUser?: { role?: string }): Promise<void> {
    if (currentUser?.role && currentUser.role !== UserRole.ADMIN) {
      throw AppError.forbidden('Only Admin can delete attendance records');
    }

    const existing = await prisma.salesmanAttendance.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound('Attendance record not found');
    }

    await prisma.salesmanAttendance.delete({ where: { id } });
  }
}

