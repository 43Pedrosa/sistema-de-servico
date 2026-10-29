import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AdminRequest, AdminResponse } from '../api/_admin-auth';
import { createSessionToken, sessionCookie } from '../api/_admin-auth';

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
    setHeader(name, value) { response.headers[name.toLowerCase()] = value; },
    status(code) { response.code = code; return response; },
    json(body) { response.body = body; },
  };
  return response;
}

function authenticatedRequest(order: Record<string, unknown>): AdminRequest {
  const token = createSessionToken({
    id: null,
    username: 'store-admin',
    name: 'Gerência',
    role: 'admin',
    is_active: true,
  });
  return {
    method: 'PUT',
    headers: {
      host: 'localhost',
      origin: 'http://localhost',
      cookie: sessionCookie(token, 60 * 60),
    },
    body: { order },
  };
}

function setupEnvironment() {
  const original = {
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    adminUsername: process.env.ADMIN_USERNAME,
    passwordHash: process.env.ADMIN_PASSWORD_HASH,
    sessionSecret: process.env.ADMIN_SESSION_SECRET,
  };
  process.env.SUPABASE_URL = 'https://test-project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-server-key';
  process.env.ADMIN_USERNAME = 'store-admin';
  process.env.ADMIN_PASSWORD_HASH = 'test-password-hash';
  process.env.ADMIN_SESSION_SECRET = 'test-only-session-signing-secret-32-bytes-minimum';
  return () => {
    for (const [key, value] of Object.entries({
      SUPABASE_URL: original.supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: original.serviceRoleKey,
      ADMIN_USERNAME: original.adminUsername,
      ADMIN_PASSWORD_HASH: original.passwordHash,
      ADMIN_SESSION_SECRET: original.sessionSecret,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

test('first stage inserts one publicly searchable OS without invented customer or device values', async () => {
  const restoreEnvironment = setupEnvironment();
  const originalFetch = globalThis.fetch;
  const calls: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [];
  const orderId = '3d28e344-82ba-4b2f-90e2-3323a99e11cd';
  let saved: Record<string, unknown> | null = null;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = String(init?.method || 'GET');
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : undefined;
    calls.push({ method, path: url.pathname, body });
    if (url.pathname.endsWith('/service_orders') && method === 'GET' && url.searchParams.has('os_number')) return Response.json(null);
    if (url.pathname.endsWith('/service_orders') && method === 'POST') {
      saved = {
        ...body,
        id: orderId,
        updated_at: '2026-10-24T12:00:00.000Z',
        status: 'recebido',
        budget_status: 'aguardando_orcamento',
        is_cancelled: false,
        photos: [],
        history: [],
      };
      return Response.json(saved);
    }
    if (url.pathname.endsWith('/service_orders') && method === 'PATCH' && saved) {
      saved = { ...saved, ...body, updated_at: '2026-10-24T12:00:30.000Z' };
      return Response.json(saved);
    }
    if (url.pathname.endsWith('/service_order_history') && method === 'POST') return Response.json([]);
    if (url.pathname.endsWith('/public_service_orders_view')) {
      return Response.json({ id: orderId, os_number: '0001' });
    }
    if (url.pathname.endsWith('/service_orders') && method === 'GET' && saved) return Response.json(saved);
    return Response.json([]);
  };

  try {
    const { default: handler } = await import('../api/admin-orders');
    const response = createResponse();
    await handler(authenticatedRequest({
      os_number: '0001',
      administrative_step: 1,
      technician_name: 'Técnica informada',
      is_published: true,
    }), response);

    assert.equal(response.code, 200);
    const inserts = calls.filter(call => call.method === 'POST' && call.path.endsWith('/service_orders'));
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0].body?.os_number, '0001');
    assert.equal(inserts[0].body?.administrative_step, 0);
    assert.equal(inserts[0].body?.is_published, true);
    for (const field of ['customer_name', 'customer_phone', 'device_brand', 'device_model', 'customer_report']) {
      assert.equal(field in (inserts[0].body || {}), false, `${field} must remain omitted until collected`);
    }
    assert.ok(calls.some(call => call.method === 'PATCH' && call.body?.administrative_step === 1));
    assert.ok(calls.some(call => call.path.endsWith('/public_service_orders_view')));
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test('schema constraint errors identify the missing stage-one migration instead of blaming the form', async () => {
  const restoreEnvironment = setupEnvironment();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/service_orders') && String(init?.method || 'GET') === 'GET') {
      return Response.json(url.searchParams.has('limit') ? [] : null);
    }
    if (url.pathname.endsWith('/service_orders') && String(init?.method) === 'POST') {
      return Response.json({
        code: '23502',
        message: 'null value in column "device_brand" of relation "service_orders" violates not-null constraint',
      }, { status: 400 });
    }
    return Response.json([]);
  };

  try {
    const { default: handler } = await import('../api/admin-orders');
    const response = createResponse();
    await handler(authenticatedRequest({
      os_number: '0002',
      administrative_step: 1,
      technician_name: 'Técnica informada',
      is_published: true,
    }), response);
    assert.equal(response.code, 503);
    assert.match((response.body as { message: string }).message, /device_brand/);
    assert.match((response.body as { message: string }).message, /migração 011/);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test('partial stage update preserves omitted fields and uses optimistic concurrency', async () => {
  const restoreEnvironment = setupEnvironment();
  const originalFetch = globalThis.fetch;
  const previous = {
    id: '3d28e344-82ba-4b2f-90e2-3323a99e11cd',
    os_number: '0001',
    created_at: '2026-10-24T11:00:00.000Z',
    updated_at: '2026-10-24T12:00:00.000Z',
    administrative_step: 1,
    technician_name: 'Gerência',
    customer_name: null,
    customer_phone: null,
    customer_notes: 'Preservar esta observação',
    device_brand: null,
    device_model: null,
    customer_report: null,
    status: 'recebido',
    budget_status: 'aguardando_orcamento',
    is_published: false,
    is_cancelled: false,
    photos: [],
    history: [],
  };
  const calls: Array<{ method: string; path: string; query: URLSearchParams; body?: Record<string, unknown> }> = [];
  let saved = { ...previous };
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = String(init?.method || 'GET');
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : undefined;
    calls.push({ method, path: url.pathname, query: url.searchParams, body });
    if (url.pathname.endsWith('/service_orders') && method === 'GET') return Response.json(saved);
    if (url.pathname.endsWith('/service_orders') && method === 'PATCH') {
      saved = {
        ...saved,
        ...body,
        updated_at: body?.administrative_step === undefined
          ? '2026-10-24T12:05:00.000Z'
          : '2026-10-24T12:06:00.000Z',
      };
      return Response.json(saved);
    }
    return Response.json([]);
  };

  try {
    const { default: handler } = await import('../api/admin-orders');
    const response = createResponse();
    await handler(authenticatedRequest({
      id: previous.id,
      os_number: '0001',
      expected_updated_at: previous.updated_at,
      administrative_step: 2,
      customer_name: 'Cliente real',
      customer_phone: '(11) 98888-7777',
    }), response);

    assert.equal(response.code, 200);
    const update = calls.find(call => call.method === 'PATCH' && call.path.endsWith('/service_orders'));
    assert.ok(update);
    assert.equal(update.body?.customer_name, 'Cliente real');
    assert.equal('administrative_step' in (update.body || {}), false, 'the form step is committed only after related work succeeds');
    assert.equal('customer_notes' in (update.body || {}), false);
    assert.equal(update.query.get('updated_at'), 'eq.2026-10-24T12:00:00.000Z');
    assert.equal(saved.customer_notes, 'Preservar esta observação');
    assert.equal(saved.administrative_step, 2);
    assert.equal(saved.status, 'recebido', 'administrative progress must not alter repair status');
    const committedStep = calls.find(call => call.method === 'PATCH' && call.body?.administrative_step === 2);
    assert.equal(committedStep?.query.get('updated_at'), 'eq.2026-10-24T12:05:00.000Z');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test('a failed photo save does not advance the persisted administrative step', async () => {
  const restoreEnvironment = setupEnvironment();
  const originalFetch = globalThis.fetch;
  const previous = {
    id: '3d28e344-82ba-4b2f-90e2-3323a99e11cd',
    os_number: '0001',
    created_at: '2026-10-24T11:00:00.000Z',
    updated_at: '2026-10-24T12:00:00.000Z',
    administrative_step: 4,
    technician_name: 'Gerência',
    customer_name: 'Cliente real',
    customer_phone: '11999999999',
    device_brand: 'Apple',
    device_model: 'iPhone',
    customer_report: 'Tela sem imagem.',
    status: 'recebido',
    budget_status: 'aguardando_orcamento',
    is_published: false,
    is_cancelled: false,
    photos: [],
    history: [],
  };
  let saved = { ...previous };
  const calls: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = String(init?.method || 'GET');
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : undefined;
    calls.push({ method, path: url.pathname, body });
    if (url.pathname.endsWith('/service_orders') && method === 'GET') return Response.json(saved);
    if (url.pathname.endsWith('/service_orders') && method === 'PATCH') {
      saved = { ...saved, ...body, updated_at: '2026-10-24T12:05:00.000Z' };
      return Response.json(saved);
    }
    if (url.pathname.endsWith('/service_order_photos')) return Response.json([]);
    return Response.json([]);
  };

  try {
    const { default: handler } = await import('../api/admin-orders');
    const response = createResponse();
    await handler(authenticatedRequest({
      id: previous.id,
      os_number: '0001',
      expected_updated_at: previous.updated_at,
      administrative_step: 5,
      photos: [{
        id: '4d28e344-82ba-4b2f-90e2-3323a99e11cd',
        storage_path: '/uploads/local-photo.png',
        url: '/uploads/local-photo.png',
        caption: 'Aparelho',
        display_order: 1,
      }],
    }), response);

    assert.equal(response.code, 503);
    assert.equal(saved.administrative_step, 4);
    assert.equal(calls.some(call => call.method === 'PATCH' && call.body?.administrative_step === 5), false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});
