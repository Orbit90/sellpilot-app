import crypto from 'crypto';
import { User } from '../src/types';

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Enforces NIST-aligned password length policy.
 * - Minimum password length: 8 characters
 * - Maximum password length: 128 characters
 * - Does not impose arbitrary complexity requirements (special characters, digits, uppercase)
 * - Returns consistent, user-facing error message
 */
export function validatePasswordPolicy(password: unknown): PasswordValidationResult {
  if (typeof password !== 'string') {
    return {
      valid: false,
      error: 'Password is required.',
    };
  }

  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: 'Password must be between 8 and 128 characters.',
    };
  }

  return { valid: true };
}

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
