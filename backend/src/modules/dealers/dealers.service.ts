import { prisma } from '../../db/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  CreateDealerInput,
  DealerFilterQueryParams,
  UpdateDealerInput,
} from './dealers.schemas.js';
import { DealerSummary } from './dealers.types.js';
import { PersonType, Prisma } from '@prisma/client';
import { PersonsService } from '../persons/persons.service.js';

export class DealersService {
  private static sanitizeDealer(person: any): DealerSummary {
    return {
      id: person.id,
      name: person.name,
      phone: person.phone,
      address: person.address,
      active: person.active,
      hasUserAccount: false,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
    };
  }

  /**
   * Retrieves all dealer records with optional filters
   */
  public static async getAllDealers(filters?: DealerFilterQueryParams): Promise<DealerSummary[]> {
    const where: Prisma.PersonWhereInput = {
      type: PersonType.DEALER,
    };

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

    const dealers = await prisma.person.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return dealers.map((d) => this.sanitizeDealer(d));
  }

  /**
   * Retrieves single Dealer by ID
   */
  public static async getDealerById(id: string): Promise<DealerSummary> {
    const dealer = await prisma.person.findFirst({
      where: {
        id,
        type: PersonType.DEALER,
      },
    });

    if (!dealer) {
      throw AppError.notFound(`Dealer with ID "${id}" not found`);
    }

    return this.sanitizeDealer(dealer);
  }

  /**
   * Creates a new Dealer record.
   * BUSINESS RULE: Dealer is an Admin-managed record and NEVER has authentication credentials.
   */
  public static async createDealer(input: CreateDealerInput): Promise<DealerSummary> {
    const dealer = await prisma.person.create({
      data: {
        name: input.name.trim(),
        phone: input.phone ? input.phone.trim() : null,
        address: input.address ? input.address.trim() : null,
        type: PersonType.DEALER,
        active: input.active ?? true,
      },
    });

    return this.sanitizeDealer(dealer);
  }

  /**
   * Updates an existing Dealer record
   */
  public static async updateDealer(id: string, input: UpdateDealerInput): Promise<DealerSummary> {
    const existing = await prisma.person.findFirst({
      where: { id, type: PersonType.DEALER },
    });

    if (!existing) {
      throw AppError.notFound(`Dealer with ID "${id}" not found`);
    }

    const updated = await prisma.person.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone ? input.phone.trim() : null } : {}),
        ...(input.address !== undefined ? { address: input.address ? input.address.trim() : null } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });

    return this.sanitizeDealer(updated);
  }

  /**
   * Activates or deactivates a Dealer record
   */
  public static async updateDealerStatus(id: string, active: boolean): Promise<DealerSummary> {
    const existing = await prisma.person.findFirst({
      where: { id, type: PersonType.DEALER },
    });

    if (!existing) {
      throw AppError.notFound(`Dealer with ID "${id}" not found`);
    }

    const updated = await prisma.person.update({
      where: { id },
      data: { active },
    });

    return this.sanitizeDealer(updated);
  }

  /**
   * Delete or deactivate a Dealer record (ADMIN only)
   */
  public static async deleteDealer(id: string): Promise<{ deleted: boolean; deactivated?: boolean }> {
    const existing = await prisma.person.findFirst({
      where: { id, type: PersonType.DEALER },
    });

    if (!existing) {
      throw AppError.notFound(`Dealer with ID "${id}" not found`);
    }

    return PersonsService.deletePerson(id);
  }
}
