import { prisma } from '../../db/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  CreatePersonInput,
  PersonFilterQueryParams,
  UpdatePersonInput,
} from './persons.schemas.js';
import { PersonSummary } from './persons.types.js';
import { PersonType, Prisma, UserRole } from '@prisma/client';
import { UsersService } from '../users/users.service.js';

export class PersonsService {
  private static sanitizePerson(person: any): PersonSummary {
    return {
      id: person.id,
      name: person.name,
      phone: person.phone,
      address: person.address,
      type: person.type,
      active: person.active,
      hasUserAccount: !!person.user,
      username: person.user?.username || null,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
    };
  }

  /**
   * Retrieves persons with optional type, active status, and search query filters
   */
  public static async getAllPersons(filters?: PersonFilterQueryParams): Promise<PersonSummary[]> {
    const where: Prisma.PersonWhereInput = {};

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.active !== undefined) {
      where.active = filters.active;
    }

    if (filters?.search && filters.search.trim().length > 0) {
      const term = filters.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }

    const persons = await prisma.person.findMany({
      where,
      include: {
        user: { select: { id: true, username: true } },
      },
      orderBy: { name: 'asc' },
    });

    return persons.map((p) => this.sanitizePerson(p));
  }

  /**
   * Retrieves single Person record by ID
   */
  public static async getPersonById(id: string): Promise<PersonSummary> {
    const person = await prisma.person.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true } },
      },
    });

    if (!person) {
      throw AppError.notFound('Person record not found');
    }

    return this.sanitizePerson(person);
  }

  /**
   * Creates a Person record, optionally creating a linked Salesman User login account atomically.
   */
  public static async createPerson(input: CreatePersonInput): Promise<PersonSummary> {
    if (input.type === PersonType.SALESMAN && input.username && input.password) {
      // Atomic Person + User creation transaction
      const created = await prisma.$transaction(async (tx) => {
        // 1. Check duplicate username
        const existingUser = await tx.user.findUnique({
          where: { username: input.username },
        });
        if (existingUser) {
          throw AppError.conflict('This login ID is already in use');
        }

        // 2. Create person record
        const person = await tx.person.create({
          data: {
            name: input.name,
            phone: input.phone,
            address: input.address,
            type: input.type,
            active: input.active ?? true,
          },
        });

        // 3. Hash password using Argon2id
        const passwordHash = await UsersService.hashPassword(input.password!);

        // 4. Create User login account linked to Person
        const user = await tx.user.create({
          data: {
            username: input.username!,
            passwordHash,
            role: UserRole.SALESMAN,
            personId: person.id,
            isActive: true,
          },
          select: { id: true, username: true },
        });

        return {
          ...person,
          user,
        };
      });

      return this.sanitizePerson(created);
    }

    // Standard Person creation without credentials (e.g. DEALER or STAFF)
    const person = await prisma.person.create({
      data: {
        name: input.name,
        phone: input.phone,
        address: input.address,
        type: input.type,
        active: input.active ?? true,
      },
      include: {
        user: { select: { id: true, username: true } },
      },
    });

    return this.sanitizePerson(person);
  }

  /**
   * Updates an existing Person record
   */
  public static async updatePerson(id: string, input: UpdatePersonInput): Promise<PersonSummary> {
    const existing = await prisma.person.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound('Person record not found');
    }

    const updated = await prisma.person.update({
      where: { id },
      data: {
        name: input.name,
        phone: input.phone,
        address: input.address,
        type: input.type,
        active: input.active,
      },
      include: {
        user: { select: { id: true } },
      },
    });

    return this.sanitizePerson(updated);
  }

  /**
   * Deactivates or activates a Person record
   */
  public static async updatePersonStatus(id: string, active: boolean): Promise<PersonSummary> {
    const existing = await prisma.person.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound('Person record not found');
    }

    const updated = await prisma.person.update({
      where: { id },
      data: { active },
      include: {
        user: { select: { id: true } },
      },
    });

    return this.sanitizePerson(updated);
  }

  /**
   * Delete person by ID. Hard deletes if no transaction history, otherwise deactivates.
   */
  public static async deletePerson(id: string): Promise<{ deleted: boolean; deactivated?: boolean }> {
    const person = await prisma.person.findUnique({
      where: { id },
      include: {
        salesmanHandovers: { select: { id: true } },
        dealerHandovers: { select: { id: true } },
        salesmanIssues: { select: { id: true } },
        dealerIssues: { select: { id: true } },
        salesmanLedgerTransactions: { select: { id: true } },
        attendances: { select: { id: true } },
        salaries: { select: { id: true } },
      },
    });

    if (!person) {
      throw AppError.notFound('Person record not found');
    }

    const hasTransactions =
      person.salesmanHandovers.length > 0 ||
      person.dealerHandovers.length > 0 ||
      person.salesmanIssues.length > 0 ||
      person.dealerIssues.length > 0 ||
      person.salesmanLedgerTransactions.length > 0 ||
      person.attendances.length > 0 ||
      person.salaries.length > 0;

    if (!hasTransactions) {
      await prisma.$transaction(async (tx) => {
        await tx.salesTarget.deleteMany({ where: { salesmanId: id } });
        await tx.user.deleteMany({ where: { personId: id } });
        await tx.person.delete({ where: { id } });
      });
      return { deleted: true };
    } else {
      await prisma.person.update({
        where: { id },
        data: { active: false },
      });
      await prisma.user.updateMany({
        where: { personId: id },
        data: { isActive: false },
      });
      return { deleted: false, deactivated: true };
    }
  }
}

