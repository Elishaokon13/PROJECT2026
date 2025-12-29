// User service - orchestrates user management
// Handles user CRUD operations scoped to merchants

import type { FastifyInstance } from 'fastify';
import { NotFoundError, ValidationError } from '../errors/index.js';
import type { PaginatedResponse } from '../types/index.js';

export interface CreateUserParams {
  merchantId: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  metadata?: Record<string, unknown>;
}

export interface UserResult {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListUsersParams {
  merchantId: string;
  limit: number;
  offset: number;
}

export class UserService {
  constructor(private readonly db: FastifyInstance['db']) {}

  /**
   * Create a new user for a merchant
   */
  async createUser(params: CreateUserParams): Promise<UserResult> {
    // Check if user with same email already exists for this merchant
    const existing = await this.db.user.findFirst({
      where: {
        merchantId: params.merchantId,
        email: params.email,
      },
    });

    if (existing) {
      throw new ValidationError(`User with email ${params.email} already exists for this merchant`);
    }

    // Create user
    const user = await this.db.user.create({
      data: {
        merchantId: params.merchantId,
        email: params.email,
        firstName: params.firstName,
        lastName: params.lastName,
        phoneNumber: params.phoneNumber ?? undefined,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
      },
    });

    return this.mapUser(user);
  }

  /**
   * Get user by ID (scoped to merchant)
   */
  async getUserById(merchantId: string, userId: string): Promise<UserResult | null> {
    const user = await this.db.user.findFirst({
      where: {
        id: userId,
        merchantId,
      },
    });

    if (!user) {
      return null;
    }

    return this.mapUser(user);
  }

  /**
   * List users for a merchant (with pagination)
   */
  async listUsers(params: ListUsersParams): Promise<PaginatedResponse<UserResult>> {
    // Get users with pagination
    const [users, total] = await Promise.all([
      this.db.user.findMany({
        where: {
          merchantId: params.merchantId,
        },
        take: params.limit,
        skip: params.offset,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.db.user.count({
        where: {
          merchantId: params.merchantId,
        },
      }),
    ]);

    return {
      data: users.map((user) => this.mapUser(user)),
      pagination: {
        limit: params.limit,
        offset: params.offset,
        total,
        hasMore: params.offset + params.limit < total,
      },
    };
  }

  /**
   * Map Prisma user to domain type
   */
  private mapUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): UserResult {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      metadata: user.metadata as Record<string, unknown> | null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

// Fastify plugin to inject user service
export async function userServicePlugin(fastify: FastifyInstance): Promise<void> {
  const userService = new UserService(fastify.db);
  fastify.decorate('userService', userService);
}

declare module 'fastify' {
  interface FastifyInstance {
    userService: UserService;
  }
}

