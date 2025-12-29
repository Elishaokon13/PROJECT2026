// User transformer
// Converts internal user models to public API format
// CRITICAL: Only transforms, never modifies domain models

import type { User as PrismaUser } from '@prisma/client';
import { toPublicId } from '../lib/public-ids.js';
import type { User } from '../../sdk/src/types/api.js';
import type { UserResult } from '../services/user-service.js';

// Transform from Prisma model
export function transformUser(user: PrismaUser | UserResult): User {
  const userObj = 'createdAt' in user ? user : {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    metadata: user.metadata,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return {
    id: toPublicId('user', userObj.id),
    email: userObj.email,
    first_name: userObj.firstName,
    last_name: userObj.lastName,
    phone_number: userObj.phoneNumber,
    metadata: userObj.metadata as Record<string, unknown> | null,
    created_at: userObj.createdAt instanceof Date ? userObj.createdAt.toISOString() : userObj.createdAt,
  };
}

export function transformUsers(users: (PrismaUser | UserResult)[]): User[] {
  return users.map(transformUser);
}

