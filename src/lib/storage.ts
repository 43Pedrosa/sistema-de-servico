import { ServiceOrder, ServiceOrderPublic, ServiceOrderStatus, StoreSettings, AdminUser } from '../types';
import { DEFAULT_STORE_SETTINGS } from './constants';

const SETTINGS_STORAGE_KEY = 'store_acessorios_store_settings';
const AUTH_USER_KEY = 'store_acessorios_auth_user';
export const ADMIN_USER_UPDATED_EVENT = 'store-acessorios-admin-user-updated';
let currentAdminUser: AdminUser | null = null;

async function readAdminApiResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let result: T & { message?: string };
  try {
    result = text ? JSON.parse(text) as T & { message?: string } : {} as T & { message?: string };
  } catch (cause) {
    console.error('Administrative API returned a non-JSON response', cause);
    throw new Error('O servidor não retornou uma resposta válida. Tente novamente.');
  }
  if (!response.ok) throw new Error(result.message || 'Não foi possível concluir a operação administrativa.');
  return result;
}

// -------------------------------------------------------------
// PUBLIC & ADMIN DATA ACCESSORS
// -------------------------------------------------------------

export async function fetchAllOrders(): Promise<ServiceOrder[]> {
  const response = await fetch('/api/admin-orders', { credentials: 'same-origin' });
  const result = await readAdminApiResponse<{ orders: ServiceOrder[] }>(response);
  return result.orders;
}

type PublicOrderLookup = ServiceOrderPublic & Pick<ServiceOrder, 'is_published' | 'is_cancelled'>;

export async function fetchPublicOrderByOSNumber(osNumber: string): Promise<PublicOrderLookup | null> {
  const response = await fetch(`/api/public-order?osNumber=${encodeURIComponent(osNumber.trim())}`, {
    headers: { Accept: 'application/json' },
  });
  const text = await response.text();
  let result: { order?: PublicOrderLookup | null; message?: string };
  try {
    result = text ? JSON.parse(text) as typeof result : {};
  } catch (cause) {
    console.error('Public order API returned a non-JSON response', cause);
    throw new Error('O servidor não retornou uma resposta válida. Tente novamente.');
  }
  if (response.status === 404 && result.order === null) return null;
  if (!response.ok) {
    throw new Error(result.message || 'Não foi possível consultar a ordem agora.');
  }
  return result.order || null;
}

export async function saveOrUpdateOrder(
  order: Partial<ServiceOrder> & { os_number: string; expected_updated_at?: string }
): Promise<ServiceOrder> {
  const response = await fetch('/api/admin-orders', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order }),
  });
  const result = await readAdminApiResponse<{ order: ServiceOrder }>(response);
  return result.order;
}

export async function deleteOrder(id: string): Promise<boolean> {
  const response = await fetch(`/api/admin-orders?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  await readAdminApiResponse<{ deleted: boolean }>(response);
  return true;
}

// -------------------------------------------------------------
// STORE SETTINGS ACCESSORS
// -------------------------------------------------------------

export function getStoreSettings(): StoreSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_STORE_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Error loading store settings', e);
  }
  return DEFAULT_STORE_SETTINGS;
}

export function saveStoreSettings(settings: StoreSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving store settings', e);
  }
}

// -------------------------------------------------------------
// AUTHENTICATION
// -------------------------------------------------------------

export function getAdminUser(): AdminUser | null {
  return currentAdminUser;
}

export function setAdminUser(user: AdminUser | null): void {
  currentAdminUser = user;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ADMIN_USER_UPDATED_EVENT));
  }
  try {
    localStorage.removeItem(AUTH_USER_KEY);
  } catch (error) {
    console.warn('Could not clear the legacy administrator cache', error);
  }
}

export function generateNextOSNumber(orders: ServiceOrder[]): string {
  const numericNumbers = orders
    .map(o => parseInt(o.os_number, 10))
    .filter(n => !isNaN(n));

  if (numericNumbers.length === 0) return '0001';
  const highest = Math.max(...numericNumbers);
  return String(highest + 1).padStart(4, '0');
}
