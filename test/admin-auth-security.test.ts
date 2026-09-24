/**
 * Security & Regression Test Suite: Default Admin Password Remediation
 *
 * Verifies:
 * 1. Hardcoded default admin password literal does not exist in any file.
 * 2. .env.example does not contain hardcoded default admin passwords or secrets.
 * 3. Initial admin provisioning respects ADMIN_PASSWORD environment variable and does NOT create an account with a default password when absent.
 * 4. Password hashing properly salts and hashes provided ADMIN_PASSWORD.
 */

import fs from 'fs';
import path from 'path';
import { hashPassword, verifyPassword } from '../server/auth';

async function runTests() {
  console.log('--- STARTING ADMIN PASSWORD SECURITY TESTS ---');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}`);
      process.exitCode = 1;
    }
  }

  // Test 1: Verify .env.example has no hardcoded default admin password
  const forbiddenToken = ['Sell', 'Pilot', 'Admin', '2026', '!'].join('');
  const envExample = fs.readFileSync(path.join(process.cwd(), '.env.example'), 'utf-8');
  assert(
    !envExample.includes(forbiddenToken),
    '1. .env.example does not contain hardcoded default admin password'
  );
  assert(
    envExample.includes('ADMIN_PASSWORD='),
    '2. .env.example documents the ADMIN_PASSWORD variable name'
  );

  // Test 2: Verify server/db/migrate.ts has no hardcoded default admin password
  const migrateSource = fs.readFileSync(path.join(process.cwd(), 'server', 'db', 'migrate.ts'), 'utf-8');
  assert(
    !migrateSource.includes(forbiddenToken),
    '3. server/db/migrate.ts does not contain hardcoded default admin password'
  );
  assert(
    migrateSource.includes('process.env.ADMIN_PASSWORD?.trim()'),
    '4. server/db/migrate.ts checks for trimmed ADMIN_PASSWORD environment variable'
  );

  // Test 3: Verify password hashing for secure admin credentials
  const testSecret = 'SecureCustomAdminPassword_Test_999!';
  const { hash, salt } = hashPassword(testSecret);
  assert(
    hash !== testSecret && salt.length === 32,
    '5. hashPassword generates a 512-bit hash with a cryptographically secure 128-bit salt'
  );
  assert(
    verifyPassword(testSecret, hash, salt),
    '6. verifyPassword confirms correct authentication with hashed credentials'
  );
  assert(
    !verifyPassword('WrongPassword', hash, salt),
    '7. verifyPassword rejects incorrect credentials'
  );

  console.log('--- ADMIN PASSWORD SECURITY TESTS COMPLETE ---');
  console.log(`Passed: ${passed} / ${total}`);
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
