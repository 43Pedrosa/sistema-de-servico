import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ServiceOrder } from '../src/types';
import { isValidOSNumber, sanitizeOrderForPublic } from '../src/lib/security';
import { fetchPublicOrderByOSNumber, saveOrUpdateOrder } from '../src/lib/storage';
import publicOrderHandler from '../api/public-order';
import budgetResponseHandler from '../api/approve-budget';
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

test('public order keeps technical details and leading zeroes without exposing private fields', () => {
  const order: ServiceOrder = {
    id: '3d28e344-82ba-4b2f-90e2-3323a99e11cd',
    os_number: '0001',
    created_at: '2026-10-23T12:00:00.000Z',
    updated_at: '2026-10-23T12:30:00.000Z',
    status: 'em_diagnostico',
    budget_status: 'aguardando_orcamento',
    administrative_step: 3,
    technician_name: 'Técnico',
    customer_name: 'Cliente confidencial',
    customer_phone: '11999999999',
    device_brand: 'Apple',
    device_model: 'iPhone',
    customer_report: 'Tela não responde.',
    technical_diagnosis: 'Display danificado.',
    required_services: 'Substituição do display.',
    required_parts: 'Display compatível.',
    public_tech_notes: 'Aguardando aprovação do orçamento.',
    internal_notes: 'Nota interna confidencial.',
    parts_cost: 0,
    labor_cost: 0,
    additional_costs: 0,
    discount: 0,
    total_amount: 0,
    is_published: true,
    is_cancelled: false,
    photos: [],
    history: [],
  };

  const publicOrder = sanitizeOrderForPublic(order);

  assert.equal(publicOrder.os_number, '0001');
  assert.equal(publicOrder.customer_report, order.customer_report);
  assert.equal(publicOrder.technical_diagnosis, order.technical_diagnosis);
  assert.equal(publicOrder.required_services, order.required_services);
  assert.equal(publicOrder.required_parts, order.required_parts);
  assert.equal(publicOrder.public_tech_notes, order.public_tech_notes);
  assert.equal('internal_notes' in publicOrder, false);
  assert.equal('customer_name' in publicOrder, false);
  assert.equal('customer_phone' in publicOrder, false);
});

test('public order search accepts OS numbers with leading zeroes', () => {
  assert.equal(isValidOSNumber('0001'), true);
});

test('public lookup requests the shared API with the exact OS number and public fields', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = async input => {
    requestedUrl = String(input);
    return Response.json({
      order: {
        os_number: '0001',
        is_published: true,
        is_cancelled: false,
        customer_report: 'Tela sem imagem.',
      },
    });
  };

  try {
    const order = await fetchPublicOrderByOSNumber('0001');
    assert.equal(new URL(requestedUrl, 'https://example.test').searchParams.get('osNumber'), '0001');
    assert.equal(order?.os_number, '0001');
    assert.equal(order?.customer_report, 'Tela sem imagem.');
    assert.equal('internal_notes' in (order || {}), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('public lookup reports API failures instead of falling back to browser storage', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json(
    { message: 'A consulta pública compartilhada não está configurada no servidor.' },
    { status: 503 }
  );

  try {
    await assert.rejects(
      fetchPublicOrderByOSNumber('0001'),
      /consulta pública compartilhada não está configurada/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('public server endpoint reads exact published order and returns only public data', async () => {
  const originalEnvironment = {
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  process.env.SUPABASE_URL = 'https://test-project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-server-key';
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    requestedUrls.push(url.toString());
    if (url.pathname.endsWith('/public_service_orders_view')) {
      return Response.json({
        id: '3d28e344-82ba-4b2f-90e2-3323a99e11cd',
        os_number: '0001',
        customer_report: 'Tela sem imagem.',
        technical_diagnosis: 'Conector do display danificado.',
        required_services: 'Substituição do conector.',
        required_parts: 'Conector de display.',
        public_tech_notes: 'Orçamento aguardando aprovação.',
        status: 'orcamento_enviado',
        budget_status: 'aguardando_aprovacao',
      });
    }
    if (url.pathname.endsWith('/service_order_photos')) return Response.json([]);
    if (url.pathname.endsWith('/service_order_history')) {
      return Response.json([{
        id: '4d28e344-82ba-4b2f-90e2-3323a99e11cd',
        event_type: 'status_change',
        public_message: 'Orçamento enviado.',
        created_at: '2026-10-23T12:30:00.000Z',
        previous_value: 'em_diagnostico',
        new_value: 'orcamento_enviado',
      }]);
    }
    return Response.json([]);
  };

  const request: AdminRequest = {
    method: 'GET',
    headers: {},
    query: { osNumber: '0001' },
  };
  const response = createResponse();
  try {
    await publicOrderHandler(request, response);
    assert.equal(response.code, 200);
    assert.ok(requestedUrls.some(url => new URL(url).searchParams.get('os_number') === 'eq.0001'));
    const order = (response.body as { order: Record<string, unknown> }).order;
    assert.equal(order.os_number, '0001');
    assert.equal(order.is_published, true);
    assert.equal(order.is_cancelled, false);
    assert.equal(order.customer_report, 'Tela sem imagem.');
    assert.deepEqual(order.history, [{
      id: '4d28e344-82ba-4b2f-90e2-3323a99e11cd',
      event_type: 'status_change',
      public_message: 'Orçamento enviado.',
      created_at: '2026-10-23T12:30:00.000Z',
      previous_value: 'em_diagnostico',
      new_value: 'orcamento_enviado',
    }]);
    assert.equal('internal_notes' in order, false);
    assert.equal('customer_phone' in order, false);
    assert.equal('storage_path' in order, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnvironment.supabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalEnvironment.supabaseUrl;
    if (originalEnvironment.serviceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnvironment.serviceRoleKey;
  }
});

test('public server endpoint returns not found when the OS is not in the published view', async () => {
  const originalEnvironment = {
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const originalFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://test-project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-server-key';
  globalThis.fetch = async () => Response.json(null);

  const response = createResponse();
  try {
    await publicOrderHandler({
      method: 'GET',
      headers: {},
      query: { osNumber: '0001' },
    }, response);
    assert.equal(response.code, 404);
    assert.deepEqual(response.body, { order: null });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnvironment.supabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalEnvironment.supabaseUrl;
    if (originalEnvironment.serviceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnvironment.serviceRoleKey;
  }
});

test('public server endpoint serves a newly published step-one OS with incomplete device fields', async () => {
  const originalEnvironment = {
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const originalFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://test-project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-server-key';
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/public_service_orders_view')) {
      assert.equal(url.searchParams.get('os_number'), 'eq.0001');
      return Response.json({
        id: '3d28e344-82ba-4b2f-90e2-3323a99e11cd',
        os_number: '0001',
        status: 'recebido',
        budget_status: 'aguardando_orcamento',
        device_brand: null,
        device_model: null,
        customer_report: null,
        parts_cost: 0,
        labor_cost: 0,
        additional_costs: 0,
        discount: 0,
        total_amount: 0,
      });
    }
    return Response.json([]);
  };

  try {
    const response = createResponse();
    await publicOrderHandler({
      method: 'GET',
      headers: {},
      query: { osNumber: '0001' },
    }, response);
    assert.equal(response.code, 200);
    const order = (response.body as { order: Record<string, unknown> }).order;
    assert.equal(order.os_number, '0001');
    assert.equal(order.status, 'recebido');
    assert.equal(order.is_published, true);
    assert.equal(order.device_brand, null);
    assert.equal(order.device_model, null);
    for (const field of ['customer_name', 'customer_phone', 'customer_notes', 'device_imei_serial', 'internal_notes']) {
      assert.equal(field in order, false);
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnvironment.supabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalEnvironment.supabaseUrl;
    if (originalEnvironment.serviceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnvironment.serviceRoleKey;
  }
});

test('public server endpoint reports missing shared Supabase configuration', async () => {
  const originalEnvironment = {
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const response = createResponse();
  try {
    await publicOrderHandler({
      method: 'GET',
      headers: {},
      query: { osNumber: '0001' },
    }, response);
    assert.equal(response.code, 503);
    assert.deepEqual(response.body, {
      message: 'A consulta pública compartilhada não está configurada no servidor.',
    });
  } finally {
    if (originalEnvironment.supabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalEnvironment.supabaseUrl;
    if (originalEnvironment.serviceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnvironment.serviceRoleKey;
  }
});

test('order save rejects API failures rather than resolving as saved', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json(
    { message: 'A OS foi salva, mas não foi localizada na consulta pública.' },
    { status: 503 }
  );

  try {
    await assert.rejects(
      saveOrUpdateOrder({ os_number: '0001' }),
      /não foi localizada na consulta pública/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('order save sends the administrative step with only the changed stage fields', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: { order: Record<string, unknown> } | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as typeof requestBody;
    return Response.json({
      order: {
        id: '3d28e344-82ba-4b2f-90e2-3323a99e11cd',
        os_number: '0001',
        administrative_step: 1,
      },
    });
  };

  try {
    const saved = await saveOrUpdateOrder({
      id: '3d28e344-82ba-4b2f-90e2-3323a99e11cd',
      os_number: '0001',
      administrative_step: 1,
      customer_report: 'Tela sem imagem.',
    });
    assert.equal(saved.administrative_step, 1);
    assert.deepEqual(requestBody, {
      order: {
        id: '3d28e344-82ba-4b2f-90e2-3323a99e11cd',
        os_number: '0001',
        administrative_step: 1,
        customer_report: 'Tela sem imagem.',
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('customer budget rejection calls the protected server RPC and returns the persisted state', async () => {
  const originalEnvironment = {
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const originalFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://test-project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-server-key';
  let requestedUrl = '';
  let requestedBody: unknown;
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
    return Response.json({
      rejected: true,
      order_number: '0001',
      status: 'em_diagnostico',
      budget_status: 'recusado',
    });
  };

  const response = createResponse();
  try {
    await budgetResponseHandler({
      method: 'POST',
      headers: { origin: 'https://store.test', host: 'store.test' },
      body: { orderNumber: '0001', decision: 'reject' },
    }, response);
    assert.equal(response.code, 200);
    assert.match(requestedUrl, /\/rpc\/reject_service_order_budget$/);
    assert.deepEqual(requestedBody, { p_os_number: '0001' });
    assert.deepEqual(response.body, {
      message: 'Recusa do orçamento da OS #0001 registrada. A equipe entrará em contato para revisar as opções.',
      decision: 'reject',
      status: 'em_diagnostico',
      budgetStatus: 'recusado',
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnvironment.supabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalEnvironment.supabaseUrl;
    if (originalEnvironment.serviceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnvironment.serviceRoleKey;
  }
});
