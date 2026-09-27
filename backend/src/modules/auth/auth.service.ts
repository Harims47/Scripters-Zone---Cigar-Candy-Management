import { prisma } from '../../db/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ChangePasswordInput, LoginInput } from './auth.schemas.js';
import { AuthLoginResponse, CurrentUserResponse } from './auth.types.js';
import { UsersService } from '../users/users.service.js';
import argon2 from 'argon2';

export class AuthService {
  /**
   * Validates credentials, checks active status, and returns authenticated payload
   */
  public static async login(
    input: LoginInput,
    signToken: (payload: { userId: string; role: any }) => string
  ): Promise<AuthLoginResponse> {
    // 1. Locate user
    const user = await prisma.user.findUnique({
      where: { username: input.username },
      include: {
        person: {
          select: { id: true, name: true, phone: true, type: true },
        },
      },
    });

    if (!user) {
      throw AppError.unauthorized('Invalid username or password');
    }

    // 2. Inactive account check
    if (!user.isActive) {
      throw AppError.unauthorized('Your account is deactivated. Please contact Administrator.');
    }

    // 3. Argon2id password verification
    const passwordValid = await argon2.verify(user.passwordHash, input.password);
    if (!passwordValid) {
      throw AppError.unauthorized('Invalid username or password');
    }

    // 4. Issue access token with essential claims
    const accessToken = signToken({
      userId: user.id,
      role: user.role,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        person: user.person
          ? {
              id: user.person.id,
              name: user.person.name,
              phone: user.person.phone,
              type: user.person.type,
            }
          : null,
      },
    };
  }

  /**
   * Retrieves current authenticated user profile
   */
  public static async getCurrentUser(userId: string): Promise<CurrentUserResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        person: {
          select: { id: true, name: true, phone: true, type: true },
        },
      },
    });

    if (!user) {
      throw AppError.unauthorized('User not found');
    }

    if (!user.isActive) {
      throw AppError.unauthorized('User account is deactivated');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      person: user.person
        ? {
            id: user.person.id,
            name: user.person.name,
            phone: user.person.phone,
            type: user.person.type,
          }
        : null,
    };
  }

  /**
   * Changes authenticated user password with current password verification
   */
  public static async changePassword(
    userId: string,
    input: ChangePasswordInput
  ): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw AppError.unauthorized('User not found');
    }

    // Verify current password
    const isCurrentValid = await argon2.verify(user.passwordHash, input.currentPassword);
    if (!isCurrentValid) {
      throw AppError.unauthorized('Current password is incorrect');
    }

    // Hash new password using Argon2id
    const newHash = await UsersService.hashPassword(input.newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { message: 'Password changed successfully' };
  }
}
