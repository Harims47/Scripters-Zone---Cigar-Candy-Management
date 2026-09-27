import { prisma } from '../../db/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  CreateSupplierInput,
  SupplierFilterQueryParams,
  UpdateSupplierInput,
} from './suppliers.schemas.js';
import { SupplierSummary } from './suppliers.types.js';
import { Prisma } from '@prisma/client';

export class SuppliersService {
  private static sanitizeSupplier(supplier: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): SupplierSummary {
    return {
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone,
      address: supplier.address,
      active: supplier.active,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
    };
  }

  public static async getAllSuppliers(filters?: SupplierFilterQueryParams): Promise<SupplierSummary[]> {
    const where: Prisma.SupplierWhereInput = {};

    if (filters?.active !== undefined) {
      where.active = filters.active;
    }

    if (filters?.search && filters.search.trim().length > 0) {
      const term = filters.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { address: { contains: term, mode: 'insensitive' } },
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return suppliers.map((s) => this.sanitizeSupplier(s));
  }

  public static async getSupplierById(id: string): Promise<SupplierSummary> {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw AppError.notFound(`Supplier with ID "${id}" not found`);
    }

    return this.sanitizeSupplier(supplier);
  }

  public static async createSupplier(input: CreateSupplierInput): Promise<SupplierSummary> {
    const trimmedName = input.name.trim();

    // Check for duplicate supplier name
    const existing = await prisma.supplier.findFirst({
      where: { name: { equals: trimmedName, mode: 'insensitive' } },
    });

    if (existing) {
      throw AppError.conflict(`Supplier with name "${trimmedName}" already exists`);
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: trimmedName,
        phone: input.phone ? input.phone.trim() : null,
        address: input.address ? input.address.trim() : null,
        active: input.active ?? true,
      },
    });

    return this.sanitizeSupplier(supplier);
  }

  public static async updateSupplier(id: string, input: UpdateSupplierInput): Promise<SupplierSummary> {
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound(`Supplier with ID "${id}" not found`);
    }

    if (input.name) {
      const trimmedName = input.name.trim();
      if (trimmedName !== existing.name) {
        const duplicate = await prisma.supplier.findFirst({
          where: {
            id: { not: id },
            name: { equals: trimmedName, mode: 'insensitive' },
          },
        });

        if (duplicate) {
          throw AppError.conflict(`Another supplier with name "${trimmedName}" already exists`);
        }
      }
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone ? input.phone.trim() : null } : {}),
        ...(input.address !== undefined ? { address: input.address ? input.address.trim() : null } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });

    return this.sanitizeSupplier(updated);
  }

  public static async updateSupplierStatus(id: string, active: boolean): Promise<SupplierSummary> {
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound(`Supplier with ID "${id}" not found`);
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: { active },
    });

    return this.sanitizeSupplier(updated);
  }
}
