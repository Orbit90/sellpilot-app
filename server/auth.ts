import crypto from 'crypto';
import { User } from '../src/types';

/**
 * Production-ready password hashing using scrypt with cryptographically random salt.
 */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { hash, salt: actualSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const computed = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computed, 'utf-8'), Buffer.from(hash, 'utf-8'));
  } catch {
    return false;
  }
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function sanitizeUser(user: User): Omit<User, 'passwordHash' | 'passwordSalt'> {
  const { passwordHash, passwordSalt, ...safeUser } = user;
  return safeUser;
}
