import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPassword } from '../api/_password';
import type { AdminRequest, AdminResponse } from '../api/_admin-auth';

interface TestResponse extends AdminResponse {
  code: number;
  headers: Record<string, string>;
  body: unknown;
}

function createResponse(): TestResponse {
  const response: TestResponse = {
    code: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      response.headers[name.toLowerCase()] = value;
    },
    status(code) {
      response.code = code;
      return response;
    },
    json(body) {
      response.body = body;
    },
  };
  return response;
}

function request(method: string, body?: unknown, cookie?: string, ip = '127.0.0.1'): AdminRequest {
  return {
    method,
    ip,
    headers: {
      host: 'localhost',
      origin: 'http://localhost',
      ...(cookie ? { cookie } : {}),
    },
    body,
  };
}

test('standalone administrator login signs and validates sessions without Supabase', async () => {
  const originalEnvironment = {
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    adminUsername: process.env.ADMIN_USERNAME,
    passwordHash: process.env.ADMIN_PASSWORD_HASH,
    sessionSecret: process.env.ADMIN_SESSION_SECRET,
    nodeEnv: process.env.NODE_ENV,
  };
  process.env.SUPABASE_URL = '';
  process.env.SUPABASE_SERVICE_ROLE_KEY = '';
  process.env.ADMIN_USERNAME = 'MINHALOJA2026';
  process.env.ADMIN_PASSWORD_HASH = await hashPassword('A-secure-test-password-123!');
  process.env.ADMIN_SESSION_SECRET = 'test-only-session-signing-secret-32-bytes-minimum';
  process.env.NODE_ENV = 'test';

  try {
    const [{ default: login }, { default: sessionHandler }, { default: logout }, { default: orders }] = await Promise.all([
      import('../api/admin-login'),
      import('../api/admin-session'),
      import('../api/admin-logout'),
      import('../api/admin-orders'),
    ]);

    const invalidPasswordResponse = createResponse();
    await login(request('POST', {
      username: 'MINHALOJA2026',
      password: 'not-the-test-password',
    }), invalidPasswordResponse);
    assert.equal(invalidPasswordResponse.code, 401);

    const unknownUserResponse = createResponse();
    await login(request('POST', {
      username: 'unknown-user',
      password: 'A-secure-test-password-123!',
    }), unknownUserResponse);
    assert.equal(unknownUserResponse.code, 401);
    assert.deepEqual(unknownUserResponse.body, invalidPasswordResponse.body);

    const badOriginRequest = request('POST', {
      username: 'MINHALOJA2026',
      password: 'A-secure-test-password-123!',
    });
    delete badOriginRequest.headers.origin;
    const badOriginResponse = createResponse();
    await login(badOriginRequest, badOriginResponse);
    assert.equal(badOriginResponse.code, 403);

    const loginResponse = createResponse();
    await login(request('POST', {
      username: ' minhaloja2026 ',
      password: 'A-secure-test-password-123!',
    }), loginResponse);
    assert.equal(loginResponse.code, 200);
    assert.match(loginResponse.headers['set-cookie'], /HttpOnly/);
    assert.match(loginResponse.headers['set-cookie'], /SameSite=Strict/);
    const cookie = loginResponse.headers['set-cookie'].split(';', 1)[0];

    const sessionResponse = createResponse();
    await sessionHandler(request('GET', undefined, cookie), sessionResponse);
    assert.equal(sessionResponse.code, 200);
    assert.deepEqual((sessionResponse.body as { user: unknown }).user, {
      id: null,
      username: 'minhaloja2026',
      name: 'Gerência',
      role: 'admin',
      is_active: true,
    });

    const cookieValue = cookie.slice(cookie.indexOf('=') + 1);
    const signatureOffset = cookieValue.indexOf('.') + 1;
    const alteredSignatureCharacter = cookieValue[signatureOffset] === 'A' ? 'B' : 'A';
    const tamperedToken = `${cookieValue.slice(0, signatureOffset)}${alteredSignatureCharacter}${cookieValue.slice(signatureOffset + 1)}`;
    const tamperedSessionResponse = createResponse();
    await sessionHandler(request('GET', undefined, `${cookie.slice(0, cookie.indexOf('=') + 1)}${tamperedToken}`), tamperedSessionResponse);
    assert.equal(tamperedSessionResponse.code, 401);

    const originalNow = Date.now;
    Date.now = () => originalNow() + (8 * 60 * 60 * 1000) + 1000;
    try {
      const expiredSessionResponse = createResponse();
      await sessionHandler(request('GET', undefined, cookie), expiredSessionResponse);
      assert.equal(expiredSessionResponse.code, 401);
    } finally {
      Date.now = originalNow;
    }

    const originalPasswordHash = process.env.ADMIN_PASSWORD_HASH;
    process.env.ADMIN_PASSWORD_HASH = await hashPassword('Different secure test password 456!');
    const changedPasswordResponse = createResponse();
    await sessionHandler(request('GET', undefined, cookie), changedPasswordResponse);
    assert.equal(changedPasswordResponse.code, 401);
    process.env.ADMIN_PASSWORD_HASH = originalPasswordHash;

    const unauthorizedOrdersResponse = createResponse();
    await orders(request('GET'), unauthorizedOrdersResponse);
    assert.equal(unauthorizedOrdersResponse.code, 401);

    const logoutResponse = createResponse();
    await logout(request('POST', undefined, cookie), logoutResponse);
    assert.equal(logoutResponse.code, 200);
    assert.match(logoutResponse.headers['set-cookie'], /Max-Age=0/);

    const clearedBrowserSessionResponse = createResponse();
    await sessionHandler(request('GET'), clearedBrowserSessionResponse);
    assert.equal(clearedBrowserSessionResponse.code, 401);
  } finally {
    if (originalEnvironment.supabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalEnvironment.supabaseUrl;
    if (originalEnvironment.serviceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnvironment.serviceRoleKey;
    if (originalEnvironment.adminUsername === undefined) delete process.env.ADMIN_USERNAME;
    else process.env.ADMIN_USERNAME = originalEnvironment.adminUsername;
    if (originalEnvironment.passwordHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
    else process.env.ADMIN_PASSWORD_HASH = originalEnvironment.passwordHash;
    if (originalEnvironment.sessionSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = originalEnvironment.sessionSecret;
    if (originalEnvironment.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnvironment.nodeEnv;
  }
});
