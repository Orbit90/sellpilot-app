/**
 * Production Build Output Security & Asset Isolation Test Suite
 *
 * Verifies:
 * 1. Frontend/client build output is placed in dist/public (browser files only).
 * 2. Backend/server build output is placed in dist/server (server.cjs, server.cjs.map).
 * 3. dist/public contains NO backend files (no server.cjs, no *.cjs.map, no server code).
 * 4. Production Express server serves ONLY files from dist/public.
 * 5. GET /server.cjs, GET /server.cjs.map, GET /server/server.cjs return 404 Not Found.
 * 6. Valid frontend assets (e.g. index.html, icon.svg) load with HTTP 200.
 * 7. API endpoints remain fully functional in production mode.
 */

import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

const TEST_PORT = 3456;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('--- STARTING BUILD OUTPUT EXPOSURE SECURITY TESTS ---');
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

  const projectRoot = process.cwd();
  const publicDir = path.join(projectRoot, 'dist', 'public');
  const serverDir = path.join(projectRoot, 'dist', 'server');

  // Test 1: Frontend output directory exists and contains index.html
  assert(
    fs.existsSync(publicDir) && fs.existsSync(path.join(publicDir, 'index.html')),
    '1. Frontend build directory (dist/public) exists and contains index.html'
  );

  // Test 2: Backend output directory exists and contains server.cjs
  assert(
    fs.existsSync(serverDir) && fs.existsSync(path.join(serverDir, 'server.cjs')),
    '2. Backend build directory (dist/server) exists and contains server.cjs'
  );

  // Test 3: Backend source maps are in dist/server, NOT in dist/public
  assert(
    fs.existsSync(path.join(serverDir, 'server.cjs.map')),
    '3. Backend source maps are created in dist/server'
  );

  // Test 4: dist/public does NOT contain server.cjs
  assert(
    !fs.existsSync(path.join(publicDir, 'server.cjs')),
    '4. dist/public does NOT contain server.cjs'
  );

  // Test 5: dist/public does NOT contain any .cjs or .map files for the server
  const publicFiles = fs.readdirSync(publicDir);
  assert(
    !publicFiles.some((f) => f.endsWith('.cjs') || f.endsWith('.cjs.map')),
    '5. dist/public contains no .cjs or .cjs.map server files'
  );

  // Now start production server on TEST_PORT to test actual HTTP behavior
  console.log(`Starting production server test on port ${TEST_PORT}...`);
  const env = {
    ...process.env,
    PORT: String(TEST_PORT),
    NODE_ENV: 'production',
  };

  const serverProc: ChildProcess = spawn('node', ['dist/server/server.cjs'], {
    env,
    cwd: projectRoot,
    stdio: 'pipe',
  });

  let serverStarted = false;

  serverProc.stdout?.on('data', (data) => {
    const out = data.toString();
    if (out.includes(`SellPilot server listening on port ${TEST_PORT}`)) {
      serverStarted = true;
    }
  });

  // Wait for server to boot
  for (let i = 0; i < 30; i++) {
    if (serverStarted) break;
    await sleep(200);
  }

  try {
    // Test 6: Frontend loads index.html at root
    const rootRes = await fetch(`${BASE_URL}/`);
    const rootText = await rootRes.text();
    assert(
      rootRes.status === 200 && rootText.includes('<!doctype html>'),
      '6. Frontend loads index.html at root (HTTP 200)'
    );

    // Test 7: Static file intended for browser (icon.svg) is served
    const iconRes = await fetch(`${BASE_URL}/icon.svg`);
    assert(
      iconRes.status === 200,
      '7. Browser-intended static file (icon.svg) is served successfully (HTTP 200)'
    );

    // Test 8: API endpoint functions properly
    const apiRes = await fetch(`${BASE_URL}/api/plans`);
    const apiData = await apiRes.json();
    assert(
      apiRes.status === 200 && Array.isArray(apiData) && apiData.length > 0,
      '8. Production API routes (/api/plans) are fully functional (HTTP 200)'
    );

    // Test 9: GET /server.cjs is rejected and NOT accessible
    const serverCjsRes = await fetch(`${BASE_URL}/server.cjs`);
    assert(
      serverCjsRes.status === 404,
      '9. GET /server.cjs returns HTTP 404 Not Found'
    );

    // Test 10: GET /server.cjs.map is rejected and NOT accessible
    const mapRes = await fetch(`${BASE_URL}/server.cjs.map`);
    assert(
      mapRes.status === 404,
      '10. GET /server.cjs.map returns HTTP 404 Not Found'
    );

    // Test 11: GET /server/server.cjs is rejected and NOT accessible
    const nestedServerRes = await fetch(`${BASE_URL}/server/server.cjs`);
    assert(
      nestedServerRes.status === 404,
      '11. GET /server/server.cjs returns HTTP 404 Not Found'
    );

    // Test 12: GET /server/server.cjs.map is rejected and NOT accessible
    const nestedMapRes = await fetch(`${BASE_URL}/server/server.cjs.map`);
    assert(
      nestedMapRes.status === 404,
      '12. GET /server/server.cjs.map returns HTTP 404 Not Found'
    );

  } finally {
    serverProc.kill('SIGTERM');
  }

  console.log('--- BUILD OUTPUT EXPOSURE SECURITY TESTS COMPLETE ---');
  console.log(`Passed: ${passed} / ${total}`);
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
