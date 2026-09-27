import { prisma } from '../../db/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { CreateUserInput, UpdateUserInput } from './users.schemas.js';
import { UserSummary } from './users.types.js';
import { PersonType, UserRole } from '@prisma/client';
import argon2 from 'argon2';

export class UsersService {
  /**
   * Hashes a plaintext password using Argon2id
   */
  public static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Helper to format user record without sensitive passwordHash
   */
  private static sanitizeUser(user: any): UserSummary {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      personId: user.personId,
      person: user.person
        ? {
            id: user.person.id,
            name: user.person.name,
            phone: user.person.phone,
            type: user.person.type,
          }
        : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Retrieves all users (without passwordHash)
   */
  public static async getAllUsers(): Promise<UserSummary[]> {
    const users = await prisma.user.findMany({
      include: {
        person: {
          select: { id: true, name: true, phone: true, type: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => this.sanitizeUser(u));
  }

  /**
   * Retrieves a single user by ID
   */
  public static async getUserById(id: string): Promise<UserSummary> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        person: {
          select: { id: true, name: true, phone: true, type: true },
        },
      },
    });

    if (!user) {
      throw AppError.notFound('User not found');
    }

    return this.sanitizeUser(user);
  }

  /**
   * Creates a new user with strict dealer login protection and role validation
   */
  public static async createUser(input: CreateUserInput): Promise<UserSummary> {
    // 1. Check duplicate username
    const existingUsername = await prisma.user.findUnique({
      where: { username: input.username },
    });
    if (existingUsername) {
      throw AppError.conflict(`Username "${input.username}" is already in use`);
    }

    // 2. Check duplicate email if provided
    if (input.email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: input.email },
      });
      if (existingEmail) {
        throw AppError.conflict(`Email "${input.email}" is already registered`);
      }
    }

    // 3. Person link validation and Dealer Login Protection
    if (input.personId) {
      const person = await prisma.person.findUnique({
        where: { id: input.personId },
        include: { user: true },
      });

      if (!person) {
        throw AppError.notFound('Referenced Person record not found');
      }

      // CRITICAL BUSINESS RULE: Dealer MUST NOT have a User account
      if (person.type === PersonType.DEALER) {
        throw AppError.conflict(
          'Dealers are business contacts and MUST NEVER have a login user account'
        );
      }

      // SALESMAN role must link to a SALESMAN person
      if (input.role === UserRole.SALESMAN && person.type !== PersonType.SALESMAN) {
        throw AppError.badRequest(
          'A Salesman user must be linked to a Person of type SALESMAN'
        );
      }

      // Ensure Person is not already claimed by another User
      if (person.user) {
        throw AppError.conflict('This person is already linked to an existing user account');
      }
    }

    // 4. Hash password with Argon2id
    const passwordHash = await this.hashPassword(input.password);

    // 5. Create user record
    const newUser = await prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        passwordHash,
        role: input.role,
        personId: input.personId,
        isActive: true,
      },
      include: {
        person: {
          select: { id: true, name: true, phone: true, type: true },
        },
      },
    });

    return this.sanitizeUser(newUser);
  }

  /**
   * Updates an existing user
   */
  public static async updateUser(id: string, input: UpdateUserInput): Promise<UserSummary> {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound('User not found');
    }

    // Check email uniqueness if modified
    if (input.email && input.email !== existing.email) {
      const emailConflict = await prisma.user.findUnique({ where: { email: input.email } });
      if (emailConflict) {
        throw AppError.conflict(`Email "${input.email}" is already in use`);
      }
    }

    // Check Person constraints if changing personId
    if (input.personId && input.personId !== existing.personId) {
      const person = await prisma.person.findUnique({
        where: { id: input.personId },
        include: { user: true },
      });

      if (!person) {
        throw AppError.notFound('Referenced Person record not found');
      }

      if (person.type === PersonType.DEALER) {
        throw AppError.conflict('Dealers cannot have a login user account');
      }

      const targetRole = input.role || existing.role;
      if (targetRole === UserRole.SALESMAN && person.type !== PersonType.SALESMAN) {
        throw AppError.badRequest('A Salesman user must be linked to a Person of type SALESMAN');
      }

      if (person.user && person.user.id !== id) {
        throw AppError.conflict('This person is already linked to another user account');
      }
    }

    // Optional admin password reset
    let passwordHash: string | undefined;
    if (input.password) {
      passwordHash = await this.hashPassword(input.password);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        email: input.email,
        role: input.role,
        personId: input.personId,
        ...(passwordHash ? { passwordHash } : {}),
      },
      include: {
        person: {
          select: { id: true, name: true, phone: true, type: true },
        },
      },
    });

    return this.sanitizeUser(updated);
  }

  /**
   * Activates or deactivates a user
   */
  public static async updateUserStatus(id: string, isActive: boolean): Promise<UserSummary> {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound('User not found');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive },
      include: {
        person: {
          select: { id: true, name: true, phone: true, type: true },
        },
      },
    });

    return this.sanitizeUser(updated);
  }
}
