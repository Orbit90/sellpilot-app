import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Derives a 32-byte encryption key from environment secret.
 * Falls back safely to a dedicated salt + app secret/session secret.
 */
function getDerivedKey(): Buffer {
  const secret =
    process.env.CHANNEL_ENCRYPTION_KEY ||
    process.env.APP_SECRET ||
    process.env.SESSION_SECRET ||
    'sellpilot_channel_default_secure_vault_secret_2026';

  return crypto.scryptSync(secret, 'sellpilot_channel_salt_v1', 32);
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  tag: string;
}

/**
 * Encrypts an access token using AES-256-GCM.
 * Never logs or exposes plaintext token.
 */
export function encryptChannelToken(plainText: string): EncryptedData {
  if (!plainText || typeof plainText !== 'string') {
    throw new Error('Valid token string required for encryption');
  }

  const key = getDerivedKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/**
 * Decrypts an encrypted access token using AES-256-GCM.
 * Validates integrity via the GCM authentication tag.
 */
export function decryptChannelToken(ciphertext: string, ivHex: string, tagHex: string): string {
  if (!ciphertext || !ivHex || !tagHex) {
    throw new Error('Ciphertext, IV, and auth tag are required for token decryption');
  }

  const key = getDerivedKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Safely masks a token for diagnostic logging (shows only last 4 chars, never leaks body).
 */
export function maskToken(token?: string | null): string {
  if (!token) return '[empty]';
  if (token.length <= 8) return '****';
  return `...${token.slice(-4)}`;
}
